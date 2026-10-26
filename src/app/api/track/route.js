import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Complaint from '@/models/Complaint';
import { apiError, clientIp, rateLimit, readJson } from '@/lib/api';
import { ESCALATION_LEVELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Public status tracker. Requires BOTH the complaint ID and the email used to file it,
// and only exposes citizen-safe fields (no internal notes, AI scores or staff names).
export async function POST(req) {
  if (!rateLimit(`track:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
    return apiError('Too many lookups. Please try again in a few minutes.', 429);
  }
  const body = await readJson(req);
  const complaintId = String(body?.complaintId || '').trim().toUpperCase();
  const email = String(body?.email || '').trim().toLowerCase();
  if (!complaintId || !email) return apiError('Enter your complaint ID and the email you used to file it.', 400);

  try {
    await connectDB();
    const c = await Complaint.findOne({ complaintId, complainantEmail: email }).lean();
    if (!c) return apiError('No complaint found for that ID and email.', 404);
    return NextResponse.json({
      complaintId: c.complaintId,
      title: c.title,
      institution: c.institution,
      category: c.category,
      status: c.status,
      bureau: c.bureau,
      createdAt: c.createdAt,
      expectedBy: c.slaDeadline,
      escalatedTo: c.escalationLevel > 0 ? ESCALATION_LEVELS[c.escalationLevel] : null,
      timeline: (c.timeline || [])
        .filter((t) => t.visibility === 'public')
        .map((t) => ({ action: t.action, message: t.message, at: t.at })),
    });
  } catch (err) {
    console.error('track error', err);
    return apiError('Could not look up the complaint.', 500);
  }
}
