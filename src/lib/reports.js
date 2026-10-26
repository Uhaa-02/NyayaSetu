// Report builder (pure). Every report is { title, subtitle, columns, rows } so the same data can be
// shown on screen, printed to PDF from the browser, or downloaded as CSV.
import {
  BUREAUS,
  CATEGORIES,
  DONE_STATUSES,
  OPEN_STATUSES,
  PENDING_STATUSES,
  PROCESS_STATUSES,
  REGIONS,
  STATUSES,
  shortBureau,
} from './constants.js';
import { describeBureaus } from './overlap.js';

const DAY = 24 * 3600 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const round1 = (n) => Math.round(n * 10) / 10;
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export const REPORT_TYPES = [
  { id: 'bureau', label: 'Bureau / Cell-wise' },
  { id: 'region', label: 'Region-wise' },
  { id: 'institution', label: 'Institution-wise' },
  { id: 'status', label: 'Status-wise' },
  { id: 'category', label: 'Category-wise' },
  { id: 'ageing', label: 'Pending case ageing' },
  { id: 'overlap', label: 'Overlapping cases' },
  { id: 'monthly', label: 'Monthly performance' },
  { id: 'quarterly', label: 'Quarterly performance' },
];

const col = (key, label, align = 'right') => ({ key, label, align });

function isOpen(r) {
  return OPEN_STATUSES.includes(r.status);
}
function isDone(r) {
  return DONE_STATUSES.includes(r.status);
}
function days(r) {
  return r.resolvedAt ? (new Date(r.resolvedAt) - new Date(r.createdAt)) / DAY : null;
}

/** Counts shared by the bureau / region / institution reports. */
function summarise(list, now) {
  const t = now.getTime();
  const done = list.filter(isDone);
  const dur = done.map(days).filter((d) => d !== null);
  const withinSla = done.filter((r) => r.resolvedAt && r.originalDeadline && new Date(r.resolvedAt) <= new Date(r.originalDeadline)).length;
  const slaBase = done.filter((r) => r.resolvedAt && r.originalDeadline).length;
  return {
    received: list.length,
    pending: list.filter((r) => PENDING_STATUSES.includes(r.status)).length,
    underProcess: list.filter((r) => PROCESS_STATUSES.includes(r.status)).length,
    disposed: done.length,
    transferred: list.filter((r) => (r.transferCount || 0) > 0).length,
    escalated: list.filter((r) => isOpen(r) && r.escalationLevel > 0).length,
    overdue: list.filter((r) => isOpen(r) && r.slaDeadline && new Date(r.slaDeadline).getTime() < t).length,
    disposalRate: pct(done.length, list.length),
    avgDays: round1(avg(dur)),
    slaCompliance: pct(withinSla, slaBase),
  };
}

const SUMMARY_COLS = [
  col('received', 'Received'),
  col('pending', 'Pending'),
  col('underProcess', 'Under process'),
  col('disposed', 'Disposed'),
  col('transferred', 'Transferred'),
  col('escalated', 'Escalated'),
  col('overdue', 'Beyond timeline'),
  col('disposalRate', 'Disposal rate %'),
  col('avgDays', 'Avg days to dispose'),
];

function inRange(rows, from, to) {
  const f = from ? new Date(from).getTime() : -Infinity;
  const tt = to ? new Date(to).getTime() + DAY - 1 : Infinity; // include the whole "to" day
  return rows.filter((r) => {
    const c = new Date(r.createdAt).getTime();
    return c >= f && c <= tt;
  });
}

function periods(now, kind) {
  const out = [];
  if (kind === 'monthly') {
    for (let i = 11; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ label: `${MONTHS[s.getMonth()]} ${s.getFullYear()}`, start: s, end: new Date(s.getFullYear(), s.getMonth() + 1, 1) });
    }
  } else {
    const q = Math.floor(now.getMonth() / 3);
    for (let i = 5; i >= 0; i--) {
      const idx = q - i;
      const year = now.getFullYear() + Math.floor(idx / 4);
      const quarter = ((idx % 4) + 4) % 4;
      out.push({
        label: `Q${quarter + 1} ${year} (${MONTHS[quarter * 3]}-${MONTHS[quarter * 3 + 2]})`,
        start: new Date(year, quarter * 3, 1),
        end: new Date(year, quarter * 3 + 3, 1),
      });
    }
  }
  return out;
}

