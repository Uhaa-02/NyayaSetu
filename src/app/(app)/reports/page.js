'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, fmtDateTime } from '@/lib/client';
import { Card, EmptyState, ErrorBox, PageHeader, Spinner } from '@/components/ui';

const TYPES = [
  ['bureau', 'Bureau / Cell-wise'],
  ['region', 'Region-wise'],
  ['institution', 'Institution-wise'],
  ['status', 'Status-wise'],
  ['category', 'Category-wise'],
  ['ageing', 'Pending case ageing'],
  ['overlap', 'Overlapping cases'],
  ['monthly', 'Monthly performance'],
  ['quarterly', 'Quarterly performance'],
];
const NO_DATES = ['overlap', 'monthly', 'quarterly'];

export default function ReportsPage() {
  const [type, setType] = useState('bureau');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const query = useCallback(
    (extra = {}) => {
      const p = new URLSearchParams({ type, ...extra });
      if (from && !NO_DATES.includes(type)) p.set('from', from);
      if (to && !NO_DATES.includes(type)) p.set('to', to);
      return p.toString();
    },
    [type, from, to]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api(`/api/reports?${query()}`)
      .then((d) => alive && (setData(d), setError('')))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query]);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          subtitle="Bureau-wise, region-wise, institution-wise and status-wise reports, ageing, overlaps and monthly or quarterly performance. Download as CSV (opens in Excel) or print to PDF."
          actions={
            <>
              <a href={`/api/reports?${query({ format: 'csv' })}`} className="btn btn-primary btn-sm">Download CSV</a>
              <button onClick={() => window.print()} className="btn btn-secondary btn-sm">Print / Save as PDF</button>
            </>
          }
        />

        <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
          <select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Report type">
            {TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          {NO_DATES.includes(type) ? (
            <span className="text-xs text-slate-500">{type === 'overlap' ? 'Shows the current position.' : 'Covers the last 12 months / 6 quarters.'}</span>
          ) : (
            <>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                Filed from <input type="date" className="input !w-auto !py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                to <input type="date" className="input !w-auto !py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              {from || to ? <button className="text-xs font-semibold text-slate-500 hover:text-navy-700" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</button> : null}
            </>
          )}
          {loading ? <Spinner className="text-navy-600" /> : null}
        </div>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {data ? (
        <Card className="print:border-0 print:shadow-none">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-navy-900">{data.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{data.subtitle}</p>
            <p className="mt-0.5 text-xs text-slate-400">Scope: {data.scope} &middot; Generated {fmtDateTime(data.generatedAt)} &middot; NyayaSetu (synthetic demo data)</p>
          </div>
          {data.rows.length === 0 ? (
            <EmptyState title="No data for this selection" hint="Try widening the dates." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    {data.columns.map((c) => (
                      <th key={c.key} className={`th px-2 ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((r, i) => (
                    <tr key={i}>
                      {data.columns.map((c) => (
                        <td key={c.key} className={`px-2 py-2.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.key === 'name' ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                          {r[c.key] === '' || r[c.key] === undefined ? '-' : r[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </>
  );
}
