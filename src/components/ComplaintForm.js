'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, fmtDate } from '@/lib/client';
import { ErrorBox, Spinner } from '@/components/ui';
import { STATES } from '@/lib/constants';

const EMPTY = {
  complainantName: '',
  complainantEmail: '',
  complainantPhone: '',
  institution: '',
  institutionId: '',
  documentUrl: '',
  state: '',
  title: '',
  description: '',
  website: '', // honeypot - must stay empty
};

// Used by the public /submit page and by staff on /complaints/new.
export default function ComplaintForm({ internal = false, viewer = null }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);

  const [suggestions, setSuggestions] = useState([]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // type-ahead from the institution registry (public endpoint: name, state and ID only)
  useEffect(() => {
    const q = form.institution.trim();
    if (q.length < 2) return setSuggestions([]);
    const t = setTimeout(() => {
      fetch(`/api/institutions/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setSuggestions(d.items || []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [form.institution]);

  function pickInstitution(name) {
    const hit = suggestions.find((x) => x.name === name);
    if (hit) setForm((f) => ({ ...f, institution: hit.name, institutionId: hit.permanentId, state: f.state || hit.state }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api('/api/complaints', { method: 'POST', body: form });
      setDone(res);
      setForm(EMPTY);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyId() {
    try {
      await navigator.clipboard.writeText(done.complaintId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (done) {
    const canOpen =
      internal && viewer && (viewer.role === 'chairman' || (viewer.role === 'bureau_head' && viewer.bureau === done.bureau));
    return (
      <div className="card mx-auto max-w-2xl p-6 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-bold text-navy-900">Complaint registered</h2>
        <p className="mt-1 text-sm text-slate-600">
          {internal ? 'The complaint has been triaged and assigned.' : 'Keep this ID safe. You will need it, with your email, to track progress.'}
        </p>
        <div className="mx-auto mt-5 inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="font-mono text-lg font-bold tracking-wide text-navy-900">{done.complaintId}</span>
          <button onClick={copyId} className="btn btn-secondary btn-sm">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <dl className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-3 text-left text-sm">
          <div className="rounded-lg bg-navy-50 p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</dt>
            <dd className="mt-0.5 font-medium text-navy-900">{done.category}</dd>
          </div>
          <div className="rounded-lg bg-navy-50 p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Routed to</dt>
            <dd className="mt-0.5 font-medium text-navy-900">{done.bureau}</dd>
          </div>
        </dl>
        {internal && done.institutionId ? (
          <p className="mt-4 text-xs text-slate-500">
            Matched to <Link className="font-semibold text-navy-700 hover:underline" href={`/institutions/${done.institutionId}`}>{done.institution}</Link> (AICTE ID {done.institutionId}).
          </p>
        ) : null}
        {internal && done.overlap ? (
          <div className="mx-auto mt-4 max-w-md rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-900">
            <p className="font-bold">Potential Overlapping Cases &ndash; Coordination Required</p>
            <p className="mt-0.5 text-xs">
              This institution already has {done.overlap.count} open case{done.overlap.count === 1 ? '' : 's'} with another bureau ({done.overlap.caseIds.slice(0, 3).join(', ')}). Both sides were notified in their audit trails.
            </p>
            <Link href={`/overlaps?i=${encodeURIComponent(done.institutionId)}`} className="mt-1 inline-block text-xs font-semibold underline">Open in overlap monitor</Link>
          </div>
        ) : null}
        <p className="mt-4 text-xs text-slate-500">Expected first response by {fmtDate(done.expectedBy)}.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {internal ? (
            <>
              <button onClick={() => setDone(null)} className="btn btn-primary">
                Register another
              </button>
              {canOpen ? (
                <Link href={`/complaints/${done.complaintId}`} className="btn btn-secondary">
                  Open complaint
                </Link>
              ) : (
                <Link href="/complaints" className="btn btn-secondary">
                  Back to complaints
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/track" className="btn btn-primary">
                Track this complaint
              </Link>
              <button onClick={() => setDone(null)} className="btn btn-secondary">
                File another
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-3xl space-y-5 p-5 sm:p-8" noValidate>
      {/* honeypot: hidden from people, tempting for bots */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Complainant name *</label>
          <input id="name" className="input" value={form.complainantName} onChange={set('complainantName')} maxLength={100} required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email *</label>
          <input id="email" type="email" className="input" value={form.complainantEmail} onChange={set('complainantEmail')} maxLength={150} required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone (optional)</label>
          <input id="phone" type="tel" className="input" value={form.complainantPhone} onChange={set('complainantPhone')} maxLength={20} />
        </div>
        <div>
          <label className="label" htmlFor="state">State *</label>
          <select id="state" className="input" value={form.state} onChange={set('state')} required>
            <option value="">Select state</option>
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="institution">Institution the complaint is about *</label>
          <input
            id="institution"
            className="input"
            list="institution-options"
            value={form.institution}
            onChange={(e) => {
              set('institution')(e);
              pickInstitution(e.target.value);
            }}
            maxLength={150}
            placeholder="Start typing the college / institute name"
            autoComplete="off"
            required
          />
          <datalist id="institution-options">
            {suggestions.map((x) => <option key={x.permanentId} value={x.name}>{x.permanentId} - {x.state}</option>)}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="institutionId">AICTE ID (optional)</label>
          <input id="institutionId" className="input font-mono" value={form.institutionId} onChange={set('institutionId')} maxLength={20} placeholder="1-46218355084" />
        </div>
      </div>
      <p className="-mt-3 text-xs text-slate-400">Spelling does not matter much. We match the name to the institution register and link it with other cases about the same institution.</p>

      <div>
        <label className="label" htmlFor="title">Complaint title *</label>
        <input id="title" className="input" value={form.title} onChange={set('title')} maxLength={150} placeholder="One line describing the problem" required />
      </div>

      <div>
        <label className="label" htmlFor="description">Describe the issue *</label>
        <textarea
          id="description"
          className="input min-h-[150px]"
          value={form.description}
          onChange={set('description')}
          maxLength={4000}
          placeholder="What happened, when, who is involved and how many students are affected? Mention any documents you hold."
          required
        />
        <p className="mt-1 text-right text-xs text-slate-400">{form.description.length}/4000</p>
      </div>

      <div>
        <label className="label" htmlFor="documentUrl">Link to supporting documents (optional)</label>
        <input id="documentUrl" type="url" className="input" value={form.documentUrl} onChange={set('documentUrl')} maxLength={500} placeholder="https://drive.google.com/... (receipts, letters, photos)" />
      </div>

      <ErrorBox>{error}</ErrorBox>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-xs text-slate-500">
          Your complaint is automatically categorised and routed to the right bureau. Do not include passwords or
          bank details.
        </p>
        <button type="submit" disabled={busy} className="btn btn-primary px-6">
          {busy ? <Spinner /> : null}
          {busy ? 'Submitting...' : internal ? 'Register complaint' : 'Submit complaint'}
        </button>
      </div>
    </form>
  );
}
