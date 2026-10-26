// Alerts and reminders (pure, computed on demand from current data - nothing to store or clean up).
//   overlap          Potential Overlapping Cases – Coordination Required
//   sla_breach       pending beyond the prescribed timeline
//   due_soon         approaching the prescribed timeline
//   pending_reminder case still "New" and untouched
//   escalation       case escalated up the ladder
//   duplicate        possible duplicate complaint
//   next_action      next action required is due / overdue
import { DUE_SOON_HOURS, OPEN_STATUSES, OVERLAP_MESSAGE, PENDING_REMINDER_HOURS } from './constants.js';
import { describeBureaus } from './overlap.js';
import { formatDuration } from './sla.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const SEV = { critical: 0, warning: 1, info: 2 };

export const ALERT_TYPES = {
  overlap: 'Overlapping cases',
  sla_breach: 'Timeline breached',
  due_soon: 'Approaching timeline',
  pending_reminder: 'Pending reminders',
  escalation: 'Escalations',
  next_action: 'Next action due',
  duplicate: 'Possible duplicates',
};

/**
 * @param rows      complaints the viewer may see (already scoped)
 * @param overlaps  overlap groups the viewer may see
 */
export function buildAlerts({ rows, overlaps = [], session, now = new Date() }) {
  const t = new Date(now).getTime();
  const items = [];
  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status));

  for (const g of overlaps) {
    if (g.status !== 'Coordination Required') continue;
    items.push({
      id: `overlap:${g.institutionId}`,
      type: 'overlap',
      severity: g.severity === 'High' || g.hasRbPgrc ? 'critical' : 'warning',
      title: `${OVERLAP_MESSAGE}`,
      detail: `${g.institution} - ${describeBureaus(g)} are handling open cases${g.record?.stale ? ' (a new bureau joined after the last coordination)' : ''}.`,
      href: `/overlaps?i=${encodeURIComponent(g.institutionId)}`,
      institutionId: g.institutionId,
      at: null,
      weight: g.score,
    });
  }

  for (const r of open) {
    const dl = r.slaDeadline ? new Date(r.slaDeadline).getTime() : null;
    const base = { complaintId: r.complaintId, href: `/complaints/${r.complaintId}` };
    const what = `${r.complaintId} - ${r.title}`;

    if (dl !== null && dl < t) {
      items.push({
        ...base,
        id: `sla:${r.complaintId}`,
        type: 'sla_breach',
        severity: 'critical',
        title: `Timeline breached by ${formatDuration((t - dl) / HOUR)}`,
        detail: `${what} (${r.priority}, ${r.institution})`,
        at: r.slaDeadline,
        weight: (t - dl) / HOUR,
      });
    } else if (dl !== null && (dl - t) / HOUR <= DUE_SOON_HOURS) {
      items.push({
        ...base,
        id: `due:${r.complaintId}`,
        type: 'due_soon',
        severity: 'warning',
        title: `Timeline ends in ${formatDuration((dl - t) / HOUR)}`,
        detail: `${what} (${r.priority}, ${r.institution})`,
        at: r.slaDeadline,
        weight: 1000 - (dl - t) / HOUR,
      });
    }

    if (r.status === 'New' && (t - new Date(r.createdAt).getTime()) / HOUR > PENDING_REMINDER_HOURS) {
      const days = Math.floor((t - new Date(r.createdAt).getTime()) / DAY);
      items.push({
        ...base,
        id: `pending:${r.complaintId}`,
        type: 'pending_reminder',
        severity: 'info',
        title: `Not yet picked up for ${days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : 'over 48 hours'}`,
        detail: `${what} - assigned to ${r.assignedToName || 'nobody yet'}`,
        at: r.createdAt,
        weight: days,
      });
    }

    if (r.escalationLevel > 0 && r.escalatedAt && t - new Date(r.escalatedAt).getTime() <= 7 * DAY) {
      const toChairman = r.escalationLevel === 2;
      // keep the chairman's list short: only cases that reached the Chairman Office
      if (!(session?.role === 'chairman' && !toChairman)) {
        items.push({
          ...base,
          id: `esc:${r.complaintId}`,
          type: 'escalation',
          severity: toChairman ? 'critical' : 'warning',
          title: `Escalated to ${toChairman ? 'Chairman Office' : 'Bureau Head'}`,
          detail: `${what} (${r.priority}, ${r.institution})`,
          at: r.escalatedAt,
          weight: r.escalationLevel * 100,
        });
      }
    }

    if (r.nextActionDue && r.nextAction) {
      const due = new Date(r.nextActionDue).getTime();
      if (due - t <= DAY && !(dl !== null && dl < t)) {
        items.push({
          ...base,
          id: `next:${r.complaintId}`,
          type: 'next_action',
          severity: due < t ? 'warning' : 'info',
          title: due < t ? `Next action overdue by ${formatDuration((t - due) / HOUR)}` : `Next action due in ${formatDuration((due - t) / HOUR)}`,
          detail: `${what} - ${r.nextAction}`,
          at: r.nextActionDue,
          weight: due < t ? (t - due) / HOUR : 0,
        });
      }
    }

    if (r.duplicateOf && t - new Date(r.createdAt).getTime() <= 14 * DAY) {
      items.push({
        ...base,
        id: `dup:${r.complaintId}`,
        type: 'duplicate',
        severity: 'info',
        title: `Possible duplicate of ${r.duplicateOf}`,
        detail: `${what} (${r.institution})`,
        at: r.createdAt,
        weight: 0,
      });
    }
  }

  items.sort((a, b) => SEV[a.severity] - SEV[b.severity] || b.weight - a.weight);

  const counts = { total: items.length, critical: 0 };
  for (const k of Object.keys(ALERT_TYPES)) counts[k] = 0;
  for (const i of items) {
    counts[i.type]++;
    if (i.severity === 'critical') counts.critical++;
  }
  return { items, counts };
}
