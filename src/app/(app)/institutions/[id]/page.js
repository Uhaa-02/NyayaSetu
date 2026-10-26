'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, fmtDate } from '@/lib/client';
import {
  BureauChip,
  Card,
  ErrorBox,
  EscalationBadge,
  KpiCard,
  OverlapBadge,
  PageHeader,
  PriorityBadge,
  SlaBadge,
  StatusBadge,
} from '@/components/ui';
import { OVERLAP_MESSAGE } from '@/lib/constants';

export default function InstitutionProfilePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api(`/api/institutions/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <ErrorBox>{error}</ErrorBox>
        <Link href="/institutions" className="btn btn-secondary mt-4">Back to institutions</Link>
      </div>
    );
  if (!data) return <div className="space-y-4"><div className="skeleton h-28" /><div className="skeleton h-64" /></div>;

  const { institution: inst, stats, bureausInvolved, overlap, cases } = data;
  const filtered = cases.filter((c) =>
    filter === 'all' ? true : filter === 'open' ? ['New', 'In Review', 'Hearing Scheduled'].includes(c.status) : ['Resolved', 'Closed'].includes(c.status)
  );
  const shown = showAll ? filtered : filtered.slice(0, 15);

  return (
    <>
      <div className="mb-4 text-sm">
        <Link href="/institutions" className="font-medium text-slate-500 hover:text-navy-700">&larr; All institutions</Link>
      </div>

      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-slate-400">AICTE Permanent ID {inst.permanentId}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{inst.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {inst.type} institution &middot; {inst.address || `${inst.city || ''} ${inst.state}`}
              {inst.establishedYear ? ` · Established ${inst.establishedYear}` : ''}
            </p>
            <p className="mt-1 text-xs text-slate-400">{inst.state} &middot; {inst.region} region{inst.verified === false ? ' · Unverified record (created from a complaint)' : ''}</p>
          </div>
          <Link href={`/complaints?institutionId=${inst.permanentId}`} className="btn btn-secondary btn-sm">Open in complaints list</Link>
        </div>
      </div>

      {overlap ? (
        <Link href={`/overlaps?i=${encodeURIComponent(inst.permanentId)}`} className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 ${overlap.status === 'Coordinated' ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50 hover:bg-rose-100'}`}>
          <div>
            <p className={`text-sm font-bold ${overlap.status === 'Coordinated' ? 'text-emerald-900' : 'text-rose-900'}`}>
              {overlap.status === 'Coordinated' ? 'Overlap coordinated' : OVERLAP_MESSAGE}
            </p>
            <p className="text-xs text-slate-600">
              Open cases with {overlap.bureaus.map((b) => `${b.short} (${b.count})`).join(', ')}.
              {overlap.record ? ` Lead: ${overlap.record.leadBureau}.` : ''}
            </p>
          </div>
          <OverlapBadge status={overlap.status} />
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total cases" value={stats.total} />
        <KpiCard label="Pending" value={stats.pending} tone="amber" />
        <KpiCard label="Under process" value={stats.underProcess} tone="navy" />
        <KpiCard label="Disposed" value={stats.disposed} tone="green" />
        <KpiCard label="Transferred" value={stats.transferred} tone="slate" />
        <KpiCard label="Escalated (open)" value={stats.escalated} tone="purple" />
        <KpiCard label="Beyond timeline" value={stats.overdue} tone="red" />
        <KpiCard label="Bureaus active" value={bureausInvolved.length} sub="With open cases" tone="navy" />
      </div>

      <Card title="Who is dealing with this institution" subtitle="Bureaus and cells with open cases" className="mt-6">
        {bureausInvolved.length === 0 ? (
          <p className="text-sm text-slate-500">No open cases.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bureausInvolved.map((b) => (
              <li key={b.bureau} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{b.bureau}</span>
                  <BureauChip bureau={b.bureau} count={b.open} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{b.officers.join(', ') || 'Unassigned'}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6">
        <Card
          title="Consolidated case history"
          subtitle="Every case about this institution, across all bureaus and cells"
          action={
            <select className="input !w-auto !py-1 !text-xs" value={filter} onChange={(e) => { setFilter(e.target.value); setShowAll(false); }} aria-label="Filter cases">
              <option value="all">All cases</option>
              <option value="open">Open</option>
              <option value="done">Disposed</option>
            </select>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th px-2">Case</th>
                  <th className="th px-2">With</th>
                  <th className="th px-2">Status</th>
                  <th className="th px-2">Timeline</th>
                  <th className="th px-2">Last action</th>
                  <th className="th px-2">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((c) => (
                  <tr key={c.complaintId} className="align-top">
                    <td className="px-2 py-2.5">
                      <Link href={`/complaints/${c.complaintId}`} className="font-medium text-navy-800 hover:underline">{c.title}</Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-mono">{c.complaintId}</span>
                        <span>{fmtDate(c.createdAt)}</span>
                        <PriorityBadge priority={c.priority} />
                        {c.transferCount ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">Transferred</span> : null}
                        {c.linked ? <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-teal-700">Linked</span> : null}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-xs">
                      <BureauChip bureau={c.bureau} />
                      <div className="mt-1 text-slate-500">{c.assignedToName || 'Unassigned'}</div>
                    </td>
                    <td className="px-2 py-2.5"><StatusBadge status={c.status} /></td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        <SlaBadge sla={c.sla} />
                        <EscalationBadge level={c.escalationLevel} />
                      </div>
                    </td>
                    <td className="max-w-[180px] px-2 py-2.5 text-xs text-slate-600">
                      {c.lastAction || '-'}
                      {c.lastActionAt ? <div className="text-[11px] text-slate-400">{fmtDate(c.lastActionAt)}</div> : null}
                    </td>
                    <td className="max-w-[180px] px-2 py-2.5 text-xs text-slate-600">
                      {c.nextAction || '-'}
                      {c.nextActionDue ? <div className="text-[11px] text-slate-400">by {fmtDate(c.nextActionDue)}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No cases to show.</p> : null}
          {filtered.length > shown.length ? (
            <button className="btn btn-secondary btn-sm mt-3" onClick={() => setShowAll(true)}>Show all {filtered.length} cases</button>
          ) : null}
          {!cases.every((c) => c.mine) ? (
            <p className="mt-3 text-xs text-slate-400">Cases held by other bureaus open in a read-only view so that you can coordinate.</p>
          ) : null}
        </Card>
      </div>
    </>
  );
}
