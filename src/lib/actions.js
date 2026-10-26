// Helpers that keep the "last action" / "next action" fields in step with the audit trail.
// Works on Mongoose documents (routes) and on plain objects (seed script).
import { DONE_STATUSES } from './constants.js';

const HOUR = 3600 * 1000;
const QUIET = new Set(['classified']); // system triage notes do not count as an "action taken"

/** Appends an entry to the timeline and records it as the case's last action. */
export function logAction(c, entry) {
  const e = { by: 'System', byRole: 'system', at: new Date(), visibility: 'internal', ...entry };
  c.timeline.push(e);
  if (!QUIET.has(e.action)) {
    c.lastAction = String(e.message).slice(0, 220);
    c.lastActionAt = e.at;
    c.lastActionBy = e.by || '';
  }
  return e;
}

/** Suggested "next action required" for a status. Returns { text, due } (due may be null). */
export function defaultNextAction(status, from = new Date()) {
  const at = (h) => new Date(new Date(from).getTime() + h * HOUR);
  switch (status) {
    case 'New':
      return { text: 'Acknowledge the complaint and verify the details', due: at(48) };
    case 'In Review':
      return { text: "Obtain the institution's written reply and supporting documents", due: at(24 * 7) };
    case 'Hearing Scheduled':
      return { text: 'Conduct the hearing and record the decision', due: at(24 * 5) };
    case 'Resolved':
      return { text: 'Confirm the outcome with the complainant, then close the case', due: at(24 * 7) };
    default:
      return DONE_STATUSES.includes(status) ? { text: '', due: null } : { text: '', due: null };
  }
}
