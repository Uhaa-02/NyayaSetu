// Email sending through the Resend HTTP API (https://resend.com). No extra package is needed, and HTTPS
// works on hosts that block SMTP ports (such as Render's free plan).
//
// Email is OPTIONAL. Without RESEND_API_KEY every send is skipped and the app behaves exactly as before.
// A failed send never breaks the request that triggered it.
//
//   RESEND_API_KEY   API key from resend.com
//   MAIL_FROM        e.g. "NyayaSetu <onboarding@resend.dev>" (default). Use your own verified domain for real use.
//   MAIL_DEMO_TO     send EVERY email to this one address instead (use your own email for demos: the seeded
//                    staff addresses are fictional, and Resend's test sender can only deliver to your own account)
//   APP_URL          public URL used in email links (Render's RENDER_EXTERNAL_URL is picked up automatically)

const TIMEOUT_MS = 5000;

export function mailConfig() {
  return {
    enabled: Boolean(process.env.RESEND_API_KEY),
    from: process.env.MAIL_FROM || 'NyayaSetu <onboarding@resend.dev>',
    demoTo: (process.env.MAIL_DEMO_TO || '').trim(),
  };
}

export function appUrl() {
  const raw = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  return String(raw).replace(/\/+$/, '');
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Decides where an email really goes. Returns null when it should not be sent at all. */
export function resolveRecipient(email, cfg = mailConfig()) {
  if (cfg.demoTo) return EMAIL_RE.test(cfg.demoTo) ? cfg.demoTo : null;
  const e = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return null;
  if (e.endsWith('.demo') || e.endsWith('.example') || e.endsWith('@example.com')) return null; // fictional addresses
  return e;
}

/**
 * @param {{to:string|string[], subject:string, text:string, html?:string}} mail
 * @returns {Promise<{ok:boolean, skipped?:string, error?:string, id?:string, to?:string[]}>}  never throws
 */
export async function sendMail({ to, subject, text, html }) {
  const cfg = mailConfig();
  if (!cfg.enabled) return { ok: false, skipped: 'Email is not configured.' };

  const originals = [...new Set([].concat(to).filter(Boolean))];
  const recipients = [...new Set(originals.map((t) => resolveRecipient(t, cfg)).filter(Boolean))];
  if (!recipients.length) return { ok: false, skipped: 'No deliverable recipient.' };

  const subj = cfg.demoTo && originals.length ? `[demo: for ${originals.join(', ').slice(0, 80)}] ${subject}` : subject;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: recipients, subject: subj, text, html }),
      signal: ctl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.message || `Email provider returned ${res.status}.` };
    return { ok: true, id: data?.id, to: recipients };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'Email provider timed out.' : e.message };
  } finally {
    clearTimeout(timer);
  }
}
