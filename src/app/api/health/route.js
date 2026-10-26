import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Complaint from '@/models/Complaint';
import { mailConfig } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

// Open /api/health after deploying to confirm the database connection works.
export async function GET() {
  try {
    await connectDB();
    const [users, complaints] = await Promise.all([User.estimatedDocumentCount(), Complaint.estimatedDocumentCount()]);
    return NextResponse.json({ ok: true, db: 'connected', seeded: users > 0 && complaints > 0, email: mailConfig().enabled ? 'on' : 'off' });
  } catch (err) {
    return NextResponse.json({ ok: false, db: 'error', message: err.message }, { status: 500 });
  }
}
