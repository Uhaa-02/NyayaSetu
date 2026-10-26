import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = getSession();
  if (!session) return apiError('Not authenticated.', 401);
  return NextResponse.json({ user: session });
}
