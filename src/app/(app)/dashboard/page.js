'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { formatDuration } from '@/lib/sla';
import {
  AgingBars,
  CategoryBars,
  Heatmap,
  PriorityBars,
  StatusDonut,
  TrendChart,
} from '@/components/charts';
import {
  BureauChip,
  Card,
  ErrorBox,
  EscalationBadge,
  KpiCard,
  PageHeader,
  PriorityBadge,
  SeverityBadge,
  Spinner,
  SuccessBox,
} from '@/components/ui';
import { OVERLAP_MESSAGE } from '@/lib/constants';

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="skeleton h-80 xl:col-span-2" />
        <div className="skeleton h-80" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [slaResult, setSlaResult] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await api('/api/analytics'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runSla() {
    setRunning(true);
    setSlaResult(null);
    try {
      const r = await api('/api/escalate', { method: 'POST' });
      setSlaResult(r);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  if (error && !data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorBox>{error}</ErrorBox>
        <button onClick={load} className="btn btn-secondary mt-4">Try again</button>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Loading live figures..." />
        <Skeleton />
      </>
    );
  }

  const k = data.kpis;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${data.scope} - signed in as ${data.viewer.roleLabel}`}
        actions={
          <>
            <button onClick={load} className="btn btn-secondary btn-sm">Refresh</button>
            <button onClick={runSla} disabled={running} className="btn btn-primary btn-sm">
              {running ? <Spinner /> : null}
              Run SLA check
            </button>
          </>
        }
      />

      {slaResult ? (
        <div className="mb-6">
          <SuccessBox>
            <strong>SLA check complete.</strong>{' '}
            {slaResult.escalated === 0
              ? 'No new breaches found. Everything overdue has already been escalated.'
              : `${slaResult.escalated} overdue complaint${slaResult.escalated === 1 ? '' : 's'} escalated automatically.`}
            {slaResult.items?.length ? (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
                {slaResult.items.slice(0, 5).map((i) => (
                  <li key={i.complaintId}>
                    <Link href={`/complaints/${i.complaintId}`} className="font-mono font-semibold underline">{i.complaintId}</Link>{' '}
                    ({i.priority}) &rarr; {i.escalatedTo}
                    {i.assignee ? ` - ${i.assignee}` : ''}
                  </li>
                ))}
                {slaResult.items.length > 5 ? <li>and {slaResult.items.length - 5} more</li> : null}
              </ul>
            ) : null}
          </SuccessBox>
        </div>
      ) : null}
      {error ? <div className="mb-6"><ErrorBox>{error}</ErrorBox></div> : null}

      {/* Overlap banner: the headline feature */}
      {data.overlaps.required > 0 ? (
        <Link
          href="/overlaps"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 transition hover:bg-rose-100"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-lg font-bold text-white">{data.overlaps.required}</span>
            <div>
              <p className="text-sm font-bold text-rose-900">{OVERLAP_MESSAGE}</p>
              <p className="text-xs text-rose-800">
                {data.overlaps.required} institution{data.overlaps.required === 1 ? ' has' : 's have'} open cases with more than one bureau or cell at the same time.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-rose-900">Open overlap monitor &rarr;</span>
        </Link>
      ) : null}

      {/* KPIs: case status as listed in the problem statement */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total received" value={k.total} sub={`${k.resolutionRate}% disposed`} href="/complaints" />
        <KpiCard label="Pending" value={k.pending} sub="New, not yet picked up" tone="amber" href="/complaints?stage=pending" />
        <KpiCard label="Under process" value={k.underProcess} sub="In review or hearing" tone="navy" href="/complaints?stage=process" />
        <KpiCard label="Disposed" value={k.disposed} sub="Resolved or closed" tone="green" href="/complaints?stage=disposed" />
        <KpiCard label="Transferred" value={k.transferred} sub="Moved between bureaus" tone="slate" href="/complaints?transferred=1" />
        <KpiCard label="Escalated (open)" value={k.escalated} sub="Moved up the ladder" tone="purple" href="/complaints?escalated=1" />
        <KpiCard label="Beyond timeline" value={k.overdue} sub={`${k.dueSoon} more due within 24h`} tone="red" href="/complaints?sla=overdue&sort=deadline" />
        <KpiCard label="Overlapping institutions" value={data.overlaps.required} sub={`${data.overlaps.coordinated} already coordinated`} tone="red" href="/overlaps" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Disposal rate" value={`${k.resolutionRate}%`} sub="Disposed / received" tone="green" />
        <KpiCard label="Avg. time to dispose" value={`${k.avgResolutionDays}d`} sub="For disposed complaints" tone="slate" />
        <KpiCard label="Within-timeline rate" value={`${k.slaCompliance}%`} sub="Disposed within original deadline" tone="green" />
        <KpiCard label="Critical open" value={k.criticalOpen} sub="Highest-priority cases" tone="amber" href="/complaints?status=open&priority=Critical" />
      </div>

      {/* trend + status */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Complaints received vs resolved" subtitle="Last 6 months" className="xl:col-span-2">
          <TrendChart data={data.trend} />
        </Card>
        <Card title="Status overview" subtitle="All complaints in scope">
          <StatusDonut data={data.byStatus} total={k.total} />
        </Card>
      </div>

      {/* overlaps + approaching timelines */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card
          title="Overlapping cases needing coordination"
          subtitle="Same institution, more than one bureau or cell"
          action={<Link href="/overlaps" className="text-xs font-semibold text-navy-700 hover:underline">View all</Link>}
        >
          {data.overlaps.top.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No overlapping cases need coordination.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.overlaps.top.map((g) => (
                <li key={g.institutionId}>
                  <Link href={`/overlaps?i=${encodeURIComponent(g.institutionId)}`} className="block py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{g.institution}</p>
                        <p className="text-xs text-slate-500"><span className="font-mono">{g.institutionId}</span> &middot; {g.state}</p>
                      </div>
                      <SeverityBadge severity={g.severity} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {g.bureaus.map((b) => (
                        <span key={b.short} className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-800 ring-1 ring-inset ring-navy-100">
                          {b.short}<span className="rounded bg-white px-1 text-[10px] tabular-nums text-slate-600">{b.count}</span>
                        </span>
                      ))}
                      {g.hasRbPgrc ? <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">RB + PGRC</span> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Approaching timelines"
          subtitle="Open cases due within 48 hours"
          action={<Link href="/alerts" className="text-xs font-semibold text-navy-700 hover:underline">All alerts</Link>}
        >
          {data.dueSoonList.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nothing is about to breach its timeline.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.dueSoonList.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="flex items-start justify-between gap-3 py-3 hover:bg-slate-50">
                    <p className="min-w-0 truncate text-sm text-slate-800">{a.detail}</p>
                    <span className="shrink-0 text-xs font-semibold text-amber-700">{a.title.replace('Timeline ends in', 'Due in')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* categories + workload */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Complaints by category" subtitle="Where the problems are" className="xl:col-span-2">
          <CategoryBars data={data.byCategory} />
        </Card>
        <div className="space-y-6">
          <Card title="Open workload by priority">
            <PriorityBars data={data.byPriority} />
          </Card>
          <Card title="Ageing of open complaints" subtitle="Days since filed">
            <AgingBars data={data.aging} />
          </Card>
        </div>
      </div>

      {/* bureaus */}
      {data.byBureau.length > 1 ? (
        <Card title="Bureau / cell-wise workload" subtitle="Where each case currently sits, and how fast each bureau disposes of cases" className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th px-2">Bureau / cell</th>
                  <th className="th px-2 text-right">Total</th>
                  <th className="th px-2 text-right">Pending</th>
                  <th className="th px-2 text-right">Under process</th>
                  <th className="th px-2 text-right">Disposed</th>
                  <th className="th px-2 text-right">Transferred</th>
                  <th className="th px-2 text-right">Escalated</th>
                  <th className="th px-2 text-right">Beyond timeline</th>
                  <th className="th px-2 text-right">Avg. days</th>
                  <th className="th w-36 px-2">Disposal rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.byBureau.map((b) => {
                  const rate = b.total ? Math.round((b.resolved / b.total) * 100) : 0;
                  return (
                    <tr key={b.bureau}>
                      <td className="px-2 py-3 font-medium text-slate-800">
                        <Link href={`/complaints?bureau=${encodeURIComponent(b.bureau)}`} className="hover:underline">{b.bureau}</Link>
                        <span className="ml-2"><BureauChip bureau={b.bureau} /></span>
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">{b.total}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{b.pending}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{b.underProcess}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{b.resolved}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{b.transferred}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{b.escalated}</td>
                      <td className={`px-2 py-3 text-right font-semibold tabular-nums ${b.overdue ? 'text-red-600' : 'text-slate-400'}`}>{b.overdue}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{b.avgResolutionDays || '-'}</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="w-9 text-right text-xs tabular-nums text-slate-500">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* geography */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Region x category heatmap" subtitle="Darker = more complaints" className="xl:col-span-2">
          <Heatmap data={data.heatmap} />
        </Card>
        <Card title="Top states" subtitle="Most complaints">
          <ul className="space-y-2.5">
            {data.byState.map((s, i) => {
              const max = data.byState[0].value || 1;
              return (
                <li key={s.name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-slate-600">{i + 1}. {s.name}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{s.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-navy-600" style={{ width: `${(s.value / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* repeat institutions + alerts */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Institution-wise case status" subtitle="Most complaints against them (repeat-offender detection)" action={<Link href="/institutions" className="text-xs font-semibold text-navy-700 hover:underline">All institutions</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="th px-2">Institution</th>
                  <th className="th px-1 text-right">Total</th>
                  <th className="th px-1 text-right">Pending</th>
                  <th className="th px-1 text-right">Active</th>
                  <th className="th px-1 text-right">Done</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topInstitutions.map((i) => (
                  <tr key={i.institutionId || i.institution}>
                    <td className="px-2 py-2.5">
                      <Link href={i.institutionId ? `/institutions/${i.institutionId}` : `/complaints?q=${encodeURIComponent(i.institution)}`} className="font-medium text-navy-800 hover:underline">
                        {i.institution}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {i.institutionId ? <span className="mr-2 font-mono">{i.institutionId}</span> : null}
                        {i.state}
                        {i.repeat ? <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700">Repeat</span> : null}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{i.total}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{i.pending}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{i.underProcess}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{i.disposed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="Cases beyond the prescribed timeline"
          subtitle="Most overdue open complaints"
          action={<Link href="/complaints?sla=overdue&sort=deadline" className="text-xs font-semibold text-navy-700 hover:underline">View all</Link>}
        >
          {data.alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No overdue complaints. Great work.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.alerts.map((a) => (
                <li key={a.complaintId}>
                  <Link href={`/complaints/${a.complaintId}`} className="flex items-start justify-between gap-3 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{a.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        <span className="font-mono">{a.complaintId}</span> &middot; {a.institution}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs font-semibold text-red-600">Overdue {formatDuration(a.hoursOverdue)}</span>
                      <div className="flex gap-1">
                        <PriorityBadge priority={a.priority} />
                        <EscalationBadge level={a.escalationLevel} />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
