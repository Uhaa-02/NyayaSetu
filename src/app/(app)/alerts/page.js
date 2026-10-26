'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, fmtDate } from '@/lib/client';
import { Card, EmptyState, ErrorBox, PageHeader, SuccessBox, Tabs } from '@/components/ui';

const TYPE_LABEL = {
  overlap: 'Overlapping cases',
  sla_breach: 'Timeline breached',
  due_soon: 'Approaching timeline',
  pending_reminder: 'Pending reminders',
  escalation: 'Escalations',
  next_action: 'Next action due',
  duplicate: 'Possible duplicates',
};

const SEV = {
  critical: 'border-l-red-500 bg-red-50/40',
  warning: 'border-l-amber-500 bg-amber-50/40',
  info: 'border-l-sky-400 bg-white',
};
const SEV_TEXT = { critical: 'text-red-700', warning: 'text-amber-700', info: 'text-sky-700' };

export default function AlertsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [mail, setMail] = useState(null); // { enabled, demoRecipient }
  const [me, setMe] = useState(null);
  const [mailMsg, setMailMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api('/api/alerts').then(setData).catch((e) => setError(e.message));
    api('/api/mail').then(setMail).catch(() => {});
    api('/api/auth/me').then((m) => setMe(m.user)).catch(() => {});
  }, []);

  async function sendTest() {
    setSending(true);
    setMailMsg('');
    setError('');
    try {
      const r = await api('/api/mail', { method: 'POST' });
      setMailMsg(`Test email sent to ${r.to.join(', ')}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  const items = (data?.items || []).filter((i) => tab === 'all' || i.type === tab);

  return (
    <>
      <PageHeader
        title="Alerts and reminders"
        subtitle="Overlapping cases, cases beyond or approaching their timeline, pending-case reminders, escalations and next actions that are due. Alerts clear themselves as soon as the case is dealt with."
      />
      <ErrorBox>{error}</ErrorBox>
      <SuccessBox>{mailMsg}</SuccessBox>

      {mail ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 print:hidden">
          <span className={`inline-block h-2 w-2 rounded-full ${mail.enabled ? 'bg-green-500' : 'bg-slate-300'}`} />
          <span>
            {mail.enabled
              ? 'Email alerts are on: new cases, overlaps, assignments, escalations and daily reminders are also sent by email.'
              : 'Email alerts are off (alerts show in the app only). Set RESEND_API_KEY on the server to turn them on.'}
          </span>
          {mail.enabled && me?.role === 'chairman' ? (
            <button onClick={sendTest} disabled={sending} className="ml-auto rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {sending ? 'Sending...' : 'Send test email'}
            </button>
          ) : null}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="mb-4 overflow-x-auto">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                ['all', `All (${data.counts.total})`],
                ...Object.keys(TYPE_LABEL).filter((k) => data.counts[k]).map((k) => [k, `${TYPE_LABEL[k]} (${data.counts[k]})`]),
              ]}
            />
          </div>

          <Card>
            {items.length === 0 ? (
              <EmptyState title="Nothing needs attention" hint="You are all caught up." />
            ) : (
              <ul className="space-y-2">
                {items.map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className={`block rounded-lg border border-slate-200 border-l-4 px-4 py-3 transition hover:shadow-sm ${SEV[a.severity]}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={`text-sm font-semibold ${SEV_TEXT[a.severity]}`}>{a.title}</p>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{TYPE_LABEL[a.type]}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-700">{a.detail}</p>
                      {a.at ? <p className="mt-0.5 text-xs text-slate-400">{fmtDate(a.at)}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {data.truncated ? <p className="mt-3 text-center text-xs text-slate-400">Showing the most important 400 alerts.</p> : null}
          </Card>
        </>
      ) : !error ? (
        <div className="skeleton h-64" />
      ) : null}
    </>
  );
}
