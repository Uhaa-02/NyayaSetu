// Logic for the PUBLIC "open dashboard" (no login). Pure functions: no database, no network.
//
// Privacy rule: the public board shows only what is safe for anyone to see:
// complaint ID, institution, category, bureau, region/state, a 3-way status and dates.
// It NEVER shows the complainant's name, e-mail, phone, the complaint title or text, staff names, or internal notes.
import { REGIONS, STATE_REGION, shortBureau } from './constants.js';

export const PAGE_SIZE = 20;
export const MAX_PAGE = 500;

// Three plain-language groups for the public, mapped from the internal 5-step status.
export const PUBLIC_STATUS = {
  New: 'unsolved',
  'In Review': 'progress',
  'Hearing Scheduled': 'progress',
  Resolved: 'solved',
  Closed: 'solved',
};
export const PUBLIC_LABELS = { unsolved: 'Unsolved', progress: 'In progress', solved: 'Solved' };
export const PUBLIC_BUCKETS = ['unsolved', 'progress', 'solved'];

export const bucketOf = (status) => PUBLIC_STATUS[status] || 'progress';

/** Internal statuses that belong to a public bucket. */
export const statusesFor = (bucket) => Object.keys(PUBLIC_STATUS).filter((s) => PUBLIC_STATUS[s] === bucket);

/** rows: [{ _id: <internal status>, n: <count> }] -> counts per public bucket. */
export function summarize(rows = []) {
  const out = { total: 0, unsolved: 0, progress: 0, solved: 0, solvedPct: 0 };
  for (const r of rows) {
    const n = Number(r.n) || 0;
    out[bucketOf(r._id)] += n;
    out.total += n;
  }
  out.solvedPct = out.total ? Math.round((out.solved / out.total) * 100) : 0;
  return out;
}

/** rows: [{ _id: { region, status }, n }] -> one summary per region, in the standard region order. */
export function summarizeByRegion(rows = []) {
  const map = new Map(REGIONS.map((r) => [r, summarize([])]));
  for (const r of rows) {
    const region = r._id?.region;
    if (!map.has(region)) continue;
    const s = map.get(region);
    const n = Number(r.n) || 0;
    s[bucketOf(r._id.status)] += n;
    s.total += n;
  }
  return REGIONS.map((region) => {
    const s = map.get(region);
    s.solvedPct = s.total ? Math.round((s.solved / s.total) * 100) : 0;
    return { region, ...s };
  });
}

/** Clean and validate query-string filters. Unknown values are ignored, never trusted. */
export function parseFilters(sp) {
  const get = (k) => String(sp?.get?.(k) ?? '').trim();
  let region = get('region');
  let state = get('state');
  if (!REGIONS.includes(region)) region = '';
  if (!STATE_REGION[state]) state = '';
  if (state) region = STATE_REGION[state]; // a state already implies its region
  let status = get('status');
  if (!PUBLIC_BUCKETS.includes(status)) status = '';
  const q = get('q').replace(/\s+/g, ' ').slice(0, 60);
  let page = parseInt(get('page'), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > MAX_PAGE) page = MAX_PAGE;
  return { region, state, status, q, page };
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mongo filter for region / state / search (status is added separately). */
export function baseFilter({ region, state, q }, { withRegion = true } = {}) {
  const f = {};
  if (withRegion && region) f.region = region;
  if (state) f.state = state;
  if (q) f.$or = [{ institution: { $regex: escapeRegex(q), $options: 'i' } }, { complaintId: { $regex: escapeRegex(q.toUpperCase()), $options: 'i' } }];
  return f;
}

/** One complaint -> the only fields the public may see. */
export function toPublicRow(c, now = new Date()) {
  const bucket = bucketOf(c.status);
  const filed = new Date(c.createdAt);
  const doneAt = c.closedAt || c.resolvedAt;
  const end = bucket === 'solved' && doneAt ? new Date(doneAt) : now;
  return {
    id: c.complaintId,
    institution: c.institution,
    state: c.state,
    region: c.region,
    category: c.category,
    bureau: shortBureau(c.bureau),
    status: bucket,
    statusLabel: PUBLIC_LABELS[bucket],
    filedAt: filed.toISOString(),
    days: Math.max(0, Math.round((end - filed) / 86400000)), // days taken (solved) or days open (otherwise)
  };
}

/** Mongo fields the public route is allowed to read. Keep this list short on purpose. */
export const PUBLIC_FIELDS = 'complaintId institution state region category bureau status createdAt resolvedAt closedAt';
