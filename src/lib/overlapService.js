// Database-backed helpers for overlap detection (used by several API routes).
import Complaint from '../models/Complaint.js';
import OverlapRecord from '../models/OverlapRecord.js';
import { OPEN_STATUSES } from './constants.js';
import { detectOverlaps, groupsVisibleTo } from './overlap.js';

const FIELDS =
  'complaintId title category status priority bureau assignedToName institutionId institution state region slaDeadline linkedCases createdAt';

/** All overlap groups in the system (unfiltered by role). */
export async function loadAllOverlaps(now = new Date()) {
  const [rows, records] = await Promise.all([
    Complaint.find({ status: { $in: OPEN_STATUSES }, institutionId: { $ne: null } }).select(FIELDS).lean(),
    OverlapRecord.find().lean(),
  ]);
  return detectOverlaps(rows, { records, now });
}

/** Overlap groups the signed-in user is allowed to see. */
export async function loadOverlapsFor(session, now = new Date()) {
  return groupsVisibleTo(await loadAllOverlaps(now), session);
}

/** Overlap group for one institution, or null. Not filtered by role. */
export async function overlapForInstitution(institutionId, now = new Date()) {
  if (!institutionId) return null;
  const [rows, record] = await Promise.all([
    Complaint.find({ institutionId, status: { $in: OPEN_STATUSES } }).select(FIELDS).lean(),
    OverlapRecord.findOne({ institutionId }).lean(),
  ]);
  return detectOverlaps(rows, { records: record ? [record] : [], now })[0] || null;
}

/** institutionIds that currently have an overlap (for list filters). */
export async function overlapInstitutionIds() {
  const groups = await loadAllOverlaps();
  return groups.map((g) => g.institutionId);
}
