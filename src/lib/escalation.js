// SLA escalation engine. Finds open complaints whose SLA deadline has passed and moves each
// one rung up the ladder: Case Officer -> Bureau Head -> Chairman Office, granting extra time.
import Complaint from '../models/Complaint.js';
import User from '../models/User.js';
import { ESCALATION_EXTENSION_HOURS, ESCALATION_LEVELS, OPEN_STATUSES } from './constants.js';
import { logAction } from './actions.js';

export async function runEscalation({ now = new Date(), actor = 'SLA Engine' } = {}) {
  const overdue = await Complaint.find({
    status: { $in: OPEN_STATUSES },
    slaDeadline: { $lt: now },
    escalationLevel: { $lt: 2 },
  });

  if (!overdue.length) return { checked: 0, escalated: 0, items: [] };

  const heads = await User.find({ role: 'bureau_head', active: true }).select('_id name bureau').lean();
  const chairman = await User.findOne({ role: 'chairman', active: true }).select('_id name').lean();

  const items = [];
  for (const c of overdue) {
    const next = c.escalationLevel + 1;
    const target = next === 1 ? heads.find((h) => h.bureau === c.bureau) : chairman;
    const extension = ESCALATION_EXTENSION_HOURS[next];

    c.escalationLevel = next;
    c.escalatedAt = now;
    c.slaDeadline = new Date(now.getTime() + extension * 3600 * 1000);
    if (target) {
      c.assignedTo = target._id;
      c.assignedToName = target.name;
    }
    c.nextAction = `Review the escalated case and decide the way forward (${ESCALATION_LEVELS[next]})`;
    c.nextActionDue = c.slaDeadline;
    logAction(c, {
      action: 'escalated',
      message: `SLA breached. Auto-escalated to ${ESCALATION_LEVELS[next]}${target ? ` (${target.name})` : ''}. New deadline: ${extension}h.`,
      by: actor,
      byRole: 'system',
      at: now,
      visibility: 'public',
    });
    await c.save();
    items.push({
      complaintId: c.complaintId,
      title: c.title,
      institution: c.institution,
      priority: c.priority,
      level: next,
      escalatedTo: ESCALATION_LEVELS[next],
      assignee: target ? target.name : null,
      assigneeId: target ? target._id : null,
    });
  }
  return { checked: overdue.length, escalated: items.length, items };
}

// Optional lazy trigger (AUTO_ESCALATE=true): run the engine at most once every 5 minutes
// when someone opens the dashboard. Vercel Cron + the manual button remain the primary triggers.
export async function maybeAutoEscalate() {
  if (process.env.AUTO_ESCALATE !== 'true') return null;
  const g = globalThis;
  const last = g.__nsLastEscalationRun || 0;
  if (Date.now() - last < 5 * 60 * 1000) return null;
  g.__nsLastEscalationRun = Date.now();
  return runEscalation({});
}
