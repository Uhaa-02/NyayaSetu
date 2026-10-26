'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api, fmtDate } from '@/lib/client';
import {
  BureauChip,
  Card,
  EmptyState,
  ErrorBox,
  OverlapBadge,
  PageHeader,
  PriorityBadge,
  SeverityBadge,
  Spinner,
  StatusBadge,
  SuccessBox,
  Tabs,
} from '@/components/ui';
import { BUREAUS, OVERLAP_MESSAGE } from '@/lib/constants';

function CoordinatePanel({ group, me, onDone }) {
  const [lead, setLead] = useState(group.bureauNames[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const canAct = me.role === 'chairman' || (me.role === 'bureau_head' && group.bureauNames.includes(me.bureau));

  async function run(body, ok) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api('/api/overlaps', { method: 'POST', body: { institutionId: group.institutionId, ...body } });
      setMsg({ type: 'ok', text: r.message || ok });
      await onDone(r.message || ok);
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (!canAct) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Heads of the bureaus involved, or the Chairman Office, record the coordination decision. Case officers can link cases from the case page.
      </p>
    );
  }
  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-800">Record coordination</p>
      {msg?.type === 'ok' ? <SuccessBox>{msg.text}</SuccessBox> : null}
      {msg?.type === 'err' ? <ErrorBox>{msg.text}</ErrorBox> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Lead bureau</label>
          <select className="input" value={lead} onChange={(e) => setLead(e.target.value)}>
            {group.bureauNames.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">How will the bureaus coordinate? *</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="e.g. RB leads; PGRC holds its hearing until RB shares findings." />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" disabled={busy || note.trim().length < 10} onClick={() => run({ action: 'coordinate', leadBureau: lead, note }, 'Marked as coordinated.')}>
          {busy ? <Spinner /> : null}
          Mark as coordinated
        </button>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run({ action: 'link_all' }, 'Cases linked.')}>
          Link lead case of every bureau
        </button>
      </div>
    </div>
  );
}

function GroupCard({ g, me, reload, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={g.institutionId} className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-start justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50" aria-expanded={open}>
        <div className="min-w-0">
          <p className="text-base font-bold text-navy-900">{g.institution}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="font-mono">{g.institutionId}</span> &middot; {g.state} ({g.region}) &middot; {g.caseCount} open case{g.caseCount === 1 ? '' : 's'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {g.bureaus.map((b) => <BureauChip key={b.bureau} bureau={b.bureau} count={b.count} />)}
            {g.hasRbPgrc ? <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">RB + PGRC</span> : null}
            {g.allLinked ? <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-700">Cases linked</span> : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <OverlapBadge status={g.status} />
          <SeverityBadge severity={g.severity} />
          {g.overdue ? <span className="text-xs font-semibold text-red-600">{g.overdue} beyond timeline</span> : null}
        </div>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-100 px-5 py-4">
          {g.record ? (
            <div className={`rounded-lg px-3 py-2 text-xs ${g.record.stale ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
              <strong>Lead: {g.record.leadBureau}.</strong> {g.record.note} ({g.record.coordinatedBy}, {fmtDate(g.record.coordinatedAt)})
              {g.record.stale ? <strong> - a new bureau has joined since; please review.</strong> : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {g.bureaus.map((b) => (
              <div key={b.bureau} className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <BureauChip bureau={b.bureau} /> {b.bureau}
                </p>
                <ul className="divide-y divide-slate-100">
                  {b.cases.map((c) => (
                    <li key={c.complaintId} className="py-2">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/complaints/${c.complaintId}`} className="min-w-0 text-sm text-navy-800 hover:underline">
                          <span className="font-mono text-xs font-semibold">{c.complaintId}</span> {c.title}
                        </Link>
                        <PriorityBadge priority={c.priority} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <StatusBadge status={c.status} />
                        <span>{c.assignedToName || 'Unassigned'}</span>
                        {c.overdue ? <span className="font-semibold text-red-600">Beyond timeline</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <CoordinatePanel group={g} me={me} onDone={reload} />
          <Link href={`/institutions/${g.institutionId}`} className="inline-block text-xs font-semibold text-navy-700 hover:underline">
            Open institution profile &rarr;
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function Overlaps() {
  const sp = useSearchParams();
  const focus = sp.get('i') || '';
  const [status, setStatus] = useState(focus ? 'all' : 'required');
  const [bureau, setBureau] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async (message) => {
    if (typeof message === 'string') setFlash(message);
    try {
      const params = new URLSearchParams({ status });
      if (bureau) params.set('bureau', bureau);
      if (q) params.set('q', q);
      const [d, m] = await Promise.all([api(`/api/overlaps?${params}`), api('/api/auth/me')]);
      setData(d);
      setMe(m.user);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [status, bureau, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (focus && data) document.getElementById(focus)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focus, data]);

  return (
    <>
      <PageHeader
        title="Overlap monitor"
        subtitle="Institutions where more than one bureau or cell has open cases at the same time, so that actions are coordinated and not duplicated."
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            ['required', `Coordination required${data ? ` (${data.counts.required})` : ''}`],
            ['coordinated', `Coordinated${data ? ` (${data.counts.coordinated})` : ''}`],
            ['all', 'All'],
          ]}
        />
        <select className="input !w-auto" value={bureau} onChange={(e) => setBureau(e.target.value)} aria-label="Bureau involved">
          <option value="">Any bureau / cell</option>
          {BUREAUS.map((b) => <option key={b}>{b}</option>)}
        </select>
        <input className="input !w-auto min-w-[220px] flex-1" placeholder="Search institution or AICTE ID..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <ErrorBox>{error}</ErrorBox>
      {flash ? <div className="mb-4"><SuccessBox>{flash}</SuccessBox></div> : null}

      {!data && !error ? <div className="skeleton h-40" /> : null}
      {data && data.groups.length === 0 ? (
        <div className="card">
          <EmptyState title={status === 'required' ? 'No overlapping cases need coordination' : 'Nothing to show'} hint={OVERLAP_MESSAGE} />
        </div>
      ) : null}

      <div className="space-y-4">
        {data?.groups.map((g) => (
          <GroupCard key={g.institutionId} g={g} me={me} reload={load} defaultOpen={g.institutionId === focus} />
        ))}
      </div>
    </>
  );
}

export default function OverlapsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading...</div>}>
      <Overlaps />
    </Suspense>
  );
}
