import { NextResponse } from 'next/server';
import { apiError, requireAuth } from '@/lib/api';
import { mailConfig, sendMail } from '@/lib/mailer';
import { tplTest } from '@/lib/emailTemplates';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

// GET: is email configured? (any signed-in staff member)
export async function GET() {
  const { error } = requireAuth();
  if (error) return error;
  const cfg = mailConfig();
  return NextResponse.json({ enabled: cfg.enabled, demoRecipient: Boolean(cfg.demoTo) });
}

// POST: send a test email to the signed-in user (or to MAIL_DEMO_TO if set). Chairman Office only.
export async function POST() {
  const { session, error } = requireAuth(['chairman']);
  if (error) return error;
  if (!mailConfig().enabled) return apiError('Email is not configured. Set RESEND_API_KEY on the server.', 400);
  try {
    await connectDB();
    const me = await User.findById(session.id).select('email').lean();
    const r = await sendMail({ to: me?.email, ...tplTest(session.name) });
    if (r.skipped) return apiError('No deliverable address. Set MAIL_DEMO_TO to your own email address to receive test mail.', 400);
    if (!r.ok) return apiError(`The email provider rejected the message: ${r.error}`, 502);
    return NextResponse.json({ ok: true, to: r.to });
  } catch (e) {
    console.error('mail test error', e);
    return apiError('Could not send the test email.', 500);
  }
}
