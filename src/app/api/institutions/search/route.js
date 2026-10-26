import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Institution from '@/models/Institution';
import { apiError, clientIp, escapeRegex, rateLimit } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Public type-ahead for the complaint form. Returns only the name, state and Permanent ID.
export async function GET(req) {
  if (!rateLimit(`inst-search:${clientIp(req)}`, 120, 10 * 60 * 1000)) return apiError('Too many searches.', 429);
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ items: [] });
  try {
    await connectDB();
    const re = new RegExp(escapeRegex(q), 'i');
    const items = await Institution.find({ verified: true, $or: [{ name: re }, { permanentId: re }] })
      .select('permanentId name state')
      .sort({ name: 1 })
      .limit(8)
      .lean();
    return NextResponse.json({ items: items.map((i) => ({ permanentId: i.permanentId, name: i.name, state: i.state })) });
  } catch (err) {
    console.error('institution search error', err);
    return apiError('Search unavailable.', 500);
  }
}
