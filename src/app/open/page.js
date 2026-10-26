'use client';

import { useCallback, useEffect, useState } from 'react';
import PublicHeader from '@/components/PublicHeader';
import { ErrorBox, Spinner } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';
import { REGIONS, STATE_REGION } from '@/lib/constants';

const BUCKETS = {
  unsolved: { label: 'Unsolved', hint: 'Not yet picked up', pill: 'bg-red-50 text-red-700 ring-red-200', bar: 'bg-red-400', tile: 'text-red-700' },
  progress: { label: 'In progress', hint: 'Being reviewed or heard', pill: 'bg-amber-50 text-amber-800 ring-amber-200', bar: 'bg-amber-400', tile: 'text-amber-700' },
  solved: { label: 'Solved', hint: 'Resolved or closed', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500', tile: 'text-emerald-700' },
};

const STATES = Object.keys(STATE_REGION).sort();
const EMPTY = { region: '', state: '', status: '', q: '', page: 1 };

function readUrl() {
  if (typeof window === 'undefined') return EMPTY;
  const p = new URLSearchParams(window.location.search);
  return {
    region: p.get('region') || '',
    state: p.get('state') || '',
    status: p.get('status') || '',
    q: p.get('q') || '',
    page: Math.max(1, parseInt(p.get('page') || '1', 10) || 1),
  };
}

function Pill({ bucket }) {
  const b = BUCKETS[bucket];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${b.pill}`}>{b.label}</span>;
}

function StackBar({ s }) {
  if (!s.total) return <div className="h-2 rounded-full bg-slate-100" />;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${s.solved} solved, ${s.progress} in progress, ${s.unsolved} unsolved`}>
      <div className={BUCKETS.solved.bar} style={{ width: `${(s.solved / s.total) * 100}%` }} />
      <div className={BUCKETS.progress.bar} style={{ width: `${(s.progress / s.total) * 100}%` }} />
      <div className={BUCKETS.unsolved.bar} style={{ width: `${(s.unsolved / s.total) * 100}%` }} />
    </div>
  );
}

