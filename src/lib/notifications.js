// Decides WHO gets WHICH email and sends it. Every function is safe to call: it never throws and does nothing
// when email is not configured.
import User from '../models/User.js';
import Complaint from '../models/Complaint.js';
import { sendMail, mailConfig } from './mailer.js';
import { tplAcknowledgement, tplAssigned, tplChairmanSummary, tplCoordinated, tplDigest, tplOutcome, tplOverlap, tplProgress } from './emailTemplates.js';
import { loadAllOverlaps } from './overlapService.js';
import { DUE_SOON_HOURS, OPEN_STATUSES, PENDING_REMINDER_HOURS } from './constants.js';

const HOUR = 3600 * 1000;

async function safe(label, fn) {
  if (!mailConfig().enabled) return null;
  try {
    const r = await fn();
    if (r && r.ok === false && r.error) console.warn(`[mail] ${label}: ${r.error}`);
    return r;
  } catch (e) {
    console.error(`[mail] ${label} failed:`, e.message);
    return null;
  }
}

async function emailOf(userId) {
  if (!userId) return null;
  const u = await User.findById(userId).select('email name active').lean();
  return u && u.active !== false ? u : null;
}

/**
 * Everyone who should hear about an overlap: the head of every bureau involved AND the officer working on each
 * of the open cases (so two people working on the same institution both get the alert). Deduplicated.
 */
async function overlapRecipients(bureauNames, caseIds) {
  const [heads, cases] = await Promise.all([
    User.find({ role: 'bureau_head', active: true, bureau: { $in: bureauNames } }).select('email').lean(),
    Complaint.find({ complaintId: { $in: caseIds } }).select('assignedTo').lean(),
  ]);
  const ids = [...new Set(cases.map((c) => c.assignedTo).filter(Boolean).map(String))];
  const assignees = ids.length ? await User.find({ _id: { $in: ids }, active: true }).select('email').lean() : [];
  return [...new Set([...heads, ...assignees].map((u) => u.email).filter(Boolean))];
}

/** A case moved (transfer) and now shares an institution with other bureaus: alert everyone involved. */
export async function notifyOverlapGroup(c, group) {
  return safe('overlap group', async () => {
    const caseIds = group.bureaus.flatMap((b) => b.cases.map((x) => x.complaintId));
    const to = await overlapRecipients(group.bureauNames, caseIds);
    if (!to.length) return { ok: false, skipped: 'No recipients.' };
    const info = { count: caseIds.length - 1, bureaus: group.bureauNames.filter((b) => b !== c.bureau), caseIds: caseIds.filter((id) => id !== c.complaintId) };
    return sendMail({ to, ...tplOverlap(c, info) });
  });
}

/** After a complaint is created: receipt to the complainant, assignment to the officer, overlap to bureau heads. */
export async function notifyCaseCreated(doc) {
  return safe('case created', async () => {
    const jobs = [];
    if (doc.complainantEmail) jobs.push(sendMail({ to: doc.complainantEmail, ...tplAcknowledgement(doc) }));

    const assignee = await emailOf(doc.assignedTo);
    if (assignee) jobs.push(sendMail({ to: assignee.email, ...tplAssigned(doc, 'new') }));

    if (doc.overlapInfo?.count) {
      const to = await overlapRecipients([doc.bureau, ...doc.overlapInfo.bureaus], [doc.complaintId, ...(doc.overlapInfo.caseIds || [])]);
      if (to.length) jobs.push(sendMail({ to, ...tplOverlap(doc, doc.overlapInfo) }));
    }
    const results = await Promise.all(jobs);
    return { ok: results.every((r) => r.ok), sent: results.filter((r) => r.ok).length };
  });
}

/** kind: 'assigned' | 'transferred' | 'escalated'. Mails whoever now holds the case. */
export async function notifyAssignee(c, kind) {
  return safe(`assignee (${kind})`, async () => {
    const u = await emailOf(c.assignedTo);
    return u ? sendMail({ to: u.email, ...tplAssigned(c, kind) }) : { ok: false, skipped: 'No assignee.' };
  });
}

/** Resolved / Closed: tell the complainant. */
export async function notifyOutcome(c) {
  return safe('outcome', async () => (c.complainantEmail ? sendMail({ to: c.complainantEmail, ...tplOutcome(c) }) : { ok: false, skipped: 'No email.' }));
}

