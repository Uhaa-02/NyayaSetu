import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }) {
  const session = getSession();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar user={session} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
