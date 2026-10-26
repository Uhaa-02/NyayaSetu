'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';
import { ErrorBox, Spinner } from '@/components/ui';

const DEMO = [
  { label: 'Chairman Office (Competent Authority)', hint: 'Sees all bureaus and cells', email: 'chairman@nyayasetu.demo' },
  { label: 'Bureau Head - PGRC', hint: 'Public Grievance Redressal Cell', email: 'head@nyayasetu.demo' },
  { label: 'Bureau Head - RB', hint: 'Regulation Bureau', email: 'head.regulation@nyayasetu.demo' },
  { label: 'Case Officer - PGRC', hint: 'Own queue only', email: 'officer@nyayasetu.demo' },
  { label: 'Regional Office', hint: 'South Central region, all bureaus', email: 'regional.south@nyayasetu.demo' },
];

export default function LoginForm({ demo }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn(e, creds) {
    e?.preventDefault();
    const body = creds || { email, password };
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={signIn} className="card space-y-4 p-6 sm:p-8">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <ErrorBox>{error}</ErrorBox>
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Sign in
        </button>
      </form>

      {demo ? (
        <div className="card mt-5 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Demo accounts</h2>
          <p className="mt-0.5 text-xs text-slate-500">Click a role to sign in instantly with the seeded demo password.</p>
          <ul className="mt-3 space-y-2">
            {DEMO.map((d) => (
              <li key={d.email}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEmail(d.email);
                    signIn(null, { email: d.email, password: process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'Demo@1234' });
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:border-navy-300 hover:bg-navy-50 disabled:opacity-50"
                >
                  <span>
                    <span className="block text-sm font-semibold text-navy-900">{d.label}</span>
                    <span className="block text-xs text-slate-500">{d.hint}</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">{d.email.split('@')[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
