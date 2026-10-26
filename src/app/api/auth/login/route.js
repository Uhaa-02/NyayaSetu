import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import { signToken, setAuthCookie } from '@/lib/auth';
import { apiError, readJson, rateLimit, clientIp } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Used to keep response time similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function POST(req) {
  const body = await readJson(req);
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!email || !password) return apiError('Email and password are required.', 400);

  if (!rateLimit(`login:${clientIp(req)}:${email}`, 10, 15 * 60 * 1000)) {
    return apiError('Too many attempts. Please wait a few minutes and try again.', 429);
  }

  try {
    await connectDB();
    const user = await User.findOne({ email, active: true }).select('+passwordHash');
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) return apiError('Invalid email or password.', 401);

    user.lastLoginAt = new Date();
    await user.save();

    const res = NextResponse.json({
      user: { name: user.name, email: user.email, role: user.role, bureau: user.bureau, region: user.region },
    });
    return setAuthCookie(res, signToken(user));
  } catch (err) {
    console.error('login error', err);
    const known = ['MONGODB_URI', 'JWT_SECRET'].some((k) => err.message?.includes(k));
    return apiError(known ? err.message : 'Could not reach the database. Check MONGODB_URI and the Atlas network access list.', 500);
  }
}