/**
 * @param type     one of REPORT_TYPES ids
 * @param rows     complaint rows the viewer may see
 * @param opts     { from, to, now, overlaps }
 */
export function buildReport(type, rows, { from, to, now = new Date(), overlaps = [] } = {}) {
  const scoped = type === 'monthly' || type === 'quarterly' || type === 'overlap' ? rows : inRange(rows, from, to);
  const range = from || to ? `Filed ${from || 'start'} to ${to || 'today'}` : 'All dates';

  switch (type) {
    case 'bureau': {
      const data = BUREAUS.map((b) => ({ name: `${b} (${shortBureau(b)})`, ...summarise(scoped.filter((r) => r.bureau === b), now) })).filter((r) => r.received);
      return { title: 'Bureau / Cell-wise report', subtitle: `${range}. Cases currently held by each bureau or cell.`, columns: [col('name', 'Bureau / cell', 'left'), ...SUMMARY_COLS], rows: data };
    }
    case 'region': {
      const data = REGIONS.map((g) => ({ name: g, ...summarise(scoped.filter((r) => r.region === g), now) })).filter((r) => r.received);
      return { title: 'Region-wise report', subtitle: range, columns: [col('name', 'Region', 'left'), ...SUMMARY_COLS], rows: data };
    }
    case 'institution': {
      const m = new Map();
      for (const r of scoped) (m.get(r.institutionId || r.institution) || m.set(r.institutionId || r.institution, []).get(r.institutionId || r.institution)).push(r);
      const overlapIds = new Set(overlaps.map((g) => g.institutionId));
      const data = [...m.values()]
        .map((list) => ({
          id: list[0].institutionId || '-',
          name: list[0].institution,
          state: list[0].state,
          region: list[0].region,
          bureaus: [...new Set(list.filter(isOpen).map((r) => shortBureau(r.bureau)))].join(', ') || '-',
          overlap: list[0].institutionId && overlapIds.has(list[0].institutionId) ? 'Yes' : 'No',
          ...summarise(list, now),
        }))
        .sort((a, b) => b.received - a.received || a.name.localeCompare(b.name));
      return {
        title: 'Institution-wise complaint report',
        subtitle: `${range}. Consolidated history per institution, across all bureaus.`,
        columns: [
          col('id', 'AICTE ID', 'left'),
          col('name', 'Institution', 'left'),
          col('state', 'State', 'left'),
          col('region', 'Region', 'left'),
          col('received', 'Received'),
          col('pending', 'Pending'),
          col('underProcess', 'Under process'),
          col('disposed', 'Disposed'),
          col('overdue', 'Beyond timeline'),
          col('bureaus', 'Bureaus with open cases', 'left'),
          col('overlap', 'Overlap', 'left'),
        ],
        rows: data,
      };
    }
    case 'status': {
      const t = now.getTime();
      const data = STATUSES.map((s) => {
        const list = scoped.filter((r) => r.status === s);
        return {
          name: s,
          count: list.length,
          share: pct(list.length, scoped.length),
          avgAge: round1(avg(list.map((r) => (t - new Date(r.createdAt)) / DAY))),
          overdue: list.filter((r) => isOpen(r) && r.slaDeadline && new Date(r.slaDeadline).getTime() < t).length,
        };
      });
      data.push({
        name: 'Transferred between bureaus (any status)',
        count: scoped.filter((r) => (r.transferCount || 0) > 0).length,
        share: pct(scoped.filter((r) => (r.transferCount || 0) > 0).length, scoped.length),
        avgAge: '',
        overdue: '',
      });
      data.push({
        name: 'Escalated (open)',
        count: scoped.filter((r) => isOpen(r) && r.escalationLevel > 0).length,
        share: pct(scoped.filter((r) => isOpen(r) && r.escalationLevel > 0).length, scoped.length),
        avgAge: '',
        overdue: '',
      });
      return {
        title: 'Status-wise report',
        subtitle: range,
        columns: [col('name', 'Status', 'left'), col('count', 'Cases'), col('share', 'Share %'), col('avgAge', 'Avg age (days)'), col('overdue', 'Beyond timeline')],
        rows: data,
      };
    }
    case 'category': {
      const data = CATEGORIES.map((c) => ({ name: c, ...summarise(scoped.filter((r) => r.category === c), now) })).filter((r) => r.received);
      return { title: 'Category-wise report', subtitle: range, columns: [col('name', 'Category', 'left'), ...SUMMARY_COLS], rows: data };
    }
    case 'ageing': {
      const t = now.getTime();
      const buckets = [
        ['0-7 days', 0, 7],
        ['8-15 days', 7, 15],
        ['16-30 days', 15, 30],
        ['31-60 days', 30, 60],
        ['60+ days', 60, Infinity],
      ];
      const open = scoped.filter(isOpen);
      const data = BUREAUS.map((b) => {
        const mine = open.filter((r) => r.bureau === b);
        const row = { name: `${b} (${shortBureau(b)})`, total: mine.length };
        for (const [label, lo, hi] of buckets) {
          row[label] = mine.filter((r) => {
            const age = (t - new Date(r.createdAt)) / DAY;
            return age > lo - (lo === 0 ? 1 : 0) && age <= hi;
          }).length;
        }
        return row;
      }).filter((r) => r.total);
      return {
        title: 'Pending case ageing analysis',
        subtitle: `${range}. Open cases by days since filing.`,
        columns: [col('name', 'Bureau / cell', 'left'), ...buckets.map(([l]) => col(l, l)), col('total', 'Total open')],
        rows: data,
      };
    }
    case 'overlap': {
      const data = overlaps.map((g) => ({
        id: g.institutionId,
        name: g.institution,
        state: g.state,
        bureaus: describeBureaus(g),
        cases: g.caseCount,
        priority: g.maxPriority,
        severity: g.severity,
        status: g.status,
        lead: g.record?.leadBureau || '',
        note: g.record?.note || '',
      }));
      return {
        title: 'Overlapping / parallel cases report',
        subtitle: 'Institutions where two or more bureaus or cells have open cases at the same time.',
        columns: [
          col('id', 'AICTE ID', 'left'),
          col('name', 'Institution', 'left'),
          col('state', 'State', 'left'),
          col('bureaus', 'Bureaus involved', 'left'),
          col('cases', 'Open cases'),
          col('priority', 'Highest priority', 'left'),
          col('severity', 'Severity', 'left'),
          col('status', 'Status', 'left'),
          col('lead', 'Lead bureau', 'left'),
          col('note', 'Coordination note', 'left'),
        ],
        rows: data,
      };
    }
    case 'monthly':
    case 'quarterly': {
      const data = periods(now, type).map((p) => {
        const inP = (d) => d && new Date(d) >= p.start && new Date(d) < p.end;
        const received = rows.filter((r) => inP(r.createdAt));
        const disposed = rows.filter((r) => isDone(r) && inP(r.resolvedAt));
        const dur = disposed.map(days).filter((d) => d !== null);
        const okSla = disposed.filter((r) => r.originalDeadline && new Date(r.resolvedAt) <= new Date(r.originalDeadline)).length;
        return {
          name: p.label,
          received: received.length,
          disposed: disposed.length,
          net: received.length - disposed.length,
          clearance: pct(disposed.length, received.length),
          avgDays: round1(avg(dur)),
          slaCompliance: pct(okSla, disposed.length),
          escalations: rows.filter((r) => inP(r.escalatedAt)).length,
          transfers: rows.filter((r) => (r.transfers || []).some((x) => inP(x.at))).length,
        };
      });
      return {
        title: type === 'monthly' ? 'Monthly performance report' : 'Quarterly performance report',
        subtitle: 'Clearance rate = disposed in the period / received in the period. Escalation counts show the latest escalation of each case.',
        columns: [
          col('name', 'Period', 'left'),
          col('received', 'Received'),
          col('disposed', 'Disposed'),
          col('net', 'Net change in backlog'),
          col('clearance', 'Clearance rate %'),
          col('avgDays', 'Avg days to dispose'),
          col('slaCompliance', 'Disposed within timeline %'),
          col('escalations', 'Escalated'),
          col('transfers', 'Transferred'),
        ],
        rows: data,
      };
    }
    default:
      return null;
  }
}
