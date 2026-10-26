'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { ROLE_LABELS } from '@/lib/constants';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z' },
  { href: '/alerts', label: 'Alerts', badge: true, icon: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9ZM13.7 21a2 2 0 0 1-3.4 0' },
  { href: '/complaints', label: 'Complaints', icon: 'M5 4h14v4H5V4Zm0 6h14v4H5v-4Zm0 6h14v4H5v-4Z' },
  { href: '/overlaps', label: 'Overlap monitor', icon: 'M9 9a5 5 0 1 0 0 .01M15 15a5 5 0 1 0 0 .01' },
  { href: '/institutions', label: 'Institutions', icon: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6' },
  { href: '/reports', label: 'Reports', icon: 'M7 3h8l4 4v14H7V3Zm8 0v4h4M10 13h6M10 17h6' },
  { href: '/complaints/new', label: 'New complaint', icon: 'M12 5v14M5 12h14' },
  { href: '/import', label: 'Bulk import', icon: 'M12 3v12m0 0-4-4m4 4 4-4M5 19h14' },
];

function Icon({ d }) {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(null);

  // live count of alerts needing attention (refreshes on navigation and every 2 minutes)
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/alerts?summary=1', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && d && setAlertCount(d.counts.critical))
        .catch(() => {});
    load();
    const t = setInterval(load, 120000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const isActive = (href) => {
    if (href === '/complaints') return pathname === '/complaints' || (pathname.startsWith('/complaints/') && pathname !== '/complaints/new');
    if (href === '/institutions') return pathname.startsWith('/institutions');
    return pathname === href;
  };

  return (
    <>
      {/* mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-navy-900 px-4 py-3 lg:hidden print:hidden">
        <Logo light />
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 text-white hover:bg-white/10"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d={open ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} />
          </svg>
        </button>
      </div>

      <aside
        className={`${open ? 'block' : 'hidden'} z-20 w-full bg-navy-900 text-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 print:hidden`}
      >
        <div className="tricolor h-1" />
        <div className="hidden px-5 py-5 lg:block">
          <Logo light />
        </div>
        <nav className="space-y-1 px-3 py-3 lg:py-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive(n.href) ? 'bg-white/15 text-white' : 'text-navy-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon d={n.icon} />
              {n.label}
              {n.badge && alertCount ? (
                <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white" title="Critical alerts">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 lg:absolute lg:bottom-0 lg:left-0 lg:w-64">
          <div className="text-sm font-semibold">{user.name}</div>
          <div className="text-xs text-navy-200">{ROLE_LABELS[user.role]}</div>
          {user.bureau ? <div className="mt-0.5 text-xs text-navy-300">{user.bureau}</div> : null}
          {user.region ? <div className="mt-0.5 text-xs text-navy-300">{user.region} region</div> : null}
          <button onClick={logout} className="mt-3 w-full rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10">
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
