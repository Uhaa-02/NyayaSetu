import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { apiError, readJson, requireAuth } from '@/lib/api';
import { createComplaint, validateComplaintInput } from '@/lib/complaintService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_ROWS = 200;

export async function POST(req) {
  const { session, error } = requireAuth();
  if (error) return error;

  const body = await readJson(req);
  const rows = body?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return apiError('No rows supplied.', 400);
  if (rows.length > MAX_ROWS) return apiError(`Please upload at most ${MAX_ROWS} rows at a time.`, 400);

  try {
    await connectDB();
    const created = [];
    const failed = [];
    for (let i = 0; i < rows.length; i++) {
      const { ok, errors, value } = validateComplaintInput(rows[i]);
      if (!ok) {
        failed.push({ row: i + 2, errors }); // +2 => spreadsheet row number (header is row 1)
        continue;
      }
      try {
        const doc = await createComplaint(value, {
          source: 'Bulk Upload',
          actor: session.name,
          actorRole: session.role,
        });
        created.push({ complaintId: doc.complaintId, category: doc.category, priority: doc.priority, bureau: doc.bureau });
      } catch (e) {
        console.error('bulk row error', e);
        failed.push({ row: i + 2, errors: ['Could not save this row.'] });
      }
    }
    return NextResponse.json({ created: created.length, failed: failed.length, items: created, errors: failed });
  } catch (err) {
    console.error('bulk error', err);
    return apiError('Bulk import failed.', 500);
  }
}
