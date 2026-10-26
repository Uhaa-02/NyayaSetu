import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { apiError, requireAuth } from '@/lib/api';
import { runEscalation } from '@/lib/escalation';
import { notifyChairmanSummary, notifyEscalations, sendDueReminders } from '@/lib/notifications';
import { mailConfig } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function handle(req) {
  let actor = 'SLA Engine (scheduled)';
  if (!isCron(req)) {
    const { session, error } = requireAuth();
    if (error) return error;
    actor = `SLA Engine (run by ${session.name})`;
  }
  try {
    await connectDB();
    const result = await runEscalation({ actor });
    let mail = { enabled: false };
    if (mailConfig().enabled) {
      await notifyEscalations(result.items);
      const r = await sendDueReminders({});
      // the Chairman summary goes out on scheduled runs only, so pressing the button never spams it
      const chair = isCron(req) ? await notifyChairmanSummary({}) : null;
      mail = { enabled: true, reminderDigests: r.digests || 0, remindedCases: r.cases || 0, chairmanSummaries: chair?.sent || 0 };
    }
    // assigneeId is internal; do not send it to the browser
    return NextResponse.json({ ...result, items: result.items.map(({ assigneeId, ...rest }) => rest), mail });
  } catch (err) {
    console.error('escalation error', err);
    return apiError('SLA check failed.', 500);
  }
}

// Vercel Cron calls GET; the dashboard button calls POST.
export const GET = handle;
export const POST = handle;
