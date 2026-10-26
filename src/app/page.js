import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';

const FEATURES = [
  {
    title: 'Cross-bureau overlap detection',
    text: 'When RB, PGRC or any other bureau are working on the same institution, officials see "Potential Overlapping Cases – Coordination Required" and can link the cases and agree a lead.',
  },
  {
    title: 'Institution profile & data matching',
    text: 'Every complaint is matched to one institution record by AICTE Permanent ID or name, however it was spelt, so the full history across all bureaus is in one place.',
  },
  {
    title: 'One intake, every source',
    text: 'Web form, e-mail and CSV bulk upload land in a single queue with a unique complaint ID for each case.',
  },
  {
    title: 'AI triage & priority scoring',
    text: 'Every complaint is categorised, summarised and scored 0-100. Harassment, fraud and safety cases surface first.',
  },
  {
    title: 'SLA timers & auto-escalation',
    text: 'Each priority has a deadline. Breaches climb the ladder from Case Officer to Bureau Head to Chairman Office automatically.',
  },
  {
    title: 'Duplicate & repeat-offender detection',
    text: 'Similar complaints are linked, and institutions with recurring issues are flagged for closer scrutiny.',
  },
  {
    title: 'Role-based dashboards',
    text: 'Case officers, bureau heads, regional offices and the Chairman Office each see the right slice, from one queue to every bureau, region and trend.',
  },
  {
    title: 'Alerts, reports & audit trail',
    text: 'Reminders for pending and approaching cases, bureau, region and institution reports, and a complete history of every action, transfer and escalation.',
  },
];

const STEPS = [
  ['1', 'Complaint filed', 'Citizen or officer submits details. The system validates and stores it.'],
  ['2', 'Smart triage & matching', 'Category, priority score and summary are generated, and the institution is matched to its register entry.'],
  ['3', 'Routed, assigned & checked', 'The right bureau and officer are chosen, and any other bureau already working on the institution is alerted.'],
  ['4', 'Tracked to closure', 'SLA clock runs, breaches escalate, and the outcome is recorded and shared.'],
];

export default function Home() {
  return (
    <>
      <div className="relative overflow-hidden bg-navy-900 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-navy-600/40 blur-3xl" />
        <PublicHeader dark />

        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-2 lg:pb-28 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-navy-100">
              <span className="h-1.5 w-1.5 rounded-full bg-saffron-400" />
              Smart India Hackathon 2026 &middot; SIH26264
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Every complaint tracked.
              <br />
              <span className="text-saffron-400">Every deadline enforced.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-navy-100">
              NyayaSetu is a single-window dashboard for AICTE bureaus and cells to monitor institution-related
              complaints, spot where RB, PGRC and other bureaus overlap, and coordinate before anyone acts twice.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/submit" className="btn btn-accent px-5 py-3">
                File a complaint
              </Link>
              <Link href="/track" className="btn border border-white/25 px-5 py-3 text-white hover:bg-white/10">
                Track my complaint
              </Link>
              <Link href="/login" className="btn px-5 py-3 text-navy-100 hover:text-white">
                Staff sign in &rarr;
              </Link>
            </div>
          </div>

          {/* illustrative sample card */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="rounded-2xl bg-white p-5 text-slate-800 shadow-2xl ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400">NS-2026-000142</p>
                  <h3 className="mt-0.5 font-semibold text-navy-900">Capitation fee demanded during admission</h3>
                  <p className="text-xs text-slate-500">Sample Institute of Technology &middot; Telangana</p>
                </div>
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">High</span>
              </div>
              <div className="mt-4 rounded-lg bg-navy-50 p-3 text-xs text-navy-800">
                <p className="font-semibold">AI triage</p>
                <p className="mt-1">
                  Admission Irregularities &middot; score 72/100 &middot; routed to Public Grievance Redressal Cell (PGRC)
                </p>
              </div>
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                <p className="font-semibold">Potential Overlapping Cases &ndash; Coordination Required</p>
                <p className="mt-1">Regulation Bureau (RB) already has an open approval case against this institution.</p>
              </div>
              <ol className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4 text-xs">
                {[
                  ['Complaint received, overlap with RB flagged', 'Day 0', 'bg-navy-600'],
                  ['RB and PGRC agree who leads', 'Day 1', 'bg-teal-500'],
                  ['SLA breached, escalated to Bureau Head', 'Day 5', 'bg-red-500'],
                  ['Resolved: refund ordered', 'Day 9', 'bg-emerald-500'],
                ].map(([t, d, c]) => (
                  <li key={t} className="relative">
                    <span className={`absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${c}`} />
                    <span className="font-medium text-slate-700">{t}</span>
                    <span className="ml-2 text-slate-400">{d}</span>
                  </li>
                ))}
              </ol>
            </div>
            <p className="mt-3 text-center text-[11px] text-navy-300">Illustrative example &mdash; not real data</p>
          </div>
        </section>
      </div>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
              Built for the people who resolve complaints and the people who file them
            </h2>
            <p className="mt-3 text-slate-600">
              Today, cases about the same institution can sit with different bureaus, with no real-time view of who is
              dealing with what. That risks duplicated effort, conflicting action and delay. NyayaSetu is the single
              source of truth that closes the gap.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-5">
                <div className="mb-3 h-1 w-10 rounded-full bg-saffron-500" />
                <h3 className="font-semibold text-navy-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">How a complaint moves</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(([n, t, d]) => (
                <div key={n}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-white">
                    {n}
                  </div>
                  <h3 className="mt-3 font-semibold text-navy-900">{t}</h3>
                  <p className="mt-1 text-sm text-slate-600">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-navy-900">Ready to see it work?</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-600">
            File a sample complaint and watch it get triaged, or sign in with a demo account to explore the dashboards.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/submit" className="btn btn-primary px-5 py-3">
              File a complaint
            </Link>
            <Link href="/login" className="btn btn-secondary px-5 py-3">
              Open the dashboard
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500 sm:px-6">
          NyayaSetu is a prototype built for Smart India Hackathon 2026 (problem statement SIH26264). It is not an
          official AICTE system, and all data shown in the demo is synthetic.
        </div>
      </footer>
    </>
  );
}
