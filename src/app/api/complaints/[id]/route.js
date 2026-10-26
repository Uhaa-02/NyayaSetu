import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Complaint from '@/models/Complaint';
import Institution from '@/models/Institution';
import User from '@/models/User';
import { apiError, canAccess, canPerform, readJson, requireAuth } from '@/lib/api';
import { pickAssignee } from '@/lib/complaintService';
import { logAction, defaultNextAction } from '@/lib/actions';
import { overlapForInstitution } from '@/lib/overlapService';
import { notifyAssignee, notifyOutcome, notifyOverlapGroup, notifyProgress } from '@/lib/notifications';
import { cleanUrl } from '@/lib/validation';
import { computeDeadline, slaState } from '@/lib/sla';
import {
  BUREAUS,
  DONE_STATUSES,
  ESCALATION_EXTENSION_HOURS,
  ESCALATION_LEVELS,
  OPEN_STATUSES,
  PRIORITIES,
  PRIORITY_RANK,
  SLA_HOURS,
  STATUSES,
  TRANSITIONS,
  shortBureau,
} from '@/lib/constants';

export const dynamic = 'force-dynamic';

const MINI = 'complaintId title status priority bureau assignedToName createdAt';

async function buildDetail(c, session) {
  const readOnly = !canAccess(session, c);
  const [related, duplicates, total, open, duplicateOfDoc, linked, institution, overlap] = await Promise.all([
    Complaint.find({ institutionKey: c.institutionKey, complaintId: { $ne: c.complaintId } })
      .select(MINI)
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Complaint.find({ duplicateOf: c.complaintId }).select(MINI).sort({ createdAt: -1 }).limit(10).lean(),
    Complaint.countDocuments({ institutionKey: c.institutionKey }),
    Complaint.countDocuments({ institutionKey: c.institutionKey, status: { $in: OPEN_STATUSES } }),
    c.duplicateOf ? Complaint.findOne({ complaintId: c.duplicateOf }).select(MINI).lean() : null,
    // manual links work in both directions
    Complaint.find({ $or: [{ complaintId: { $in: c.linkedCases || [] } }, { linkedCases: c.complaintId }] })
      .select(MINI)
      .limit(20)
      .lean(),
    c.institutionId ? Institution.findOne({ permanentId: c.institutionId }).lean() : null,
    overlapForInstitution(c.institutionId),
  ]);

  const obj = c.toObject ? c.toObject() : c;
  delete obj._id;
  delete obj.__v;

  if (readOnly) {
    // Other bureaus see enough to coordinate, but not the complainant's contact details or internal notes.
    obj.complainantEmail = '';
    obj.complainantPhone = '';
    obj.complainantName = 'Withheld (other bureau)';
    obj.timeline = (obj.timeline || []).filter((t) => t.visibility === 'public');
  }

  return {
    readOnly,
    complaint: { ...obj, assignedTo: obj.assignedTo ? String(obj.assignedTo) : null, sla: slaState(obj) },
    related,
    duplicates,
    duplicateOfDoc,
    linked: linked.filter((l, i, a) => a.findIndex((x) => x.complaintId === l.complaintId) === i),
    institutionStats: { total, open },
    institution: institution
      ? {
          permanentId: institution.permanentId,
          name: institution.name,
          type: institution.type,
          city: institution.city,
          address: institution.address,
          state: institution.state,
          region: institution.region,
          verified: institution.verified,
        }
      : null,
    overlap: overlap
      ? {
          institutionId: overlap.institutionId,
          status: overlap.status,
          severity: overlap.severity,
          record: overlap.record,
          bureaus: overlap.bureaus.map((b) => ({
            bureau: b.bureau,
            short: b.short,
            count: b.count,
            cases: b.cases.filter((x) => x.complaintId !== c.complaintId).map((x) => ({ complaintId: x.complaintId, title: x.title, status: x.status, priority: x.priority, assignedToName: x.assignedToName })),
          })),
        }
      : null,
  };
}

export async function GET(_req, { params }) {
  const { session, error } = requireAuth();
  if (error) return error;
  try {
    await connectDB();
    const c = await Complaint.findOne({ complaintId: params.id });
    if (!c) return apiError('Complaint not found.', 404);
    // Staff outside the owning bureau/region get a read-only coordination view (see buildDetail).
    return NextResponse.json(await buildDetail(c, session));
  } catch (err) {
    console.error('complaint detail error', err);
    return apiError('Could not load the complaint.', 500);
  }
}

