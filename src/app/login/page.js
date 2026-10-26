import { redirect } from 'next/navigation';
import PublicHeader from '@/components/PublicHeader';
import LoginForm from '@/components/LoginForm';
import { getSession } from '@/lib/auth';

export const metadata = { title: 'Staff sign in' };
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  if (getSession()) redirect('/dashboard');
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-6xl flex-col items-center px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Staff sign in</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">For AICTE bureau and cell officers.</p>
        <LoginForm demo={demo} />
      </main>
    </>
  );
}
