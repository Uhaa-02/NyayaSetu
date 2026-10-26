import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Complaint from '@/models/Complaint';
import { apiError, requireAuth, scopeFilter } from '@/lib/api';
import { buildReport, REPORT_TYPES } from '@/lib/reports';
import { loadOverlapsFor } from '@/lib/overlapService';
import { toCSV } from '@/lib/csv';

export const dynamic = 'force-dynamic';

const FIELDS =
  'complaintId institution institutionId state region category priority status bureau createdAt resolvedAt slaDeadline originalDeadline escalationLevel escalatedAt transferCount transfers';

// GET /api/reports?type=bureau&from=2026-01-01&to=2026-03-31&format=csv
export async function GET(req) {
  const { session, error } = requireAuth();
  if (error) return error;
  try {
    const sp = new URL(req.url).searchParams;
    const type = sp.get('type') || 'bureau';
    if (!REPORT_TYPES.some((t) => t.id === type)) return apiError('Unknown report type.', 400);
    const from = sp.get('from') || undefined;
    const to = sp.get('to') || undefined;

    await connectDB();
    const now = new Date();
    const [rows, overlaps] = await Promise.all([
      Complaint.find(scopeFilter(session)).select(FIELDS).limit(10000).lean(),
      loadOverlapsFor(session, now),
    ]);
    const report = buildReport(type, rows, { from, to, now, overlaps });

    if (sp.get('format') === 'csv') {
      const name = `nyayasetu-${type}-report-${now.toISOString().slice(0, 10)}.csv`;
      return new NextResponse(toCSV(report.columns, report.rows), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${name}"`,
          'cache-control': 'no-store',
        },
      });
    }
    return NextResponse.json({ ...report, generatedAt: now, scope: session.role === 'chairman' ? 'All bureaus' : session.role === 'regional' ? `${session.region} region` : session.bureau, types: REPORT_TYPES });
  } catch (err) {
    console.error('report error', err);
    return apiError('Could not build the report.', 500);
  }
}
