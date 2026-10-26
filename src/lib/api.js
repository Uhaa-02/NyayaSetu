// Small helpers shared by all API route handlers.
import { NextResponse } from 'next/server';
import { getSession } from './auth.js';

export function apiError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Returns { session } or { error: NextResponse }. Optionally restrict to certain roles. */
export function requireAuth(roles) {
  const session = getSession();
  if (!session) return { error: apiError('Not authenticated. Please sign in again.', 401) };
  if (roles && !roles.includes(session.role)) {
    return { error: apiError('You do not have permission to do this.', 403) };
  }
  return { session };
}

/** MongoDB filter limiting complaints to what a given staff member may see. */
export function scopeFilter(session) {
  if (session.role === 'chairman') return {};
  if (session.role === 'regional') return { region: session.region }; // regional office: its own region, all bureaus
  if (session.role === 'bureau_head') return { bureau: session.bureau };
  // officer: their bureau's complaints that are assigned to them or still unassigned
  return { bureau: session.bureau, $or: [{ assignedTo: session.id }, { assignedTo: null }] };
}

export function canAccess(session, complaint) {
  if (session.role === 'chairman') return true;
  if (session.role === 'regional') return complaint.region === session.region;
  if (complaint.bureau !== session.bureau) return false;
  if (session.role === 'bureau_head') return true;
  return !complaint.assignedTo || String(complaint.assignedTo) === String(session.id);
}

/** Actions each role may perform on a complaint it can access. */
const ACTIONS_BY_ROLE = {
  chairman: null, // everything
  bureau_head: null,
  officer: ['status', 'note', 'next_action', 'link', 'unlink', 'document', 'escalate'],
  regional: ['note', 'next_action', 'link', 'unlink', 'document'],
};
export function canPerform(session, action) {
  const allowed = ACTIONS_BY_ROLE[session.role];
  return allowed === null || (allowed || []).includes(action);
}

export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- tiny in-memory rate limiter (per server instance; good enough for a prototype) ----
const buckets = globalThis.__nsRateBuckets || (globalThis.__nsRateBuckets = new Map());

export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

export function clientIp(req) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}
