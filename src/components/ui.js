import Link from 'next/link';
import { ESCALATION_LEVELS, shortBureau } from '@/lib/constants';

const PRIORITY_STYLES = {
  Critical: 'bg-red-100 text-red-800 ring-red-200',
  High: 'bg-orange-100 text-orange-800 ring-orange-200',
  Medium: 'bg-amber-100 text-amber-800 ring-amber-200',
  Low: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const STATUS_STYLES = {
  New: 'bg-blue-100 text-blue-800 ring-blue-200',
  'In Review': 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  'Hearing Scheduled': 'bg-purple-100 text-purple-800 ring-purple-200',
  Resolved: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  Closed: 'bg-slate-200 text-slate-700 ring-slate-300',
};

const SLA_STYLES = {
  overdue: 'bg-red-100 text-red-800 ring-red-200',
  due_soon: 'bg-amber-100 text-amber-800 ring-amber-200',
  on_track: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  done: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const pill = 'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset';

export function PriorityBadge({ priority }) {
  return <span className={`${pill} ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.Low}`}>{priority}</span>;
}

export function StatusBadge({ status }) {
  return <span className={`${pill} ${STATUS_STYLES[status] || STATUS_STYLES.New}`}>{status}</span>;
}

export function SlaBadge({ sla }) {
  if (!sla) return null;
  return <span className={`${pill} ${SLA_STYLES[sla.state] || SLA_STYLES.on_track}`}>{sla.label}</span>;
}

export function EscalationBadge({ level }) {
  if (!level) return null;
  return (
    <span className={`${pill} bg-rose-50 text-rose-700 ring-rose-200`} title={`Escalated to ${ESCALATION_LEVELS[level]}`}>
      &uarr; {ESCALATION_LEVELS[level]}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const TONES = {
  navy: 'border-l-navy-600',
  red: 'border-l-red-500',
  amber: 'border-l-amber-500',
  green: 'border-l-emerald-500',
  slate: 'border-l-slate-400',
  purple: 'border-l-purple-500',
};

export function KpiCard({ label, value, sub, tone = 'navy', href }) {
  const body = (
    <div className={`card border-l-4 ${TONES[tone] || TONES.navy} p-4 transition ${href ? 'hover:shadow-md' : ''}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      {title ? (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Spinner({ className = '' }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {children}
    </div>
  );
}

export function SuccessBox({ children }) {
  if (!children) return null;
  return (
    <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

const SEVERITY_STYLES = {
  High: 'bg-red-100 text-red-800 ring-red-200',
  Medium: 'bg-amber-100 text-amber-800 ring-amber-200',
  Low: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function SeverityBadge({ severity }) {
  return <span className={`${pill} ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.Low}`}>{severity} severity</span>;
}

/** Small coloured chip with a bureau's short name (RB, PGRC, ...). */
export function BureauChip({ bureau, count, title }) {
  return (
    <span
      title={title || bureau}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-800 ring-1 ring-inset ring-navy-100"
    >
      {shortBureau(bureau)}
      {count !== undefined ? <span className="rounded bg-white px-1 text-[10px] tabular-nums text-slate-600">{count}</span> : null}
    </span>
  );
}

export function OverlapBadge({ status = 'Coordination Required' }) {
  const ok = status === 'Coordinated';
  return (
    <span className={`${pill} ${ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>
      {ok ? 'Coordinated' : 'Coordination required'}
    </span>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${value === id ? 'bg-white text-navy-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
