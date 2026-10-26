import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Complaint from '@/models/Complaint';
import { apiError, requireAuth, scopeFilter } from '@/lib/api';
import { computeAnalytics } from '@/lib/analytics';
import { maybeAutoEscalate } from '@/lib/escalation';
import { loadOverlapsFor } from '@/lib/overlapService';
import { buildAlerts } from '@/lib/alerts';
import { ROLE_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const FIELDS =
  'complaintId title institution institutionId state region category priority status bureau createdAt resolvedAt slaDeadline originalDeadline escalationLevel transferCount';

export async function GET() {
  const { session, error } = requireAuth();
  if (error) return error;
  try {
    await connectDB();
    const auto = await maybeAutoEscalate();
    const now = new Date();
    const rows = await Complaint.find(scopeFilter(session)).select(FIELDS + ' escalatedAt createdAt nextAction nextActionDue duplicateOf assignedToName').limit(5000).lean();
    const data = computeAnalytics(rows, now);
    const overlaps = await loadOverlapsFor(session, now);
    const alerts = buildAlerts({ rows, overlaps, session, now });
    const scope =
      session.role === 'chairman'
        ? 'All bureaus and cells'
        : session.role === 'regional'
          ? `${session.region} region - all bureaus`
          : session.role === 'bureau_head'
            ? session.bureau
            : `${session.bureau} - my queue`;
    return NextResponse.json({
      ...data,
      scope,
      overlaps: {
        required: overlaps.filter((g) => g.status === 'Coordination Required').length,
        coordinated: overlaps.filter((g) => g.status === 'Coordinated').length,
        top: overlaps.filter((g) => g.status === 'Coordination Required').slice(0, 5).map((g) => ({
          institutionId: g.institutionId,
          institution: g.institution,
          state: g.state,
          bureaus: g.bureaus.map((b) => ({ short: b.short, count: b.count })),
          caseCount: g.caseCount,
          severity: g.severity,
          hasRbPgrc: g.hasRbPgrc,
        })),
      },
      alertCounts: alerts.counts,
      dueSoonList: alerts.items.filter((i) => i.type === 'due_soon').slice(0, 5),
      viewer: { name: session.name, role: session.role, roleLabel: ROLE_LABELS[session.role] },
      autoEscalation: auto ? { escalated: auto.escalated } : null,
    });
  } catch (err) {
    console.error('analytics error', err);
    return apiError('Could not compute analytics.', 500);
  }
}
