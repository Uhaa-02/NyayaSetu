'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { api, fmtDate } from '@/lib/client';
import {
  EmptyState,
  ErrorBox,
  EscalationBadge,
  PageHeader,
  PriorityBadge,
  SlaBadge,
  StatusBadge,
} from '@/components/ui';
import { BUREAUS, CATEGORIES, PRIORITIES, REGIONS, STATUSES, shortBureau } from '@/lib/constants';

const EMPTY_FILTERS = {
  q: '', status: '', stage: '', priority: '', category: '', bureau: '', region: '', from: '', to: '',
  sla: '', escalated: '', duplicates: '', transferred: '', overlap: '', institutionId: '', sort: 'newest',
};

function ComplaintsList() {
  const sp = useSearchParams();
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(Object.entries(EMPTY_FILTERS).map(([k, v]) => [k, sp.get(k) || v]))
  );
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [qInput, setQInput] = useState(filters.q);
  const reqId = useRef(0);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === qInput ? f : { ...f, q: qInput }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    params.set('page', String(page));
    api(`/api/complaints?${params.toString()}`)
      .then((d) => {
        if (id === reqId.current) {
          setData(d);
          setError('');
        }
      })
      .catch((e) => id === reqId.current && setError(e.message))
      .finally(() => id === reqId.current && setLoading(false));
  }, [filters, page]);

  const setFilter = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };
  const toggle = (k) => () => {
    setFilters((f) => ({ ...f, [k]: f[k] ? '' : k === 'sla' ? 'overdue' : '1' }));
    setPage(1);
  };
  const reset = () => {
    setQInput('');
    setFilters({ ...EMPTY_FILTERS });
    setPage(1);
  };

  const chip = (active) =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition ${
      active ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
    }`;

  return (
    <>
      <PageHeader
        title="Complaints"
        subtitle={data ? `${data.total} complaint${data.total === 1 ? '' : 's'} match your filters` : 'Loading...'}
        actions={<Link href="/complaints/new" className="btn btn-primary btn-sm">+ New complaint</Link>}
      />

      <div className="card mb-4 space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input
            className="input lg:col-span-2"
            placeholder="Search case ID, title, institution or AICTE ID..."
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            aria-label="Search complaints"
          />
          <select className="input" value={filters.status} onChange={setFilter('status')} aria-label="Status">
            <option value="">All statuses</option>
            <option value="open">Open (any)</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input" value={filters.priority} onChange={setFilter('priority')} aria-label="Priority">
            <option value="">All priorities</option>
            {PRIORITIES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input" value={filters.category} onChange={setFilter('category')} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input" value={filters.sort} onChange={setFilter('sort')} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="priority">Highest priority</option>
            <option value="deadline">Nearest deadline</option>
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select className="input" value={filters.bureau} onChange={setFilter('bureau')} aria-label="Bureau or cell">
            <option value="">All bureaus / cells</option>
            {BUREAUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" value={filters.region} onChange={setFilter('region')} aria-label="Region">
            <option value="">All regions</option>
            {REGIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input" value={filters.stage} onChange={setFilter('stage')} aria-label="Stage">
            <option value="">Any stage</option>
            <option value="pending">Pending (new)</option>
            <option value="process">Under process</option>
            <option value="disposed">Disposed</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            From
            <input type="date" className="input !py-1.5" value={filters.from} onChange={setFilter('from')} aria-label="Filed from" />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            To
            <input type="date" className="input !py-1.5" value={filters.to} onChange={setFilter('to')} aria-label="Filed to" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={chip(filters.sla === 'overdue')} onClick={toggle('sla')}>Beyond timeline</button>
          <button className={chip(filters.escalated === '1')} onClick={toggle('escalated')}>Escalated</button>
          <button className={chip(filters.transferred === '1')} onClick={toggle('transferred')}>Transferred</button>
          <button className={chip(filters.overlap === '1')} onClick={toggle('overlap')}>In an overlap</button>
          <button className={chip(filters.duplicates === '1')} onClick={toggle('duplicates')}>Possible duplicates</button>
          {filters.institutionId ? (
            <button className={chip(true)} onClick={() => { setFilters((f) => ({ ...f, institutionId: '' })); setPage(1); }}>
              Institution {filters.institutionId} &times;
            </button>
          ) : null}
          <button onClick={reset} className="ml-auto text-xs font-semibold text-slate-500 hover:text-navy-700">Clear all</button>
        </div>
      </div>

      <ErrorBox>{error}</ErrorBox>

      <div className={`card overflow-hidden transition ${loading ? 'opacity-60' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Complaint</th>
                <th className="th">Bureau / officer</th>
                <th className="th">Priority</th>
                <th className="th">Status</th>
                <th className="th">Timeline</th>
                <th className="th">Last action</th>
                <th className="th">Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.items || []).map((c) => (
                <tr key={c.complaintId} className="hover:bg-slate-50">
                  <td className="td max-w-xs">
                    <Link href={`/complaints/${c.complaintId}`} className="block font-medium text-navy-800 hover:underline">
                      {c.title}
                    </Link>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      <span className="font-mono">{c.complaintId}</span> &middot; {c.institution}
                      {c.institutionId ? <span className="ml-1 font-mono text-slate-400">({c.institutionId})</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="text-[11px] text-slate-400">{c.category} &middot; filed {fmtDate(c.createdAt)}</span>
                      {c.duplicateOf ? (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">Possible duplicate</span>
                      ) : null}
                      {c.transferCount > 0 ? (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">Transferred</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="td text-xs">
                    <span className="font-semibold text-navy-800">{shortBureau(c.bureau)}</span>
                    <div className="text-slate-500">{c.assignedToName || <span className="text-slate-400">Unassigned</span>}</div>
                  </td>
                  <td className="td"><PriorityBadge priority={c.priority} /></td>
                  <td className="td"><StatusBadge status={c.status} /></td>
                  <td className="td">
                    <div className="flex flex-col items-start gap-1">
                      <SlaBadge sla={c.sla} />
                      <EscalationBadge level={c.escalationLevel} />
                    </div>
                  </td>
                  <td className="td max-w-[200px] text-xs text-slate-600">
                    <span className="line-clamp-2">{c.lastAction || '-'}</span>
                    {c.lastActionAt ? <span className="text-[11px] text-slate-400">{fmtDate(c.lastActionAt)}</span> : null}
                  </td>
                  <td className="td max-w-[200px] text-xs text-slate-600">
                    <span className="line-clamp-2">{c.nextAction || (c.status === 'Closed' ? 'None' : '-')}</span>
                    {c.nextActionDue ? <span className="text-[11px] text-slate-400">by {fmtDate(c.nextActionDue)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.items.length === 0 ? (
          <EmptyState title="No complaints found" hint="Try clearing some filters." />
        ) : null}
        {!data && loading ? <div className="p-10 text-center text-sm text-slate-500">Loading complaints...</div> : null}
      </div>

      {data && data.pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {data.page} of {data.pages}</span>
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn btn-secondary btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function ComplaintsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading...</div>}>
      <ComplaintsList />
    </Suspense>
  );
}
