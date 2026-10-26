export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0b1f4b" />
      <path
        d="M5 22h22M8 22c0-6.2 3.6-9.5 8-9.5s8 3.3 8 9.5M16 12.5V22M11.5 22v-4.5M20.5 22v-4.5"
        stroke="#f59e0b"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ light = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-tight">
        <span className={`block text-base font-bold tracking-tight ${light ? 'text-white' : 'text-navy-900'}`}>NyayaSetu</span>
        <span className={`block text-[10px] font-medium uppercase tracking-widest ${light ? 'text-navy-200' : 'text-slate-500'}`}>
          AICTE Complaint Intelligence
        </span>
      </span>
    </span>
  );
}
