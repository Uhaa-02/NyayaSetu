import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { apiError, requireAuth } from '@/lib/api';
import { BUREAUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Staff list used by the "assign to" dropdown. Managers only.
export async function GET(req) {
  const { session, error } = requireAuth(['bureau_head', 'chairman']);
  if (error) return error;
  try {
    await connectDB();
    const wanted = new URL(req.url).searchParams.get('bureau');
    const filter = { active: true, role: { $in: ['officer', 'bureau_head'] } };
    if (session.role === 'bureau_head') filter.bureau = session.bureau;
    else if (BUREAUS.includes(wanted)) filter.bureau = wanted;
    const users = await User.find(filter).select('name role bureau').sort({ bureau: 1, role: 1, name: 1 }).lean();
    return NextResponse.json({
      users: users.map((u) => ({ id: String(u._id), name: u.name, role: u.role, bureau: u.bureau })),
    });
  } catch (err) {
    console.error('users error', err);
    return apiError('Could not load staff.', 500);
  }
}
