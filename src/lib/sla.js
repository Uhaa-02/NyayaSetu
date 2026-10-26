// Pure SLA helpers - safe for server, browser and scripts.
import { SLA_HOURS, OPEN_STATUSES } from './constants.js';

const HOUR = 3600 * 1000;

export function computeDeadline(priority, from = new Date()) {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.Medium;
  return new Date(new Date(from).getTime() + hours * HOUR);
}

/**
 * Returns { state, hoursLeft, label }
 *  state: 'done' | 'overdue' | 'due_soon' | 'on_track'
 */
export function slaState(c, now = new Date()) {
  if (!c || !c.slaDeadline) return { state: 'on_track', hoursLeft: null, label: '-' };
  if (!OPEN_STATUSES.includes(c.status)) {
    return { state: 'done', hoursLeft: null, label: c.status };
  }
  const hoursLeft = (new Date(c.slaDeadline).getTime() - new Date(now).getTime()) / HOUR;
  const totalHours = SLA_HOURS[c.priority] ?? 336;
  if (hoursLeft < 0) {
    return { state: 'overdue', hoursLeft, label: `Overdue ${formatDuration(-hoursLeft)}` };
  }
  if (hoursLeft <= Math.max(12, totalHours * 0.2)) {
    return { state: 'due_soon', hoursLeft, label: `Due in ${formatDuration(hoursLeft)}` };
  }
  return { state: 'on_track', hoursLeft, label: `${formatDuration(hoursLeft)} left` };
}

export function formatDuration(hours) {
  const h = Math.abs(hours);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}