/** Escalation-engine results (items carry assigneeId). */
export async function notifyEscalations(items) {
  return safe('escalations', async () => {
    let sent = 0;
    for (const it of items) {
      if (!it.assigneeId) continue;
      const c = await Complaint.findOne({ complaintId: it.complaintId }).lean();
      const u = await emailOf(it.assigneeId);
      if (!c || !u) continue;
      const r = await sendMail({ to: u.email, ...tplAssigned(c, 'escalated') });
      if (r.ok) sent++;
    }
    return { ok: true, sent };
  });
}

/**
 * One digest per assignee: cases past their timeline, due within 48 h, or still "New" after 48 h.
 * A case is included at most once every 24 hours (remindedAt).
 */
export async function sendDueReminders({ now = new Date() } = {}) {
  const r = await safe('reminders', async () => {
    const dueBy = new Date(now.getTime() + DUE_SOON_HOURS * HOUR);
    const stale = new Date(now.getTime() - PENDING_REMINDER_HOURS * HOUR);
    const notRecently = new Date(now.getTime() - 24 * HOUR);
    const cases = await Complaint.find({
      status: { $in: OPEN_STATUSES },
      assignedTo: { $ne: null },
      $and: [
        { $or: [{ slaDeadline: { $lte: dueBy } }, { status: 'New', createdAt: { $lte: stale } }] },
        { $or: [{ remindedAt: null }, { remindedAt: { $lte: notRecently } }] },
      ],
    })
      .select('complaintId title institution slaDeadline status createdAt assignedTo')
      .sort({ slaDeadline: 1 })
      .limit(500)
      .lean();
    if (!cases.length) return { ok: true, digests: 0, cases: 0 };

    const byUser = new Map();
    for (const c of cases) {
      const kind = c.slaDeadline && c.slaDeadline < now ? 'overdue' : c.slaDeadline && c.slaDeadline <= dueBy ? 'due_soon' : 'pending';
      const key = String(c.assignedTo);
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key).push({ kind, complaintId: c.complaintId, title: c.title, institution: c.institution, due: c.slaDeadline });
    }
    let digests = 0;
    const doneIds = [];
    for (const [userId, items] of byUser) {
      const u = await emailOf(userId);
      if (!u) continue;
      const res = await sendMail({ to: u.email, ...tplDigest(u.name, items.slice(0, 40)) });
      if (res.ok) {
        digests++;
        doneIds.push(...items.map((i) => i.complaintId));
      }
    }
    if (doneIds.length) await Complaint.updateMany({ complaintId: { $in: doneIds } }, { $set: { remindedAt: now } });
    return { ok: true, digests, cases: doneIds.length };
  });
  return r || { ok: false, skipped: 'Email is not configured.' };
}

/** Case moved to In Review / Hearing Scheduled (or reopened): tell the complainant. */
export async function notifyProgress(c) {
  return safe('progress', async () => (c.complainantEmail ? sendMail({ to: c.complainantEmail, ...tplProgress(c) }) : { ok: false, skipped: 'No email.' }));
}

/** Coordination recorded on an overlap: tell the head of every bureau involved. */
export async function notifyCoordinated(group, rec, by) {
  return safe('coordination', async () => {
    const heads = await User.find({ role: 'bureau_head', active: true, bureau: { $in: group.bureauNames } }).select('email').lean();
    if (!heads.length) return { ok: false, skipped: 'No bureau heads to notify.' };
    return sendMail({ to: heads.map((h) => h.email), ...tplCoordinated(group, rec, by) });
  });
}

/** One summary e-mail to every active Chairman Office account. Call this from the scheduled run only. */
export async function notifyChairmanSummary({ now = new Date() } = {}) {
  const r = await safe('chairman summary', async () => {
    const chairmen = await User.find({ role: 'chairman', active: true }).select('email name').lean();
    if (!chairmen.length) return { ok: true, sent: 0 };
    const [open, overdue, overlaps] = await Promise.all([
      Complaint.countDocuments({ status: { $in: OPEN_STATUSES } }),
      Complaint.countDocuments({ status: { $in: OPEN_STATUSES }, slaDeadline: { $lt: now } }),
      loadAllOverlaps(),
    ]);
    const required = overlaps.filter((g) => g.status === 'Coordination Required');
    const summary = { open, overdue, overlapsRequired: required.length, topOverlaps: required.slice(0, 5) };
    let sent = 0;
    for (const u of chairmen) {
      const res = await sendMail({ to: u.email, ...tplChairmanSummary(u.name, summary) });
      if (res.ok) sent++;
    }
    return { ok: true, sent };
  });
  return r || { ok: false, skipped: 'Email is not configured.' };
}
