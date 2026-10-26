'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, fmtDateTime } from '@/lib/client';
import {
  BureauChip,
  Card,
  ErrorBox,
  EscalationBadge,
  OverlapBadge,
  PriorityBadge,
  SlaBadge,
  Spinner,
  StatusBadge,
  SuccessBox,
} from '@/components/ui';
import {
  BUREAUS,
  ESCALATION_LEVELS,
  OPEN_STATUSES,
  OVERLAP_MESSAGE,
  PRIORITIES,
  ROLE_LABELS,
  TRANSITIONS,
  shortBureau,
} from '@/lib/constants';

const DOT = {
  created: 'bg-navy-600',
  classified: 'bg-indigo-400',
  assigned: 'bg-slate-400',
  status: 'bg-blue-500',
  note: 'bg-slate-400',
  escalated: 'bg-red-500',
  priority: 'bg-amber-500',
  duplicate: 'bg-amber-500',
  bureau: 'bg-purple-500',
  overlap: 'bg-rose-500',
  coordination: 'bg-emerald-500',
  link: 'bg-teal-500',
  document: 'bg-teal-500',
  next_action: 'bg-sky-500',
};

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children || '-'}</dd>
    </div>
  );
}

function OverlapBanner({ overlap, current }) {
  const others = overlap.bureaus
    .map((b) => ({ ...b, cases: b.cases }))
    .filter((b) => b.cases.length > 0);
  const coordinated = overlap.status === 'Coordinated';
  return (
    <div className={`mb-6 rounded-xl border px-5 py-4 ${coordinated ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm font-bold ${coordinated ? 'text-emerald-900' : 'text-rose-900'}`}>
          {coordinated ? 'Overlap coordinated' : OVERLAP_MESSAGE}
        </p>
        <div className="flex items-center gap-2">
          <OverlapBadge status={overlap.status} />
          <Link href={`/overlaps?i=${encodeURIComponent(overlap.institutionId)}`} className="text-xs font-semibold text-navy-700 hover:underline">Open in overlap monitor &rarr;</Link>
        </div>
      </div>
      <p className={`mt-1 text-xs ${coordinated ? 'text-emerald-800' : 'text-rose-800'}`}>
        This institution has open cases with more than one bureau or cell. Avoid duplicate or conflicting action; check the other cases below.
      </p>
      {overlap.record ? (
        <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-700">
          <strong>Lead: {overlap.record.leadBureau}.</strong> {overlap.record.note} <span className="text-slate-400">({overlap.record.coordinatedBy}, {fmtDate(overlap.record.coordinatedAt)})</span>
          {overlap.record.stale ? <span className="ml-1 font-semibold text-rose-700">A new bureau has joined since, so coordination must be reviewed.</span> : null}
        </p>
      ) : null}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {others.map((b) => (
          <li key={b.bureau} className="rounded-lg bg-white/80 p-3 ring-1 ring-black/5">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <BureauChip bureau={b.bureau} /> {b.bureau === current.bureau ? 'This bureau (other cases)' : b.bureau}
            </p>
            <ul className="mt-1.5 space-y-1">
              {b.cases.slice(0, 3).map((x) => (
                <li key={x.complaintId} className="flex items-center justify-between gap-2 text-xs">
                  <Link href={`/complaints/${x.complaintId}`} className="min-w-0 truncate text-navy-800 hover:underline">
                    <span className="font-mono font-semibold">{x.complaintId}</span> {x.title}
                  </Link>
                  <StatusBadge status={x.status} />
                </li>
              ))}
              {b.cases.length > 3 ? <li className="text-[11px] text-slate-400">+ {b.cases.length - 3} more</li> : null}
              {b.cases[0]?.assignedToName ? <li className="text-[11px] text-slate-400">Officer: {b.cases[0].assignedToName}</li> : null}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrackingCard({ c }) {
  const overdueNext = c.nextActionDue && new Date(c.nextActionDue) < new Date() && OPEN_STATUSES.includes(c.status);
  return (
    <Card title="Case tracking" subtitle="Who has it, what was done last and what happens next">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="label">Presently with</p>
          <p className="text-sm font-semibold text-slate-800">{c.bureau} ({shortBureau(c.bureau)})</p>
          <p className="text-xs text-slate-500">Officer: {c.assignedToName || 'Unassigned'}{c.escalationLevel > 0 ? ` - escalated to ${ESCALATION_LEVELS[c.escalationLevel]}` : ''}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="label">Expected disposal date</p>
          <p className="text-sm font-semibold text-slate-800">{OPEN_STATUSES.includes(c.status) ? fmtDate(c.slaDeadline) : `Disposed ${fmtDate(c.resolvedAt)}`}</p>
          <p className="text-xs text-slate-500">Filed {fmtDate(c.createdAt)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="label">Last action taken</p>
          <p className="text-sm text-slate-800">{c.lastAction || '-'}</p>
          <p className="text-xs text-slate-500">{c.lastActionAt ? fmtDateTime(c.lastActionAt) : ''}{c.lastActionBy ? ` - ${c.lastActionBy}` : ''}</p>
        </div>
        <div className={`rounded-lg p-3 ${overdueNext ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50'}`}>
          <p className="label">Next action required</p>
          <p className="text-sm text-slate-800">{c.nextAction || (OPEN_STATUSES.includes(c.status) ? 'Not set' : 'None')}</p>
          <p className={`text-xs ${overdueNext ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
            {c.nextActionDue ? `${overdueNext ? 'Overdue since' : 'Due by'} ${fmtDate(c.nextActionDue)}` : ''}
          </p>
        </div>
      </div>
      {c.transfers?.length ? (
        <div className="mt-4">
          <p className="label">Transfer history</p>
          <ol className="mt-1 space-y-1 text-xs text-slate-600">
            {c.transfers.map((t, i) => (
              <li key={i}>
                <strong>{shortBureau(t.from)}</strong> &rarr; <strong>{shortBureau(t.to)}</strong> on {fmtDate(t.at)} by {t.by}
                {t.reason ? <span className="text-slate-400"> - {t.reason}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Card>
  );
}

function ActionPanel({ complaint, me, id, onUpdated }) {
  const router = useRouter();
  const isManager = me.role === 'bureau_head' || me.role === 'chairman';
  const isOpen = OPEN_STATUSES.includes(complaint.status);
  const transitions = (TRANSITIONS[complaint.status] || []).filter(
    (s) => !(complaint.status === 'Closed' && !isManager)
  );

  const [tab, setTab] = useState(me.role === 'regional' ? 'note' : 'status');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [staff, setStaff] = useState([]);
  const [f, setF] = useState({
    status: '', note: '', assignee: '', priority: '', priorityReason: '', bureau: '', bureauReason: '', escalateReason: '',
    nextText: complaint.nextAction || '', nextDue: complaint.nextActionDue ? new Date(complaint.nextActionDue).toISOString().slice(0, 10) : '',
    linkId: '', docName: '', docUrl: '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (!isManager) return;
    api(`/api/users?bureau=${encodeURIComponent(complaint.bureau)}`)
      .then((d) => setStaff(d.users))
      .catch(() => {});
  }, [isManager, complaint.bureau]);

  async function act(body, okText, resetKeys = []) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api(`/api/complaints/${id}`, { method: 'PATCH', body });
      if (res.moved) {
        alert(res.message);
        router.push('/complaints');
        return;
      }
      onUpdated(res);
      setMsg({ type: 'ok', text: okText });
      setF((x) => ({ ...x, ...Object.fromEntries(resetKeys.map((k) => [k, ''])) }));
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const canChangeStatus = me.role !== 'regional';
  const tabs = [
    ...(canChangeStatus ? [['status', 'Status']] : []),
    ['note', 'Note'],
    ['coordinate', 'Coordinate'],
    ...(isManager ? [['manage', 'Manage']] : []),
  ];
  const tabClass = (t) =>
    `flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${tab === t ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`;
  const needsNote = ['Resolved', 'Closed'].includes(f.status);

  return (
    <Card title="Actions">
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); setMsg(null); }} className={tabClass(t)}>{label}</button>
        ))}
      </div>

      <div className="space-y-3">
        {msg?.type === 'ok' ? <SuccessBox>{msg.text}</SuccessBox> : null}
        {msg?.type === 'err' ? <ErrorBox>{msg.text}</ErrorBox> : null}

        {tab === 'status' ? (
          transitions.length ? (
            <>
              <div>
                <label className="label">Move to</label>
                <select className="input" value={f.status} onChange={set('status')}>
                  <option value="">Select new status</option>
                  {transitions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{needsNote ? 'Outcome note (shown to complainant) *' : 'Note (optional, internal)'}</label>
                <textarea className="input min-h-[80px]" value={f.note} onChange={set('note')} maxLength={1000} placeholder={needsNote ? 'Describe the action taken and the outcome...' : 'Add context for your team...'} />
              </div>
              <button
                className="btn btn-primary w-full"
                disabled={busy || !f.status}
                onClick={() => act({ action: 'status', status: f.status, note: f.note }, `Status updated to ${f.status}.`, ['status', 'note'])}
              >
                {busy ? <Spinner /> : null}
                Update status
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">No status changes are available for you on this complaint.</p>
          )
        ) : null}

        {tab === 'note' ? (
          <>
            <div>
              <label className="label">Internal note</label>
              <textarea className="input min-h-[100px]" value={f.note} onChange={set('note')} maxLength={1000} placeholder="Visible to staff only. Never shown to the complainant." />
            </div>
            <button className="btn btn-primary w-full" disabled={busy || f.note.trim().length < 3} onClick={() => act({ action: 'note', note: f.note }, 'Note added.', ['note'])}>
              {busy ? <Spinner /> : null}
              Add note
            </button>
          </>
        ) : null}

        {tab === 'coordinate' ? (
          <div className="space-y-5">
            <div>
              <label className="label">Next action required</label>
              <input className="input" value={f.nextText} onChange={set('nextText')} maxLength={200} placeholder="What must happen next?" />
              <input type="date" className="input mt-2" value={f.nextDue} onChange={set('nextDue')} aria-label="Due date" />
              <button
                className="btn btn-secondary mt-2 w-full"
                disabled={busy || f.nextText.trim().length < 5}
                onClick={() => act({ action: 'next_action', text: f.nextText, due: f.nextDue || undefined }, 'Next action saved.')}
              >
                Save next action
              </button>
            </div>

            <div>
              <label className="label">Link a related case (same institution)</label>
              <div className="flex gap-2">
                <input className="input font-mono" placeholder="NS-2026-000123" value={f.linkId} onChange={set('linkId')} maxLength={20} />
                <button className="btn btn-secondary" disabled={busy || f.linkId.trim().length < 6} onClick={() => act({ action: 'link', complaintId: f.linkId }, 'Cases linked.', ['linkId'])}>
                  Link
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">Use this to map cases handled by different bureaus so everyone sees the same picture.</p>
            </div>

            <div>
              <label className="label">Add a supporting document (link)</label>
              <input className="input" placeholder="Document name" value={f.docName} onChange={set('docName')} maxLength={120} />
              <input className="input mt-2" placeholder="https://..." value={f.docUrl} onChange={set('docUrl')} maxLength={500} />
              <button className="btn btn-secondary mt-2 w-full" disabled={busy || f.docName.trim().length < 2 || !f.docUrl} onClick={() => act({ action: 'document', name: f.docName, url: f.docUrl }, 'Document added.', ['docName', 'docUrl'])}>
                Add document
              </button>
            </div>
          </div>
        ) : null}

        {tab === 'manage' && isManager ? (
          <div className="space-y-5">
            <div>
              <label className="label">Assign to</label>
              <div className="flex gap-2">
                <select className="input" value={f.assignee} onChange={set('assignee')}>
                  <option value="">Select staff member</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role]})</option>
                  ))}
                </select>
                <button className="btn btn-secondary" disabled={busy || !f.assignee} onClick={() => act({ action: 'assign', userId: f.assignee }, 'Complaint assigned.', ['assignee'])}>
                  Assign
                </button>
              </div>
            </div>

            <div>
              <label className="label">Change priority</label>
              <select className="input" value={f.priority} onChange={set('priority')}>
                <option value="">Select priority</option>
                {PRIORITIES.filter((p) => p !== complaint.priority).map((p) => <option key={p}>{p}</option>)}
              </select>
              <input className="input mt-2" placeholder="Reason (required)" value={f.priorityReason} onChange={set('priorityReason')} maxLength={300} />
              <button className="btn btn-secondary mt-2 w-full" disabled={busy || !f.priority || f.priorityReason.trim().length < 5} onClick={() => act({ action: 'priority', priority: f.priority, note: f.priorityReason }, 'Priority updated and SLA clock restarted.', ['priority', 'priorityReason'])}>
                Update priority
              </button>
            </div>

            <div>
              <label className="label">Transfer to another bureau / cell</label>
              <select className="input" value={f.bureau} onChange={set('bureau')}>
                <option value="">Select bureau</option>
                {BUREAUS.filter((b) => b !== complaint.bureau).map((b) => <option key={b}>{b}</option>)}
              </select>
              <input className="input mt-2" placeholder="Reason (optional)" value={f.bureauReason} onChange={set('bureauReason')} maxLength={300} />
              <button className="btn btn-secondary mt-2 w-full" disabled={busy || !f.bureau} onClick={() => confirm(`Transfer this complaint to ${f.bureau}?`) && act({ action: 'reassign_bureau', bureau: f.bureau, note: f.bureauReason }, 'Complaint transferred.', ['bureau', 'bureauReason'])}>
                Transfer
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isOpen && complaint.escalationLevel < 2 && me.role !== 'regional' ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <button
            className="btn btn-danger w-full"
            disabled={busy}
            onClick={() =>
              confirm(`Escalate to ${ESCALATION_LEVELS[complaint.escalationLevel + 1]} now?`) &&
              act({ action: 'escalate', note: f.escalateReason }, `Escalated to ${ESCALATION_LEVELS[complaint.escalationLevel + 1]}.`)
            }
          >
            Escalate to {ESCALATION_LEVELS[complaint.escalationLevel + 1]}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

export default function ComplaintDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([api(`/api/complaints/${id}`), api('/api/auth/me')]);
      setData(d);
      setMe(m.user);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <ErrorBox>{error}</ErrorBox>
        <Link href="/complaints" className="btn btn-secondary mt-4">Back to complaints</Link>
      </div>
    );
  if (!data || !me)
    return (
      <div className="space-y-4">
        <div className="skeleton h-28" />
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="skeleton h-96 xl:col-span-2" />
          <div className="skeleton h-96" />
        </div>
      </div>
    );

  const { complaint: c, related, duplicates, duplicateOfDoc, institutionStats, readOnly, institution, overlap, linked } = data;
  const timeline = [...c.timeline].reverse();

  return (
    <>
      <div className="mb-4 text-sm">
        <Link href="/complaints" className="font-medium text-slate-500 hover:text-navy-700">&larr; All complaints</Link>
      </div>

      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-slate-400">{c.complaintId}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{c.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {c.institutionId ? (
                <Link href={`/institutions/${c.institutionId}`} className="font-medium text-navy-700 hover:underline">{c.institution}</Link>
              ) : (
                c.institution
              )}{' '}
              &middot; {c.state} ({c.region} region)
              {c.institutionId ? <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">AICTE ID {c.institutionId}</span> : null}
            </p>
            {c.institutionAsEntered ? (
              <p className="mt-0.5 text-xs text-slate-400">Complainant wrote: &ldquo;{c.institutionAsEntered}&rdquo; (matched automatically)</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={c.priority} />
            <StatusBadge status={c.status} />
            <EscalationBadge level={c.escalationLevel} />
          </div>
        </div>
      </div>

      {readOnly ? (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900">
          <strong>Read-only view.</strong> This case is with <strong>{c.bureau}</strong>
          {c.assignedToName ? <> (officer: {c.assignedToName})</> : null}. You can see its status and movement so that your bureau can coordinate; complainant details and internal notes are hidden.
        </div>
      ) : null}

      {overlap ? <OverlapBanner overlap={overlap} current={c} /> : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <TrackingCard c={c} />

          <Card title="AI triage" subtitle={c.classifiedBy === 'llm' ? 'AI model + rule engine' : 'Rule engine (explainable)'}>
            <p className="text-sm leading-relaxed text-slate-700">{c.aiSummary}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="label">Category</p>
                <p className="text-sm font-semibold text-slate-800">{c.category}</p>
              </div>
              <div>
                <p className="label">Priority score</p>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${c.priorityScore >= 70 ? 'bg-red-500' : c.priorityScore >= 50 ? 'bg-orange-500' : c.priorityScore >= 28 ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${c.priorityScore}%` }} />
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{c.priorityScore}/100</span>
                </div>
              </div>
              <div>
                <p className="label">Confidence</p>
                <p className="text-sm font-semibold text-slate-800">{Math.round((c.aiConfidence || 0) * 100)}%</p>
              </div>
            </div>
            {c.aiTags?.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.aiTags.map((t) => (
                  <span key={t} className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-medium text-navy-700">{t}</span>
                ))}
              </div>
            ) : null}
          </Card>

          <Card title="Complaint details">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{c.description}</p>
          </Card>

          {linked.length ? (
            <Card title="Mapped (linked) cases" subtitle="Related cases linked by officers, possibly in other bureaus">
              <ul className="divide-y divide-slate-100 text-sm">
                {linked.map((l) => (
                  <li key={l.complaintId} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <Link className="font-mono font-semibold text-navy-800 hover:underline" href={`/complaints/${l.complaintId}`}>{l.complaintId}</Link>
                      <span className="ml-2 truncate text-slate-600">{l.title}</span>
                      <span className="ml-2"><BureauChip bureau={l.bureau} /></span>
                    </span>
                    <StatusBadge status={l.status} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {c.documents?.length ? (
            <Card title="Supporting documents">
              <ul className="divide-y divide-slate-100 text-sm">
                {c.documents.map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2">
                    <a href={d.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 truncate font-medium text-navy-800 hover:underline">{d.name}</a>
                    <span className="shrink-0 text-xs text-slate-400">{d.addedBy} &middot; {fmtDate(d.at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {duplicateOfDoc || duplicates.length ? (
            <Card title="Possible duplicates" subtitle="Similar text about the same institution">
              <ul className="divide-y divide-slate-100 text-sm">
                {duplicateOfDoc ? (
                  <li className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="mr-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">Similar to earlier</span>
                      <Link className="font-mono font-semibold text-navy-800 hover:underline" href={`/complaints/${duplicateOfDoc.complaintId}`}>{duplicateOfDoc.complaintId}</Link>
                      <span className="ml-2 text-slate-500">{Math.round(c.duplicateScore * 100)}% match</span>
                    </span>
                    <StatusBadge status={duplicateOfDoc.status} />
                  </li>
                ) : null}
                {duplicates.map((d) => (
                  <li key={d.complaintId} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">Later duplicate</span>
                      <Link className="font-mono font-semibold text-navy-800 hover:underline" href={`/complaints/${d.complaintId}`}>{d.complaintId}</Link>
                    </span>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Audit trail" subtitle="Every action on this complaint, newest first">
            <ol className="space-y-5 border-l-2 border-slate-200 pl-5">
              {timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${DOT[t.action] || 'bg-slate-400'}`} />
                  <p className="text-sm text-slate-800">{t.message}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                    <span>{fmtDateTime(t.at)}</span>
                    <span>&middot; {t.by}{t.byRole && t.byRole !== 'system' && t.byRole !== 'citizen' ? ` (${ROLE_LABELS[t.byRole] || t.byRole})` : ''}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${t.visibility === 'public' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.visibility === 'public' ? 'Visible to complainant' : 'Internal'}
                    </span>
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="SLA clock">
            <div className="flex items-center justify-between">
              <SlaBadge sla={c.sla} />
              <span className="text-xs text-slate-500">Priority {c.priority}: {Math.round(c.slaHours / 24)}-day SLA</span>
            </div>
            <dl className="mt-3 divide-y divide-slate-100">
              <Row label="Current deadline">{fmtDateTime(c.slaDeadline)}</Row>
              <Row label="Original deadline">{fmtDateTime(c.originalDeadline)}</Row>
              {c.resolvedAt ? <Row label="Resolved on">{fmtDateTime(c.resolvedAt)}</Row> : null}
            </dl>
            <ol className="mt-4 flex items-center">
              {ESCALATION_LEVELS.map((l, i) => (
                <li key={l} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center text-center">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= c.escalationLevel ? (i === 0 ? 'bg-navy-700 text-white' : 'bg-red-500 text-white') : 'bg-slate-200 text-slate-500'}`}>{i + 1}</span>
                    <span className="mt-1 w-16 text-[10px] leading-tight text-slate-500">{l}</span>
                  </div>
                  {i < 2 ? <span className={`mx-1 mb-5 h-0.5 flex-1 ${i < c.escalationLevel ? 'bg-red-400' : 'bg-slate-200'}`} /> : null}
                </li>
              ))}
            </ol>
          </Card>

          {readOnly ? null : <ActionPanel complaint={c} me={me} id={id} onUpdated={setData} />}

          <Card title="Details">
            <dl className="divide-y divide-slate-100">
              <Row label="Bureau / cell">{c.bureau} ({shortBureau(c.bureau)})</Row>
              <Row label="Assigned to">{c.assignedToName || 'Unassigned'}</Row>
              <Row label="Source">{c.source}</Row>
              <Row label="Filed on">{fmtDate(c.createdAt)}</Row>
              <Row label="Complainant">{c.complainantName}</Row>
              {readOnly ? null : <Row label="Email"><span className="break-all">{c.complainantEmail}</span></Row>}
              {readOnly ? null : <Row label="Phone">{c.complainantPhone}</Row>}
            </dl>
          </Card>

          <Card title="Institution history" subtitle={c.institution}>
            {institution ? (
              <p className="mb-3 text-xs leading-relaxed text-slate-500">
                {institution.type} &middot; {institution.address || `${institution.city || ''} ${institution.state}`}
                {institution.verified === false ? <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">Unverified record</span> : null}
              </p>
            ) : null}
            <div className="mb-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-2xl font-bold tabular-nums text-slate-900">{institutionStats.total}</p>
                <p className="text-xs text-slate-500">total complaints</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-2xl font-bold tabular-nums text-slate-900">{institutionStats.open}</p>
                <p className="text-xs text-slate-500">currently open</p>
              </div>
            </div>
            {related.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {related.map((r) => (
                  <li key={r.complaintId} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/complaints/${r.complaintId}`} className="min-w-0 flex-1 truncate text-navy-800 hover:underline">{r.title}</Link>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No other complaints against this institution.</p>
            )}
            <Link href={c.institutionId ? `/institutions/${c.institutionId}` : `/complaints?q=${encodeURIComponent(c.institution)}`} className="mt-3 inline-block text-xs font-semibold text-navy-700 hover:underline">
              Open institution profile &rarr;
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
