// Cross-bureau overlap detection (pure, no database).
//
// An "overlap" exists when open complaints about the SAME institution (same AICTE Permanent ID,
// however the complainants spelled its name) are being handled by two or more different
// bureaus / cells, for example Regulation Bureau (RB) and Public Grievance Redressal Cell (PGRC).
// Officials then see "Potential Overlapping Cases – Coordination Required".
import { BUREAU_SHORT, OPEN_STATUSES, PRIORITY_RANK } from './constants.js';

const HOUR = 3600 * 1000;
const RANK_NAME = { 4: 'Critical', 3: 'High', 2: 'Medium', 1: 'Low' };

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * @param rows     complaint rows with: complaintId, title, category, status, priority, bureau,
 *                 assignedToName, institutionId, institution, state, region, slaDeadline, linkedCases
 * @param opts.records  OverlapRecord rows ({institutionId, bureausAtCoordination, leadBureau, note, ...})
 * @returns groups sorted: "Coordination Required" first, then by severity
 */
export function detectOverlaps(rows, { records = [], now = new Date() } = {}) {
  const t = new Date(now).getTime();
  const recordByInst = new Map(records.map((r) => [r.institutionId, r]));
  const byInst = new Map();

  for (const r of rows) {
    if (!r.institutionId || !OPEN_STATUSES.includes(r.status)) continue;
    (byInst.get(r.institutionId) || byInst.set(r.institutionId, []).get(r.institutionId)).push(r);
  }

  const groups = [];
  for (const [institutionId, cases] of byInst) {
    const bureauNames = [...new Set(cases.map((c) => c.bureau))];
    if (bureauNames.length < 2) continue;

    const bureaus = bureauNames
      .map((bureau) => {
        const mine = cases.filter((c) => c.bureau === bureau);
        return {
          bureau,
          short: BUREAU_SHORT[bureau] || bureau,
          count: mine.length,
          officers: [...new Set(mine.map((c) => c.assignedToName).filter(Boolean))],
          cases: mine
            .map((c) => ({
              complaintId: c.complaintId,
              title: c.title,
              category: c.category,
              status: c.status,
              priority: c.priority,
              assignedToName: c.assignedToName || '',
              slaDeadline: c.slaDeadline,
              overdue: Boolean(c.slaDeadline && new Date(c.slaDeadline).getTime() < t),
              createdAt: c.createdAt,
            }))
            .sort((a, b) => (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0)),
        };
      })
      .sort((a, b) => b.count - a.count);

    // Has each pair of bureaus been mapped to each other by officers (at least one linked case pair)?
    let crossPairs = 0;
    let linkedPairs = 0;
    for (let i = 0; i < bureauNames.length; i++) {
      for (let j = i + 1; j < bureauNames.length; j++) {
        crossPairs++;
        const A = cases.filter((c) => c.bureau === bureauNames[i]);
        const B = cases.filter((c) => c.bureau === bureauNames[j]);
        const linked = A.some((a) => B.some((b) => (a.linkedCases || []).includes(b.complaintId) || (b.linkedCases || []).includes(a.complaintId)));
        if (linked) linkedPairs++;
      }
    }

    const maxRank = Math.max(...cases.map((c) => PRIORITY_RANK[c.priority] || 1));
    const overdue = cases.filter((c) => c.slaDeadline && new Date(c.slaDeadline).getTime() < t).length;
    const hasPair = bureauNames.includes('Regulation Bureau') && bureauNames.includes('Public Grievance Redressal Cell');
    const score = bureauNames.length * 2 + cases.length + (hasPair ? 2 : 0) + overdue * 2 + (maxRank >= 3 ? 3 : 0);

    const rec = recordByInst.get(institutionId);
    // a coordination note only counts while it covers every bureau that is involved now
    const coordinated = Boolean(rec && bureauNames.every((b) => (rec.bureausAtCoordination || []).includes(b)));

    const first = cases[0];
    groups.push({
      institutionId,
      institution: first.institution,
      state: first.state,
      region: first.region,
      bureaus,
      bureauNames,
      bureauCount: bureauNames.length,
      caseCount: cases.length,
      hasRbPgrc: hasPair,
      maxPriority: RANK_NAME[maxRank],
      overdue,
      crossPairs,
      linkedPairs,
      allLinked: crossPairs > 0 && linkedPairs === crossPairs,
      score,
      severity: score >= 14 ? 'High' : score >= 9 ? 'Medium' : 'Low',
      status: coordinated ? 'Coordinated' : 'Coordination Required',
      record: rec
        ? {
            leadBureau: rec.leadBureau,
            note: rec.note,
            coordinatedBy: rec.coordinatedBy,
            coordinatedAt: rec.coordinatedAt,
            stale: !coordinated, // a new bureau joined after the last coordination
          }
        : null,
    });
  }

  return groups.sort(
    (a, b) =>
      (a.status === 'Coordinated') - (b.status === 'Coordinated') || b.score - a.score || a.institution.localeCompare(b.institution)
  );
}

/** Which overlap groups a staff member may see. */
export function groupsVisibleTo(groups, session) {
  if (!session || session.role === 'chairman') return groups;
  if (session.role === 'regional') return groups.filter((g) => g.region === session.region);
  return groups.filter((g) => g.bureauNames.includes(session.bureau));
}

/** Plain-language one-liner, e.g. "RB (2 cases) and PGRC (1 case)". */
export function describeBureaus(group) {
  const parts = group.bureaus.map((b) => `${b.short} (${b.count} case${b.count === 1 ? '' : 's'})`);
  return parts.length <= 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export { HOUR };
