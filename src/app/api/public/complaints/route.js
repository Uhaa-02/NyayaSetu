import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Complaint from '@/models/Complaint';
import { apiError, clientIp, rateLimit } from '@/lib/api';
import {
  PAGE_SIZE,
  PUBLIC_FIELDS,
  baseFilter,
  parseFilters,
  statusesFor,
  summarize,
  summarizeByRegion,
  toPublicRow,
} from '@/lib/publicBoard';

export const dynamic = 'force-dynamic';

// PUBLIC, read-only, no login. GET /api/public/complaints?region=&state=&status=unsolved|progress|solved&q=&page=
// Returns only citizen-safe fields (see src/lib/publicBoard.js). Never returns names, e-mails, titles or notes.
export async function GET(req) {
  if (!rateLimit(`open:${clientIp(req)}`, 60, 60 * 1000)) {
    return apiError('Too many requests. Please wait a minute and try again.', 429);
  }
  try {
    const f = parseFilters(new URL(req.url).searchParams);
    await connectDB();

    const base = baseFilter(f); // region + state + search
    const match = f.status ? { ...base, status: { $in: statusesFor(f.status) } } : base;

    const [byStatus, byRegion, total, rows] = await Promise.all([
      Complaint.aggregate([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      // the region overview ignores the region filter so every region stays visible and clickable
      Complaint.aggregate([
        { $match: baseFilter(f, { withRegion: false }) },
        { $group: { _id: { region: '$region', status: '$status' }, n: { $sum: 1 } } },
      ]),
      Complaint.countDocuments(match),
      Complaint.find(match)
        .select(PUBLIC_FIELDS)
        .sort({ createdAt: -1 })
        .skip((f.page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
    ]);

    const now = new Date();
    return NextResponse.json(
      {
        filters: f,
        summary: summarize(byStatus),
        regions: summarizeByRegion(byRegion),
        total,
        page: f.page,
        pageSize: PAGE_SIZE,
        pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        items: rows.map((c) => toPublicRow(c, now)),
        updatedAt: now.toISOString(),
      },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' } }
    );
  } catch (err) {
    console.error('public board error', err);
    return apiError('Could not load the public dashboard.', 500);
  }
}
