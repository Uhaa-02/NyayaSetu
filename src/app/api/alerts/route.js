import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Complaint from '@/models/Complaint';
import { apiError, requireAuth, scopeFilter } from '@/lib/api';
import { buildAlerts } from '@/lib/alerts';
import { loadOverlapsFor } from '@/lib/overlapService';
import { OPEN_STATUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const FIELDS =
  'complaintId title institution institutionId priority status bureau assignedToName slaDeadline escalationLevel escalatedAt createdAt duplicateOf nextAction nextActionDue';

// GET /api/alerts            -> full list
// GET /api/alerts?summary=1  -> counts only (sidebar badge)
export async function GET(req) {
  const { session, error } = requireAuth();
  if (error) return error;
  try {
    await connectDB();
    const now = new Date();
    const [rows, overlaps] = await Promise.all([
      Complaint.find({ $and: [scopeFilter(session), { status: { $in: OPEN_STATUSES } }] }).select(FIELDS).limit(5000).lean(),
      loadOverlapsFor(session, now),
    ]);
    const { items, counts } = buildAlerts({ rows, overlaps, session, now });
    if (new URL(req.url).searchParams.get('summary') === '1') return NextResponse.json({ counts });
    return NextResponse.json({ counts, items: items.slice(0, 400), truncated: items.length > 400 });
  } catch (err) {
    console.error('alerts error', err);
    return apiError('Could not load alerts.', 500);
  }
}
