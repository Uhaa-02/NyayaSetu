'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { BureauChip, EmptyState, ErrorBox, OverlapBadge, PageHeader } from '@/components/ui';
import { REGIONS } from '@/lib/constants';


export default function InstitutionsPage() {
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');
  const [overlap, setOverlap] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page) });
      if (q) params.set('q', q);
      if (region) params.set('region', region);
      if (overlap) params.set('overlap', '1');
      api(`/api/institutions?${params}`)
        .then((d) => id === reqId.current && (setData(d), setError('')))
        .catch((e) => id === reqId.current && setError(e.message))
        .finally(() => id === reqId.current && setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, region, overlap, page]);

  return (
    <>
      <PageHeader
        title="Institutions"
        subtitle={data ? `${data.total} institution${data.total === 1 ? '' : 's'} in the registry. Every complaint is matched to one record by AICTE Permanent ID.` : 'Loading...'}
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input lg:col-span-2" placeholder="Search name, AICTE Permanent ID or city..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search institutions" />
        <select className="input" value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }} aria-label="Region">
          <option value="">All regions</option>
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={overlap} onChange={(e) => { setOverlap(e.target.checked); setPage(1); }} />
          Only with overlapping cases
        </label>
      </div>

      <ErrorBox>{error}</ErrorBox>

      <div className={`card overflow-hidden transition ${loading ? 'opacity-60' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">AICTE ID</th>
                <th className="th">Institution</th>
                <th className="th">Region</th>
                <th className="th text-right">Total cases</th>
                <th className="th text-right">Open</th>
                <th className="th">Bureaus with open cases</th>
                <th className="th">Overlap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.items || []).map((i) => (
                <tr key={i.permanentId} className="hover:bg-slate-50">
                  <td className="td font-mono text-xs">{i.permanentId}</td>
                  <td className="td">
                    <Link href={`/institutions/${i.permanentId}`} className="font-medium text-navy-800 hover:underline">{i.name}</Link>
                    <div className="text-xs text-slate-500">
                      {i.type} &middot; {i.city ? `${i.city}, ` : ''}{i.state}
                      {i.verified === false ? <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">Unverified</span> : null}
                    </div>
                  </td>
                  <td className="td text-xs">{i.region}</td>
                  <td className="td text-right tabular-nums">{i.totalCases}</td>
                  <td className="td text-right tabular-nums">{i.openCases}</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {i.bureaus.length ? i.bureaus.map((b) => (
                        <span key={b} className="rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-800 ring-1 ring-inset ring-navy-100">{b}</span>
                      )) : <span className="text-xs text-slate-400">-</span>}
                    </div>
                  </td>
                  <td className="td">{i.overlap ? <OverlapBadge status="Coordination Required" /> : <span className="text-xs text-slate-400">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.items.length === 0 ? <EmptyState title="No institutions found" hint="Try a different search." /> : null}
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
