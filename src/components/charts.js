'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = {
  navy: '#1b428f',
  blue: '#3b82f6',
  indigo: '#6366f1',
  purple: '#a855f7',
  green: '#10b981',
  slate: '#94a3b8',
  saffron: '#f59e0b',
  red: '#ef4444',
};

const STATUS_COLORS = {
  New: COLORS.blue,
  'In Review': COLORS.indigo,
  'Hearing Scheduled': COLORS.purple,
  Resolved: COLORS.green,
  Closed: COLORS.slate,
};

const PRIORITY_COLORS = { Critical: '#dc2626', High: '#f97316', Medium: '#f59e0b', Low: '#94a3b8' };

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
  fontSize: 12,
};

export function TrendChart({ data }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.navy} stopOpacity={0.35} />
              <stop offset="95%" stopColor={COLORS.navy} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.35} />
              <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="received" name="Received" stroke={COLORS.navy} strokeWidth={2} fill="url(#gRec)" />
          <Area type="monotone" dataKey="resolved" name="Resolved" stroke={COLORS.green} strokeWidth={2} fill="url(#gRes)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonut({ data, total }) {
  const items = data.filter((d) => d.value > 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
              {items.map((d) => (
                <Cell key={d.name} fill={STATUS_COLORS[d.name] || COLORS.slate} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-900">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">complaints</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[d.name] || COLORS.slate }} />
              {d.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CategoryBars({ data }) {
  const height = Math.max(160, data.length * 34 + 16);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={170}
            tick={{ fontSize: 11, fill: '#475569' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="value" name="Complaints" fill={COLORS.navy} radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 11, fill: '#475569' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const AGING_COLORS = ['#10b981', '#84cc16', '#f59e0b', '#f97316', '#dc2626'];

export function AgingBars({ data }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="value" name="Open complaints" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11, fill: '#475569' }}>
            {data.map((_, i) => (
              <Cell key={i} fill={AGING_COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriorityBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.name}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-slate-600">{d.name}</span>
            <span className="font-semibold tabular-nums text-slate-900">{d.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, background: PRIORITY_COLORS[d.name] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const SHORT = {
  'Fee & Refund': 'Fee',
  'Affiliation & Approval': 'Affiliation',
  'Faculty & Staffing': 'Faculty',
  'Infrastructure & Facilities': 'Infra',
  'Admission Irregularities': 'Admission',
  'Academic Quality': 'Academic',
  'Financial Irregularity': 'Financial',
  'Harassment & Safety': 'Safety',
  Other: 'Other',
};

export function Heatmap({ data }) {
  const { regions, categories, cells, max } = data;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-28 text-left font-medium text-slate-500" />
            {categories.map((c) => (
              <th key={c} className="px-1 pb-1 text-center font-medium text-slate-500">
                {SHORT[c] || c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {regions.map((region, ri) => (
            <tr key={region}>
              <th className="whitespace-nowrap pr-2 text-left font-medium text-slate-600">{region}</th>
              {cells[ri].map((v, ci) => {
                const alpha = v === 0 ? 0 : 0.12 + 0.88 * (v / max);
                return (
                  <td
                    key={ci}
                    title={`${region} - ${categories[ci]}: ${v}`}
                    className="h-9 min-w-[44px] rounded-md text-center font-semibold tabular-nums"
                    style={{
                      background: v === 0 ? '#f8fafc' : `rgba(27,66,143,${alpha.toFixed(2)})`,
                      color: alpha > 0.5 ? '#ffffff' : '#334155',
                    }}
                  >
                    {v || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
