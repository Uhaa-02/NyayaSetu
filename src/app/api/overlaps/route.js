import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Complaint from '@/models/Complaint';
import OverlapRecord from '@/models/OverlapRecord';
import { apiError, readJson, requireAuth } from '@/lib/api';
import { loadAllOverlaps, loadOverlapsFor } from '@/lib/overlapService';
import { logAction } from '@/lib/actions';
import { notifyCoordinated } from '@/lib/notifications';
import { BUREAUS, OPEN_STATUSES, OVERLAP_MESSAGE, shortBureau } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// GET /api/overlaps?status=required|coordinated|all&bureau=...&q=...
export async function GET(req) {
  const { session, error } = requireAuth();
  if (error) return error;
  try {
    await connectDB();
    const sp = new URL(req.url).searchParams;
    let groups = await loadOverlapsFor(session);
    const counts = {
      required: groups.filter((g) => g.status === 'Coordination Required').length,
      coordinated: groups.filter((g) => g.status === 'Coordinated').length,
    };
    const status = sp.get('status') || 'required';
    if (status === 'required') groups = groups.filter((g) => g.status === 'Coordination Required');
    else if (status === 'coordinated') groups = groups.filter((g) => g.status === 'Coordinated');
    const bureau = sp.get('bureau');
    if (BUREAUS.includes(bureau)) groups = groups.filter((g) => g.bureauNames.includes(bureau));
    const q = (sp.get('q') || '').trim().toLowerCase();
    if (q) groups = groups.filter((g) => g.institution.toLowerCase().includes(q) || g.institutionId.toLowerCase().includes(q));
    return NextResponse.json({ groups, counts });
  } catch (err) {
    console.error('overlaps error', err);
    return apiError('Could not load overlapping cases.', 500);
  }
}

// POST /api/overlaps  { institutionId, action: 'coordinate' | 'link_all', leadBureau?, note? }
export async function POST(req) {
  const { session, error } = requireAuth(['bureau_head', 'chairman']);
  if (error) return error;
  const body = await readJson(req);
  const institutionId = String(body?.institutionId || '');
  if (!institutionId) return apiError('institutionId is required.', 400);

  try {
    await connectDB();
    const all = await loadAllOverlaps();
    const group = all.find((g) => g.institutionId === institutionId);
    if (!group) return apiError('There is no overlap for this institution right now.', 404);
    if (session.role === 'bureau_head' && !group.bureauNames.includes(session.bureau))
      return apiError('Only heads of the bureaus involved (or the Chairman Office) can do this.', 403);

    const now = new Date();
    const stamp = { by: session.name, byRole: session.role, at: now };
    const cases = await Complaint.find({ institutionId, status: { $in: OPEN_STATUSES } });

    if (body.action === 'coordinate') {
      const leadBureau = String(body.leadBureau || '');
      const note = String(body.note || '').trim().slice(0, 600);
      if (!group.bureauNames.includes(leadBureau)) return apiError('Choose the lead bureau from the bureaus involved.', 400);
      if (note.length < 10) return apiError('Please record how the bureaus will coordinate (at least 10 characters).', 400);

      await OverlapRecord.findOneAndUpdate(
        { institutionId },
        {
          institutionId,
          leadBureau,
          note,
          bureausAtCoordination: group.bureauNames,
          coordinatedBy: session.name,
          coordinatedByRole: session.role,
          coordinatedAt: now,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      for (const c of cases) {
        logAction(c, {
          action: 'coordination',
          message: `Coordination recorded for ${group.institution}: lead is ${shortBureau(leadBureau)}. ${note}`,
          visibility: 'internal',
          ...stamp,
        });
        await c.save();
      }
      await notifyCoordinated(group, { leadBureau, note }, session.name);
      return NextResponse.json({ ok: true, message: `Marked as coordinated. Lead bureau: ${leadBureau}.` });
    }

    if (body.action === 'link_all') {
      // Map the most urgent open case of every bureau to the most urgent case of each other bureau.
      const reps = group.bureaus.map((b) => b.cases[0].complaintId); // cases are sorted by priority
      let added = 0;
      for (const c of cases) {
        if (!reps.includes(c.complaintId)) continue;
        const fresh = reps.filter((id) => id !== c.complaintId && !(c.linkedCases || []).includes(id));
        if (!fresh.length) continue;
        c.linkedCases.push(...fresh);
        added += fresh.length;
        logAction(c, { action: 'link', message: `Cross-bureau cases linked: ${fresh.join(', ')}.`, visibility: 'internal', ...stamp });
        await c.save();
      }
      return NextResponse.json({ ok: true, message: added ? `Linked the lead case of each of the ${group.bureauCount} bureaus.` : 'The lead cases were already linked.' });
    }

    return apiError(`Unknown action. (${OVERLAP_MESSAGE})`, 400);
  } catch (err) {
    console.error('overlap action error', err);
    return apiError('Could not update the overlap.', 500);
  }
}
