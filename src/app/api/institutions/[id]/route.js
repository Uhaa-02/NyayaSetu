import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Institution from '@/models/Institution';
import Complaint from '@/models/Complaint';
import { apiError, canAccess, requireAuth } from '@/lib/api';
import { overlapForInstitution } from '@/lib/overlapService';
import { slaState } from '@/lib/sla';
import { DONE_STATUSES, OPEN_STATUSES, PENDING_STATUSES, PROCESS_STATUSES, shortBureau } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Institution profile: details plus the consolidated case history across ALL bureaus.
export async function GET(_req, { params }) {
  const { session, error } = requireAuth();
  if (error) return error;
  try {
    await connectDB();
    const inst = await Institution.findOne({ permanentId: String(params.id).toUpperCase() }).lean();
    if (!inst) return apiError('Institution not found.', 404);

    const now = new Date();
    const [cases, overlap] = await Promise.all([
      Complaint.find({ institutionId: inst.permanentId })
        .select(
          'complaintId title category priority status bureau region assignedToName assignedTo createdAt lastAction lastActionAt lastActionBy nextAction nextActionDue slaDeadline escalationLevel transferCount linkedCases resolvedAt'
        )
        .sort({ createdAt: -1 })
        .limit(300)
        .lean(),
      overlapForInstitution(inst.permanentId, now),
    ]);

    const open = cases.filter((c) => OPEN_STATUSES.includes(c.status));
    const byBureau = new Map();
    for (const c of open) {
      const e = byBureau.get(c.bureau) || { bureau: c.bureau, short: shortBureau(c.bureau), open: 0, officers: new Set() };
      e.open++;
      if (c.assignedToName) e.officers.add(c.assignedToName);
      byBureau.set(c.bureau, e);
    }

    return NextResponse.json({
      institution: {
        permanentId: inst.permanentId,
        name: inst.name,
        type: inst.type,
        city: inst.city,
        address: inst.address,
        state: inst.state,
        region: inst.region,
        establishedYear: inst.establishedYear,
        verified: inst.verified,
      },
      stats: {
        total: cases.length,
        pending: cases.filter((c) => PENDING_STATUSES.includes(c.status)).length,
        underProcess: cases.filter((c) => PROCESS_STATUSES.includes(c.status)).length,
        disposed: cases.filter((c) => DONE_STATUSES.includes(c.status)).length,
        transferred: cases.filter((c) => (c.transferCount || 0) > 0).length,
        escalated: open.filter((c) => c.escalationLevel > 0).length,
        overdue: open.filter((c) => c.slaDeadline && new Date(c.slaDeadline) < now).length,
      },
      bureausInvolved: [...byBureau.values()].map((b) => ({ ...b, officers: [...b.officers] })),
      overlap: overlap
        ? {
            status: overlap.status,
            severity: overlap.severity,
            hasRbPgrc: overlap.hasRbPgrc,
            record: overlap.record,
            bureaus: overlap.bureaus.map((b) => ({ bureau: b.bureau, short: b.short, count: b.count })),
            allLinked: overlap.allLinked,
          }
        : null,
      cases: cases.map((c) => ({
        complaintId: c.complaintId,
        title: c.title,
        category: c.category,
        priority: c.priority,
        status: c.status,
        bureau: c.bureau,
        assignedToName: c.assignedToName,
        createdAt: c.createdAt,
        lastAction: c.lastAction,
        lastActionAt: c.lastActionAt,
        nextAction: c.nextAction,
        nextActionDue: c.nextActionDue,
        escalationLevel: c.escalationLevel,
        transferCount: c.transferCount || 0,
        linked: (c.linkedCases || []).length,
        mine: canAccess(session, c),
        sla: slaState(c, now),
      })),
    });
  } catch (err) {
    console.error('institution profile error', err);
    return apiError('Could not load the institution.', 500);
  }
}
