// Core business logic for creating complaints: validation, AI triage, duplicate detection,
// routing to a bureau, load-balanced assignment and SLA deadline.
import Complaint from '../models/Complaint.js';
import Counter from '../models/Counter.js';
import Institution from '../models/Institution.js';
import User from '../models/User.js';
import {
  CATEGORY_TO_BUREAU,
  OPEN_STATUSES,
  OVERLAP_MESSAGE,
  PRIORITY_RANK,
  SLA_HOURS,
  STATE_REGION,
  shortBureau,
} from './constants.js';
import { analyzeComplaint, similarity, tokenize, DUPLICATE_THRESHOLD } from './classify.js';
import { computeDeadline } from './sla.js';
import { defaultNextAction } from './actions.js';
import { matchInstitution, normaliseInstitution, prepareRegistry } from './institutions.js';
import { validateComplaintInput } from './validation.js';

export { normaliseInstitution, validateComplaintInput };

/**
 * Finds the registry record for a complaint's institution (by Permanent ID or by name matching).
 * If nothing matches, an "unverified" record is created so the case can still be grouped by institution.
 */
export async function resolveInstitution(value) {
  const registry = prepareRegistry(
    await Institution.find({}).select('permanentId name state region city address type verified').lean()
  );
  const text = value.institutionId ? `${value.institutionId} ${value.institution}` : value.institution;
  const hit = matchInstitution(text, registry, { state: value.state });
  if (hit) return { institution: hit.institution, matched: hit.method, score: hit.score, created: false };

  const c = await Counter.findOneAndUpdate({ _id: 'institution-unverified' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  const created = await Institution.create({
    permanentId: `UNV-${String(c.seq).padStart(5, '0')}`,
    name: value.institution,
    key: normaliseInstitution(value.institution),
    state: value.state,
    region: STATE_REGION[value.state],
    verified: false,
  });
  return { institution: created.toObject(), matched: 'new', score: 0, created: true };
}

export async function nextComplaintId(date = new Date()) {
  const year = date.getFullYear();
  const c = await Counter.findOneAndUpdate(
    { _id: `complaint-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `NS-${year}-${String(c.seq).padStart(6, '0')}`;
}

/** Least-loaded active officer of the bureau (falls back to the bureau head). */
export async function pickAssignee(bureau) {
  const officers = await User.find({ bureau, role: 'officer', active: true }).select('_id name').lean();
  if (!officers.length) {
    return (await User.findOne({ bureau, role: 'bureau_head', active: true }).select('_id name').lean()) || null;
  }
  const loads = await Complaint.aggregate([
    { $match: { assignedTo: { $in: officers.map((o) => o._id) }, status: { $in: OPEN_STATUSES } } },
    { $group: { _id: '$assignedTo', n: { $sum: 1 } } },
  ]);
  const map = new Map(loads.map((l) => [String(l._id), l.n]));
  officers.sort((a, b) => (map.get(String(a._id)) || 0) - (map.get(String(b._id)) || 0));
  return officers[0];
}

/**
 * Creates a fully triaged complaint.
 * @param value  output of validateComplaintInput().value
 */
export async function createComplaint(value, { source = 'Web Form', actor = 'Complainant', actorRole = 'citizen' } = {}) {
  const now = new Date();

  // 0) data matching: which institution is this really about? (spelling-proof, ID-based)
  const match = await resolveInstitution(value);
  const inst = match.institution;
  const asEntered = value.institution;
  value = { ...value, institution: inst.name };
  const institutionKey = normaliseInstitution(inst.name);

  // 1) triage (repeat-institution factor feeds the priority score)
  const openCount = await Complaint.countDocuments({ institutionKey, status: { $in: OPEN_STATUSES } });
  const analysis = await analyzeComplaint(value, { repeatCount: openCount });

  // 2) duplicate detection against recent complaints about the same institution
  const since = new Date(now.getTime() - 120 * 24 * 3600 * 1000);
  const recent = await Complaint.find({ institutionKey, createdAt: { $gte: since } })
    .select('complaintId title description')
    .sort({ createdAt: -1 })
    .limit(60)
    .lean();
  const tokens = tokenize(`${value.title} ${value.description}`);
  let best = { id: null, score: 0 };
  for (const r of recent) {
    const s = similarity(tokens, tokenize(`${r.title} ${r.description}`));
    if (s > best.score) best = { id: r.complaintId, score: s };
  }
  const isDuplicate = best.score >= DUPLICATE_THRESHOLD;

  // 3) routing + assignment + SLA
  const bureau = CATEGORY_TO_BUREAU[analysis.category];
  const assignee = await pickAssignee(bureau);
  const complaintId = await nextComplaintId(now);
  const slaHours = SLA_HOURS[analysis.priority];
  const deadline = computeDeadline(analysis.priority, now);

  // 3b) cross-bureau overlap: is another bureau/cell already dealing with this institution?
  const others = await Complaint.find({
    institutionId: inst.permanentId,
    status: { $in: OPEN_STATUSES },
    bureau: { $ne: bureau },
  })
    .select('complaintId bureau assignedToName')
    .limit(20)
    .lean();
  const overlapBureaus = [...new Set(others.map((o) => o.bureau))];

  const pct = (n) => Math.round(n * 100);
  const timeline = [
    {
      action: 'created',
      message: `Complaint received via ${source}.`,
      by: actor,
      byRole: actorRole,
      at: now,
      visibility: 'public',
    },
    {
      action: 'classified',
      message: `Auto-triage (${analysis.classifiedBy === 'llm' ? 'AI model + rules' : 'rule engine'}): ${analysis.category}, ${analysis.priority} priority (score ${analysis.priorityScore}/100, confidence ${pct(analysis.aiConfidence)}%).`,
      at: now,
      visibility: 'internal',
    },
    {
      action: 'assigned',
      message: `Routed to ${bureau} for review.`,
      at: now,
      visibility: 'public',
    },
  ];
  if (assignee) {
    timeline.push({
      action: 'assigned',
      message: `Auto-assigned to ${assignee.name} (lowest open workload). SLA: ${Math.round(slaHours / 24)} days.`,
      at: now,
      visibility: 'internal',
    });
  }
  if (match.matched === 'fuzzy' || (match.matched === 'id' && asEntered)) {
    timeline.push({
      action: 'classified',
      message: `Institution matched to ${inst.name} (AICTE ID ${inst.permanentId}) from "${asEntered}" (${match.matched === 'id' ? 'Permanent ID' : `name match ${Math.round(match.score * 100)}%`}).`,
      at: now,
      visibility: 'internal',
    });
  }
  if (match.created) {
    timeline.push({
      action: 'classified',
      message: `Institution not found in the registry. Created unverified record ${inst.permanentId}; please verify the AICTE Permanent ID.`,
      at: now,
      visibility: 'internal',
    });
  }
  if (others.length) {
    timeline.push({
      action: 'overlap',
      message: `${OVERLAP_MESSAGE}: ${inst.name} also has open case(s) with ${overlapBureaus.map(shortBureau).join(', ')} (${others
        .slice(0, 4)
        .map((o) => o.complaintId)
        .join(', ')}).`,
      at: now,
      visibility: 'internal',
    });
  }
  if (isDuplicate) {
    timeline.push({
      action: 'duplicate',
      message: `Possible duplicate of ${best.id} (${pct(best.score)}% text similarity). Review and link if appropriate.`,
      at: now,
      visibility: 'internal',
    });
  }

  const next = defaultNextAction('New', now);
  const { institutionId: _typedId, documentUrl, ...rest } = value; // typed ID only guides matching
  const doc = await Complaint.create({
    complaintId,
    ...rest,
    institutionId: inst.permanentId,
    institutionAsEntered: asEntered && asEntered !== inst.name ? asEntered : '',
    institutionKey,
    region: inst.region || STATE_REGION[value.state],
    lastAction: `Complaint received and routed to ${bureau}.`,
    lastActionAt: now,
    lastActionBy: actor,
    nextAction: next.text,
    nextActionDue: next.due,
    documents: documentUrl ? [{ name: 'Document provided by complainant', url: documentUrl, addedBy: actor, at: now }] : [],
    category: analysis.category,
    priority: analysis.priority,
    priorityRank: PRIORITY_RANK[analysis.priority],
    priorityScore: analysis.priorityScore,
    aiTags: analysis.aiTags,
    aiSummary: analysis.aiSummary,
    aiConfidence: analysis.aiConfidence,
    classifiedBy: analysis.classifiedBy,
    status: 'New',
    bureau,
    assignedTo: assignee ? assignee._id : null,
    assignedToName: assignee ? assignee.name : '',
    source,
    slaHours,
    originalDeadline: deadline,
    slaDeadline: deadline,
    escalationLevel: 0,
    duplicateOf: isDuplicate ? best.id : null,
    duplicateScore: isDuplicate ? Number(best.score.toFixed(2)) : 0,
    timeline,
  });

  // tell the other bureaus' cases about the new parallel case (audit trail on both sides)
  if (others.length) {
    await Complaint.updateMany(
      { complaintId: { $in: others.map((o) => o.complaintId) } },
      {
        $push: {
          timeline: {
            action: 'overlap',
            message: `${OVERLAP_MESSAGE}: new case ${complaintId} about ${inst.name} was routed to ${shortBureau(bureau)}.`,
            by: 'System',
            byRole: 'system',
            at: now,
            visibility: 'internal',
          },
        },
        $set: { lastAction: `Overlap alert: new case ${complaintId} with ${shortBureau(bureau)}`, lastActionAt: now, lastActionBy: 'System' },
      }
    );
  }

  doc.overlapInfo = others.length
    ? { count: others.length, bureaus: overlapBureaus, caseIds: others.map((o) => o.complaintId) }
    : null;
  doc.institutionInfo = { permanentId: inst.permanentId, name: inst.name, matched: match.matched, created: match.created };
  return doc;
}
