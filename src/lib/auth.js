import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export const COOKIE_NAME = 'ns_token';
const MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is missing or too short (min 16 chars). Set it in your environment variables.');
    }
    return 'dev-only-insecure-secret-change-me';
  }
  return s;
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      bureau: user.bureau || null,
      region: user.region || null,
    },
    secret(),
    { expiresIn: MAX_AGE_SECONDS }
  );
}

export function setAuthCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
  return response;
}

export function clearAuthCookie(response) {
  response.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}

/** Returns { id, name, email, role, bureau, region } or null. Works in route handlers and server components. */
export function getSession() {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return null;
    const p = jwt.verify(token, secret());
    return { id: p.sub, name: p.name, email: p.email, role: p.role, bureau: p.bureau || null, region: p.region || null };
  } catch {
    return null;
  }
}
