// Pure analytics over a list of complaint rows. No DB access, so it is unit-testable and
// can run over whatever slice of data the current user is allowed to see.
import {
  BUREAUS,
  CATEGORIES,
  OPEN_STATUSES,
  DONE_STATUSES,
  PENDING_STATUSES,
  PRIORITIES,
  PROCESS_STATUSES,
  REGIONS,
  STATUSES,
} from './constants.js';

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const round1 = (n) => Math.round(n * 10) / 10;
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

function countBy(rows, key, order) {
  const m = new Map();
  for (const r of rows) m.set(r[key], (m.get(r[key]) || 0) + 1);
  const names = order || [...m.keys()];
  return names.map((name) => ({ name, value: m.get(name) || 0 }));
}

export function computeAnalytics(rows, now = new Date()) {
  const t = now.getTime();
  const isOpen = (r) => OPEN_STATUSES.includes(r.status);
  const isDone = (r) => DONE_STATUSES.includes(r.status);
  const isOverdue = (r) => isOpen(r) && r.slaDeadline && new Date(r.slaDeadline).getTime() < t;

  const open = rows.filter(isOpen);
  const done = rows.filter(isDone);
  const overdue = rows.filter(isOverdue);

  const resolutionDays = done
    .filter((r) => r.resolvedAt)
    .map((r) => (new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime()) / DAY);

  const withinSla = done.filter(
    (r) => r.resolvedAt && r.originalDeadline && new Date(r.resolvedAt) <= new Date(r.originalDeadline)
  ).length;
  const doneWithDates = done.filter((r) => r.resolvedAt && r.originalDeadline).length;

  const kpis = {
    total: rows.length,
    pending: rows.filter((r) => PENDING_STATUSES.includes(r.status)).length,
    underProcess: rows.filter((r) => PROCESS_STATUSES.includes(r.status)).length,
    disposed: done.length,
    transferred: rows.filter((r) => (r.transferCount || 0) > 0).length,
    open: open.length,
    resolved: done.length,
    overdue: overdue.length,
    escalated: open.filter((r) => r.escalationLevel > 0).length,
    criticalOpen: open.filter((r) => r.priority === 'Critical').length,
    avgResolutionDays: round1(avg(resolutionDays)),
    resolutionRate: rows.length ? Math.round((done.length / rows.length) * 100) : 0,
    slaCompliance: doneWithDates ? Math.round((withinSla / doneWithDates) * 100) : 0,
    dueSoon: open.filter((r) => {
      if (!r.slaDeadline || isOverdue(r)) return false;
      return (new Date(r.slaDeadline).getTime() - t) / HOUR <= 24;
    }).length,
  };

  // ---- distributions
  const byStatus = countBy(rows, 'status', STATUSES);
  const byPriority = countBy(open, 'priority', PRIORITIES); // open workload by priority
  const byCategory = countBy(rows, 'category', CATEGORIES)
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  // ---- bureau performance
  const byBureau = BUREAUS.map((bureau) => {
    const mine = rows.filter((r) => r.bureau === bureau);
    const mineDone = mine.filter((r) => isDone(r) && r.resolvedAt);
    return {
      bureau,
      total: mine.length,
      open: mine.filter(isOpen).length,
      pending: mine.filter((r) => PENDING_STATUSES.includes(r.status)).length,
      underProcess: mine.filter((r) => PROCESS_STATUSES.includes(r.status)).length,
      transferred: mine.filter((r) => (r.transferCount || 0) > 0).length,
      escalated: mine.filter((r) => isOpen(r) && r.escalationLevel > 0).length,
      overdue: mine.filter(isOverdue).length,
      resolved: mine.filter(isDone).length,
      avgResolutionDays: round1(
        avg(mineDone.map((r) => (new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime()) / DAY))
      ),
    };
  }).filter((b) => b.total > 0);

  // ---- monthly trend (last 6 calendar months)
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const inMonth = (x) => x && new Date(x) >= d && new Date(x) < next;
    trend.push({
      month: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      received: rows.filter((r) => inMonth(r.createdAt)).length,
      resolved: rows.filter((r) => inMonth(r.resolvedAt)).length,
    });
  }

  // ---- geography
  const byState = countBy(rows, 'state')
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const matrix = REGIONS.map((region) =>
    CATEGORIES.map((cat) => rows.filter((r) => r.region === region && r.category === cat).length)
  );
  const heatmap = {
    regions: REGIONS,
    categories: CATEGORIES,
    cells: matrix,
    max: Math.max(1, ...matrix.flat()),
  };

  // ---- repeat-offender institutions
  const inst = new Map();
  for (const r of rows) {
    const k = r.institutionId || r.institution;
    const e = inst.get(k) || {
      institutionId: r.institutionId || null,
      institution: r.institution,
      state: r.state,
      total: 0,
      open: 0,
      pending: 0,
      underProcess: 0,
      disposed: 0,
      overdue: 0,
      critical: 0,
    };
    e.total += 1;
    if (isOpen(r)) e.open += 1;
    if (PENDING_STATUSES.includes(r.status)) e.pending += 1;
    if (PROCESS_STATUSES.includes(r.status)) e.underProcess += 1;
    if (isDone(r)) e.disposed += 1;
    if (isOverdue(r)) e.overdue += 1;
    if (r.priority === 'Critical' || r.priority === 'High') e.critical += 1;
    inst.set(k, e);
  }
  const topInstitutions = [...inst.values()]
    .sort((a, b) => b.total - a.total || b.open - a.open)
    .slice(0, 8)
    .map((e) => ({ ...e, repeat: e.total >= 8 }));

  // ---- aging of open complaints
  const buckets = [
    { name: '0-7 days', max: 7, value: 0 },
    { name: '8-15 days', max: 15, value: 0 },
    { name: '16-30 days', max: 30, value: 0 },
    { name: '31-60 days', max: 60, value: 0 },
    { name: '60+ days', max: Infinity, value: 0 },
  ];
  for (const r of open) {
    const age = (t - new Date(r.createdAt).getTime()) / DAY;
    buckets.find((b) => age <= b.max).value += 1;
  }
  const aging = buckets.map(({ name, value }) => ({ name, value }));

  // ---- alerts: most overdue open complaints
  const alerts = overdue
    .map((r) => ({
      complaintId: r.complaintId,
      title: r.title,
      institution: r.institution,
      priority: r.priority,
      bureau: r.bureau,
      escalationLevel: r.escalationLevel,
      hoursOverdue: Math.round((t - new Date(r.slaDeadline).getTime()) / HOUR),
    }))
    .sort((a, b) => b.hoursOverdue - a.hoursOverdue)
    .slice(0, 8);

  return { kpis, byStatus, byPriority, byCategory, byBureau, trend, byState, heatmap, topInstitutions, aging, alerts };
}
