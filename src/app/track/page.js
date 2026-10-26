'use client';

import { useState } from 'react';
import PublicHeader from '@/components/PublicHeader';
import { ErrorBox, Spinner, StatusBadge } from '@/components/ui';
import { api, fmtDate, fmtDateTime } from '@/lib/client';

const STEPS = ['New', 'In Review', 'Hearing Scheduled', 'Resolved', 'Closed'];

export default function TrackPage() {
  const [complaintId, setComplaintId] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function lookup(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api('/api/track', { method: 'POST', body: { complaintId, email } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = result ? STEPS.indexOf(result.status) : -1;

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">Track your complaint</h1>
        <p className="mt-2 text-slate-600">Enter the complaint ID you received and the email address you used to file it.</p>

        <form onSubmit={lookup} className="card mt-6 grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="cid">Complaint ID</label>
            <input id="cid" className="input font-mono uppercase" placeholder="NS-2026-000123" value={complaintId} onChange={(e) => setComplaintId(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="temail">Email</label>
            <input id="temail" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner /> : null}
            Track
          </button>
        </form>

        <div className="mt-4">
          <ErrorBox>{error}</ErrorBox>
        </div>

        {result ? (
          <section className="card mt-6 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold text-slate-400">{result.complaintId}</p>
                <h2 className="mt-0.5 text-lg font-bold text-navy-900">{result.title}</h2>
                <p className="text-sm text-slate-500">{result.institution}</p>
              </div>
              <StatusBadge status={result.status} />
            </div>

            <ol className="mt-6 grid grid-cols-5 gap-1 text-center text-[11px] font-medium sm:text-xs">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <div className={`mx-auto h-2 rounded-full ${i <= stepIndex ? 'bg-navy-700' : 'bg-slate-200'}`} />
                  <span className={`mt-1.5 block ${i <= stepIndex ? 'text-navy-800' : 'text-slate-400'}`}>{s}</span>
                </li>
              ))}
            </ol>

            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Handled by</dt>
                <dd className="mt-0.5 font-medium text-slate-800">{result.bureau}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filed on</dt>
                <dd className="mt-0.5 font-medium text-slate-800">{fmtDate(result.createdAt)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {['Resolved', 'Closed'].includes(result.status) ? 'Status' : 'Response due by'}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800">
                  {['Resolved', 'Closed'].includes(result.status) ? result.status : fmtDate(result.expectedBy)}
                </dd>
              </div>
            </dl>

            {result.escalatedTo ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Your complaint has been escalated to the {result.escalatedTo} for faster action.
              </p>
            ) : null}

            <h3 className="mt-6 text-sm font-semibold text-slate-900">Progress</h3>
            <ol className="mt-3 space-y-4 border-l-2 border-slate-200 pl-5">
              {[...result.timeline].reverse().map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-navy-600 ring-4 ring-white" />
                  <p className="text-sm text-slate-800">{t.message}</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(t.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </main>
    </>
  );
}
