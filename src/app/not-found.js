import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-saffron-600">404</p>
        <h1 className="mt-2 text-3xl font-bold text-navy-900">This page could not be found</h1>
        <p className="mt-3 text-slate-600">The link may be wrong or the page may have moved.</p>
        <Link href="/" className="btn btn-primary mt-6">
          Back to home
        </Link>
      </main>
    </>
  );
}
