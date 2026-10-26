import Link from 'next/link';
import { Logo } from './Logo';

export default function PublicHeader({ dark = false }) {
  const link = dark ? 'text-navy-100 hover:text-white' : 'text-slate-600 hover:text-navy-800';
  return (
    <header className={dark ? 'relative z-10' : 'border-b border-slate-200 bg-white'}>
      <div className="tricolor h-1" />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="NyayaSetu home">
          <Logo light={dark} />
        </Link>
        <nav className="flex items-center gap-2.5 whitespace-nowrap text-xs font-medium sm:gap-6 sm:text-sm">
          <Link href="/submit" className={`hidden sm:inline ${link}`}>
            File a complaint
          </Link>
          <Link href="/open" className={link}>
            <span className="hidden sm:inline">Open dashboard</span>
            <span className="sm:hidden">Dashboard</span>
          </Link>
          <Link href="/track" className={link}>
            Track status
          </Link>
          <Link href="/login" className={`btn btn-sm ${dark ? 'btn-accent' : 'btn-primary'}`}>
            Staff sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
