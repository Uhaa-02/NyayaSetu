import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Complaint from '@/models/Complaint';
import { getSession } from '@/lib/auth';
import {
  apiError,
  clientIp,
  escapeRegex,
  rateLimit,
  readJson,
  requireAuth,
  scopeFilter,
} from '@/lib/api';
import { createComplaint, validateComplaintInput } from '@/lib/complaintService';
import { notifyCaseCreated } from '@/lib/notifications';
import { slaState } from '@/lib/sla';
import { overlapInstitutionIds } from '@/lib/overlapService';
import {
  BUREAUS,
  CATEGORIES,
  OPEN_STATUSES,
  PRIORITIES,
  REGIONS,
  STAGES,
  STATUSES,
} from '@/lib/constants';

export const dynamic = 'force-dynamic';

const LIST_FIELDS =
  'complaintId title institution institutionId state region category priority status bureau assignedToName slaDeadline escalationLevel duplicateOf createdAt source lastAction lastActionAt nextAction nextActionDue transferCount';

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  priority: { priorityRank: -1, createdAt: -1 },
  deadline: { slaDeadline: 1 },
};

// ------------------------------------------------------------------ list (staff only)
export async function GET(req) {
  const { session, error } = requireAuth();
  if (error) return error;

  try {
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const and = [scopeFilter(session)];

    const status = sp.get('status');
    if (status === 'open') and.push({ status: { $in: OPEN_STATUSES } });
    else if (STATUSES.includes(status)) and.push({ status });

    const priority = sp.get('priority');
    if (PRIORITIES.includes(priority)) and.push({ priority });

    const category = sp.get('category');
    if (CATEGORIES.includes(category)) and.push({ category });

    const bureau = sp.get('bureau');
    if (BUREAUS.includes(bureau)) and.push({ bureau });

    const stage = sp.get('stage'); // pending | process | disposed
    if (STAGES[stage]) and.push({ status: { $in: STAGES[stage] } });

    const region = sp.get('region');
    if (REGIONS.includes(region)) and.push({ region });

    const institutionId = (sp.get('institutionId') || '').trim().toUpperCase();
    if (/^[A-Z0-9-]{3,20}$/.test(institutionId)) and.push({ institutionId });

    // date range on the filing date (inclusive)
    const from = sp.get('from');
    const to = sp.get('to');
    if (from && !Number.isNaN(Date.parse(from))) and.push({ createdAt: { $gte: new Date(from) } });
    if (to && !Number.isNaN(Date.parse(to))) and.push({ createdAt: { $lt: new Date(new Date(to).getTime() + 24 * 3600 * 1000) } });

    if (sp.get('transferred') === '1') and.push({ transferCount: { $gt: 0 } });
    if (sp.get('overlap') === '1') {
      const ids = await overlapInstitutionIds();
      and.push({ institutionId: { $in: ids }, status: { $in: OPEN_STATUSES } });
    }

    if (sp.get('sla') === 'overdue') {
      and.push({ status: { $in: OPEN_STATUSES }, slaDeadline: { $lt: new Date() } });
    }
    if (sp.get('escalated') === '1') and.push({ escalationLevel: { $gt: 0 }, status: { $in: OPEN_STATUSES } });
    if (sp.get('duplicates') === '1') and.push({ duplicateOf: { $ne: null } });

    const q = (sp.get('q') || '').trim().slice(0, 80);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      and.push({ $or: [{ complaintId: re }, { title: re }, { institution: re }, { institutionId: re }] });
    }

    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(sp.get('limit') || '15', 10) || 15));
    const sort = SORTS[sp.get('sort')] || SORTS.newest;
    const filter = and.length > 1 ? { $and: and } : and[0];

    const [items, total] = await Promise.all([
      Complaint.find(filter).select(LIST_FIELDS).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Complaint.countDocuments(filter),
    ]);

    const now = new Date();
    return NextResponse.json({
      items: items.map((c) => ({ ...c, sla: slaState(c, now) })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('complaints list error', err);
    return apiError('Could not load complaints.', 500);
  }
}

// ------------------------------------------------------------------ create (public intake + staff entry)
export async function POST(req) {
  const body = await readJson(req);
  if (!body) return apiError('Invalid request body.', 400);

  // Honeypot: real people never fill the hidden "website" field. Pretend success to bots.
  if (body.website) return NextResponse.json({ complaintId: 'NS-0000-000000', category: 'Other', bureau: '-' });

  const session = getSession();
  if (!session && !rateLimit(`submit:${clientIp(req)}`, 8, 10 * 60 * 1000)) {
    return apiError('Too many submissions from your network. Please try again later.', 429);
  }

  const { ok, errors, value } = validateComplaintInput(body);
  if (!ok) return apiError(errors[0], 400, { errors });

  try {
    await connectDB();
    const doc = await createComplaint(
      value,
      session
        ? { source: 'Officer Entry', actor: session.name, actorRole: session.role }
        : { source: 'Web Form', actor: value.complainantName, actorRole: 'citizen' }
    );
    await notifyCaseCreated(doc); // emails are optional and never block or fail the request
    return NextResponse.json(
      {
        complaintId: doc.complaintId,
        category: doc.category,
        bureau: doc.bureau,
        expectedBy: doc.slaDeadline,
        // coordination details are for staff only
        ...(session ? { institutionId: doc.institutionId, institution: doc.institution, overlap: doc.overlapInfo || null } : {}),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('complaint create error', err);
    return apiError('Could not save the complaint. Please try again.', 500);
  }
}