export default function OpenDashboard() {
  const [f, setF] = useState(EMPTY);
  const [qText, setQText] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // read filters from the address bar once, so a link like /open?region=Southern can be shared
  useEffect(() => {
    const init = readUrl();
    setF(init);
    setQText(init.q);
    setReady(true);
  }, []);

  const load = useCallback(async (filters, quiet = false) => {
    if (!quiet) setBusy(true);
    setError('');
    try {
      const p = new URLSearchParams();
      for (const k of ['region', 'state', 'status', 'q']) if (filters[k]) p.set(k, filters[k]);
      if (filters.page > 1) p.set('page', String(filters.page));
      const qs = p.toString();
      window.history.replaceState(null, '', qs ? `/open?${qs}` : '/open');
      setData(await api(`/api/public/complaints${qs ? `?${qs}` : ''}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (ready) load(f);
  }, [ready, f, load]);

  // refresh every minute so the board stays current
  useEffect(() => {
    const t = setInterval(() => load(f, true), 60000);
    return () => clearInterval(t);
  }, [f, load]);

  // wait for the user to stop typing before searching
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setF((cur) => (cur.q === qText.trim() ? cur : { ...cur, q: qText.trim(), page: 1 })), 400);
    return () => clearTimeout(t);
  }, [qText, ready]);

  const set = (patch) => setF((cur) => ({ ...cur, page: 1, ...patch }));
  const clear = () => {
    setQText('');
    setF(EMPTY);
  };
  const statesForRegion = f.region ? STATES.filter((s) => STATE_REGION[s] === f.region) : STATES;
  const sum = data?.summary;
  const filtered = f.region || f.state || f.status || f.q;

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">Open complaints dashboard</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          See which complaints against institutions have been filed in your region and whether they are unsolved, in progress or solved. Anyone can view this page. No login is needed.
        </p>
        <p className="mt-2 max-w-3xl rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Privacy: names, e-mail addresses, complaint text and officer details are never shown here. To see the full progress of your own complaint, use{' '}
          <a className="font-semibold text-navy-700 underline" href="/track">Track status</a>.
        </p>

        {/* filters */}
        <section className="card mt-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
          <div>
            <label className="label" htmlFor="region">Region</label>
            <select id="region" className="input" value={f.region} onChange={(e) => set({ region: e.target.value, state: '' })}>
              <option value="">All regions</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="state">State</label>
            <select id="state" className="input" value={f.state} onChange={(e) => set({ state: e.target.value })}>
              <option value="">All states</option>
              {statesForRegion.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q">Institution or complaint ID</label>
            <input id="q" className="input" placeholder="e.g. ACE Engineering College" value={qText} onChange={(e) => setQText(e.target.value)} />
          </div>
          <button type="button" className="btn btn-secondary" onClick={clear} disabled={!filtered}>Clear</button>
        </section>

        <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>

        {/* summary tiles (click to filter by status) */}
        <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
          <button type="button" onClick={() => set({ status: '' })} className={`card p-4 text-left ${!f.status ? 'ring-2 ring-navy-600' : ''}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">All complaints</p>
            <p className="mt-1 text-3xl font-bold text-navy-900">{sum ? sum.total : '-'}</p>
            <p className="text-xs text-slate-500">{sum ? `${sum.solvedPct}% solved` : ' '}</p>
          </button>
          {Object.entries(BUCKETS).map(([k, b]) => (
            <button key={k} type="button" onClick={() => set({ status: f.status === k ? '' : k })} className={`card p-4 text-left ${f.status === k ? 'ring-2 ring-navy-600' : ''}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{b.label}</p>
              <p className={`mt-1 text-3xl font-bold ${b.tile}`}>{sum ? sum[k] : '-'}</p>
              <p className="text-xs text-slate-500">{b.hint}</p>
            </button>
          ))}
        </section>

        {/* region overview */}
        {data ? (
          <section className="card mt-6 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900">By region</h2>
            <p className="text-xs text-slate-500">Select a region to see its complaints.</p>
            <ul className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {data.regions.map((r) => (
                <li key={r.region} className={r.total ? '' : 'opacity-50'}>
                  <button type="button" onClick={() => set({ region: f.region === r.region ? '' : r.region, state: '' })} className={`w-full rounded-lg p-2 text-left hover:bg-slate-50 ${f.region === r.region ? 'bg-navy-50 ring-1 ring-navy-200' : ''}`}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-slate-800">{r.region}</span>
                      <span className="text-xs text-slate-500">{r.total} total · {r.solvedPct}% solved</span>
                    </div>
                    <StackBar s={r} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
              {Object.entries(BUCKETS).map(([k, b]) => (
                <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${b.bar}`} />{b.label}</span>
              ))}
            </p>
          </section>
        ) : null}

        {/* list */}
        <section className="mt-6" aria-live="polite">
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              {data ? `${data.total} complaint${data.total === 1 ? '' : 's'}` : 'Complaints'}
              {f.region ? ` in ${f.region} region` : ''}{f.state ? `, ${f.state}` : ''}
            </h2>
            {busy ? <Spinner /> : null}
          </div>

          {data && !data.items.length ? (
            <div className="card mt-3 p-8 text-center text-sm text-slate-500">No complaints match these filters.</div>
          ) : null}

          <div className="mt-3 space-y-2">
            {(data?.items || []).map((c) => (
              <article key={c.id} className="card grid gap-2 p-4 sm:grid-cols-[1.6fr_1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-900">{c.institution}</p>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{c.id}</span> · {c.state} ({c.region})
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  <p>{c.category}</p>
                  <p className="text-xs text-slate-400">
                    {c.bureau} · filed {fmtDate(c.filedAt)} · {c.status === 'solved' ? `solved in ${c.days} day${c.days === 1 ? '' : 's'}` : `open ${c.days} day${c.days === 1 ? '' : 's'}`}
                  </p>
                </div>
                <div className="sm:text-right"><Pill bucket={c.status} /></div>
              </article>
            ))}
          </div>

          {data && data.pages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button type="button" className="btn btn-secondary btn-sm" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>Previous</button>
              <span className="text-slate-500">Page {data.page} of {data.pages}</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={f.page >= data.pages} onClick={() => setF({ ...f, page: f.page + 1 })}>Next</button>
            </div>
          ) : null}

          {data ? <p className="mt-6 text-xs text-slate-400">Updated {new Date(data.updatedAt).toLocaleTimeString('en-IN')}. The demo uses sample complaints.</p> : null}
        </section>
      </main>
    </>
  );
}
