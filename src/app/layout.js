import './globals.css';

export const metadata = {
  title: {
    default: 'NyayaSetu - Unified Complaint Intelligence for AICTE',
    template: '%s | NyayaSetu',
  },
  description:
    'NyayaSetu bridges every AICTE bureau and cell in one dashboard: AI triage, SLA timers, auto-escalation, duplicate detection and live analytics. Built for Smart India Hackathon 2026 (SIH26264).',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b1f4b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
