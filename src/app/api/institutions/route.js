import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Institution from '@/models/Institution';
import Complaint from '@/models/Complaint';
import { apiError, escapeRegex, requireAuth } from '@/lib/api';
import { loadAllOverlaps } from '@/lib/overlapService';
import { OPEN_STATUSES, REGIONS, shortBureau } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Institution registry with live case counts. Staff only.
export async function GET(req) {
  const { session, error } = requireAuth();
  if (error) return error;
  try {
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const filter = {};
    const q = (sp.get('q') || '').trim().slice(0, 80);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: re }, { permanentId: re }, { city: re }];
    }
    const region = sp.get('region');
    if (REGIONS.includes(region)) filter.region = region;
    const state = sp.get('state');
    if (state) filter.state = state;

    const overlapGroups = await loadAllOverlaps();
    const overlapIds = new Set(overlapGroups.map((g) => g.institutionId));
    if (sp.get('overlap') === '1') filter.permanentId = { $in: [...overlapIds] };

    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
    const limit = 15;
    const [list, total] = await Promise.all([
      Institution.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Institution.countDocuments(filter),
    ]);

    const ids = list.map((i) => i.permanentId);
    const rows = await Complaint.find({ institutionId: { $in: ids } }).select('institutionId status bureau').lean();
    const stats = new Map();
    for (const r of rows) {
      const s = stats.get(r.institutionId) || { total: 0, open: 0, bureaus: new Set() };
      s.total++;
      if (OPEN_STATUSES.includes(r.status)) {
        s.open++;
        s.bureaus.add(r.bureau);
      }
      stats.set(r.institutionId, s);
    }

    return NextResponse.json({
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      items: list.map((i) => {
        const s = stats.get(i.permanentId) || { total: 0, open: 0, bureaus: new Set() };
        return {
          permanentId: i.permanentId,
          name: i.name,
          type: i.type,
          city: i.city,
          state: i.state,
          region: i.region,
          verified: i.verified,
          totalCases: s.total,
          openCases: s.open,
          bureaus: [...s.bureaus].map(shortBureau),
          overlap: overlapIds.has(i.permanentId),
        };
      }),
    });
  } catch (err) {
    console.error('institutions error', err);
    return apiError('Could not load institutions.', 500);
  }
}