export async function PATCH(req, { params }) {
  const { session, error } = requireAuth();
  if (error) return error;
  const body = await readJson(req);
  if (!body || !body.action) return apiError('An action is required.', 400);

  try {
    await connectDB();
    const c = await Complaint.findOne({ complaintId: params.id });
    if (!c) return apiError('Complaint not found.', 404);
    if (!canAccess(session, c)) return apiError('This complaint belongs to another bureau. You can view it but not change it.', 403);
    if (!canPerform(session, body.action)) return apiError('Your role is not allowed to do this.', 403);

    const now = new Date();
    let mailKind = null; // set when this change should be emailed after saving
    const note = String(body.note || '').trim().slice(0, 1000);
    const isManager = session.role === 'bureau_head' || session.role === 'chairman';
    const stamp = { by: session.name, byRole: session.role, at: now };

    switch (body.action) {
      case 'status': {
        const to = body.status;
        if (!STATUSES.includes(to)) return apiError('Unknown status.', 400);
        if (!(TRANSITIONS[c.status] || []).includes(to))
          return apiError(`A complaint cannot move from "${c.status}" to "${to}".`, 400);
        const finishing = DONE_STATUSES.includes(to);
        if (finishing && note.length < 10)
          return apiError('Please add a resolution / closure note (at least 10 characters).', 400);
        if (c.status === 'Closed' && !isManager) return apiError('Only a Bureau Head or Chairman can reopen a closed complaint.', 403);

        const from = c.status;
        c.status = to;
        if (to === 'Resolved') c.resolvedAt = now;
        if (to === 'Closed') {
          c.closedAt = now;
          if (!c.resolvedAt) c.resolvedAt = now;
        }
        if (DONE_STATUSES.includes(from) && to === 'In Review') {
          // reopened: clear completion stamps and restart the clock
          c.resolvedAt = undefined;
          c.closedAt = undefined;
          c.slaDeadline = computeDeadline(c.priority, now);
        }
        logAction(c, {
          action: 'status',
          message: `Status changed from ${from} to ${to}.`,
          from,
          to,
          visibility: 'public',
          ...stamp,
        });
        if (note) {
          logAction(c, {
            action: 'note',
            message: finishing ? `Outcome: ${note}` : note,
            visibility: finishing ? 'public' : 'internal',
            ...stamp,
          });
        }
        // keep "next action required" meaningful after every status change
        const next = defaultNextAction(to, now);
        c.nextAction = next.text;
        c.nextActionDue = next.due || undefined;
        if (finishing) mailKind = 'outcome';
        else mailKind = 'progress'; // In Review / Hearing Scheduled / reopened: tell the complainant
        break;
      }

      case 'note': {
        if (note.length < 3) return apiError('Note is too short.', 400);
        logAction(c, { action: 'note', message: note, visibility: 'internal', ...stamp });
        break;
      }

      case 'next_action': {
        const text = String(body.text || '').trim().slice(0, 200);
        if (text.length < 5) return apiError('Describe the next action (at least 5 characters).', 400);
        let due;
        if (body.due) {
          due = new Date(body.due);
          if (Number.isNaN(due.getTime())) return apiError('The due date is not valid.', 400);
        }
        c.nextAction = text;
        c.nextActionDue = due;
        logAction(c, {
          action: 'next_action',
          message: `Next action set: ${text}${due ? ` (due ${due.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})` : ''}.`,
          visibility: 'internal',
          ...stamp,
        });
        break;
      }

      case 'link': {
        const other = String(body.complaintId || '').trim().toUpperCase();
        if (!other || other === c.complaintId) return apiError('Enter the ID of a different complaint to link.', 400);
        const target = await Complaint.findOne({ complaintId: other });
        if (!target) return apiError(`No complaint with ID ${other}.`, 404);
        if (target.institutionId !== c.institutionId)
          return apiError('Only cases about the same institution can be linked.', 400);
        if ((c.linkedCases || []).includes(other)) return apiError('These cases are already linked.', 400);
        c.linkedCases.push(other);
        logAction(c, { action: 'link', message: `Linked with ${other} (${shortBureau(target.bureau)}).`, visibility: 'internal', ...stamp });
        logAction(target, { action: 'link', message: `Linked with ${c.complaintId} (${shortBureau(c.bureau)}) by ${session.name}.`, visibility: 'internal', ...stamp });
        await target.save();
        break;
      }

      case 'unlink': {
        const other = String(body.complaintId || '').trim().toUpperCase();
        const target = await Complaint.findOne({ complaintId: other });
        c.linkedCases = (c.linkedCases || []).filter((x) => x !== other);
        logAction(c, { action: 'link', message: `Link with ${other} removed.`, visibility: 'internal', ...stamp });
        if (target) {
          target.linkedCases = (target.linkedCases || []).filter((x) => x !== c.complaintId);
          await target.save();
        }
        break;
      }

      case 'document': {
        const url = cleanUrl(body.url);
        const name = String(body.name || '').trim().slice(0, 120);
        if (!url) return apiError('Enter a valid link starting with http:// or https://', 400);
        if (name.length < 2) return apiError('Give the document a short name.', 400);
        if ((c.documents || []).length >= 25) return apiError('Maximum 25 documents per case.', 400);
        c.documents.push({ name, url, addedBy: session.name, at: now });
        logAction(c, { action: 'document', message: `Supporting document added: ${name}.`, visibility: 'internal', ...stamp });
        break;
      }

      case 'assign': {
        if (!isManager) return apiError('Only a Bureau Head or Chairman can assign cases.', 403);
        const u = await User.findById(body.userId).select('name role bureau active');
        if (!u || !u.active || !['officer', 'bureau_head'].includes(u.role) || u.bureau !== c.bureau)
          return apiError('Choose an active officer or head from the same bureau.', 400);
        c.assignedTo = u._id;
        c.assignedToName = u.name;
        logAction(c, { action: 'assigned', message: `Assigned to ${u.name}.`, visibility: 'internal', ...stamp });
        mailKind = 'assigned';
        break;
      }

      case 'priority': {
        if (!isManager) return apiError('Only a Bureau Head or Chairman can change priority.', 403);
        const p = body.priority;
        if (!PRIORITIES.includes(p)) return apiError('Unknown priority.', 400);
        if (p === c.priority) return apiError('Priority is already set to that value.', 400);
        if (note.length < 5) return apiError('Please give a short reason for the priority change.', 400);
        const old = c.priority;
        c.priority = p;
        c.priorityRank = PRIORITY_RANK[p];
        c.slaHours = SLA_HOURS[p];
        if (OPEN_STATUSES.includes(c.status)) c.slaDeadline = computeDeadline(p, now);
        logAction(c, {
          action: 'priority',
          message: `Priority changed from ${old} to ${p}. Reason: ${note}`,
          from: old,
          to: p,
          visibility: 'internal',
          ...stamp,
        });
        break;
      }

      case 'escalate': {
        if (!OPEN_STATUSES.includes(c.status)) return apiError('Only open complaints can be escalated.', 400);
        if (c.escalationLevel >= 2) return apiError('This complaint is already at the highest level.', 400);
        const next = c.escalationLevel + 1;
        let target;
        if (next === 1) target = await User.findOne({ role: 'bureau_head', bureau: c.bureau, active: true }).select('_id name');
        else target = await User.findOne({ role: 'chairman', active: true }).select('_id name');
        c.escalationLevel = next;
        c.escalatedAt = now;
        c.slaDeadline = new Date(now.getTime() + ESCALATION_EXTENSION_HOURS[next] * 3600 * 1000);
        if (target) {
          c.assignedTo = target._id;
          c.assignedToName = target.name;
        }
        c.nextAction = `Review the escalated case and decide the way forward (${ESCALATION_LEVELS[next]})`;
        c.nextActionDue = c.slaDeadline;
        logAction(c, {
          action: 'escalated',
          message: `Manually escalated to ${ESCALATION_LEVELS[next]}${target ? ` (${target.name})` : ''}.${note ? ` Reason: ${note}` : ''}`,
          visibility: 'public',
          ...stamp,
        });
        mailKind = 'escalated';
        break;
      }

      case 'reassign_bureau': {
        if (!isManager) return apiError('Only a Bureau Head or Chairman can transfer a complaint.', 403);
        const bureau = body.bureau;
        if (!BUREAUS.includes(bureau)) return apiError('Unknown bureau.', 400);
        if (bureau === c.bureau) return apiError('The complaint is already with that bureau.', 400);
        const old = c.bureau;
        const assignee = await pickAssignee(bureau);
        c.bureau = bureau;
        c.assignedTo = assignee ? assignee._id : null;
        c.assignedToName = assignee ? assignee.name : '';
        c.transferCount = (c.transferCount || 0) + 1;
        c.transfers.push({ from: old, to: bureau, by: session.name, reason: note, at: now });
        c.nextAction = `Take over the case transferred from ${shortBureau(old)} and acknowledge`;
        c.nextActionDue = new Date(now.getTime() + 48 * 3600 * 1000);
        logAction(c, {
          action: 'bureau',
          message: `Transferred from ${old} to ${bureau}.${note ? ` Reason: ${note}` : ''}`,
          visibility: 'public',
          ...stamp,
        });
        mailKind = 'transferred';
        break;
      }

      default:
        return apiError('Unknown action.', 400);
    }

    await c.save();
    if (mailKind === 'outcome') await notifyOutcome(c);
    else if (mailKind === 'progress') await notifyProgress(c);
    else if (mailKind) await notifyAssignee(c, mailKind);
    if (mailKind === 'transferred') {
      // the transfer may have put two bureaus on the same institution: alert the people involved
      const g = await overlapForInstitution(c.institutionId);
      if (g && g.status === 'Coordination Required') await notifyOverlapGroup(c, g);
    }
    // After a transfer, the actor may no longer have access to this complaint.
    if (!canAccess(session, c)) {
      return NextResponse.json({ moved: true, message: `Complaint transferred to ${c.bureau}.` });
    }
    return NextResponse.json(await buildDetail(c, session));
  } catch (err) {
    console.error('complaint update error', err);
    return apiError('Could not update the complaint.', 500);
  }
}
