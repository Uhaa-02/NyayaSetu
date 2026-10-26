// Pure email builders (no database, no network): each returns { subject, text, html }.
import { appUrl } from './mailer.js';
import { OVERLAP_MESSAGE, shortBureau } from './constants.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const fmt = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST' : '-';

function layout({ heading, intro, rows = [], link, linkLabel, footer }) {
  const text = [heading, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), link ? `\n${linkLabel || 'Open'}: ${link}` : '', '', footer || 'NyayaSetu - AICTE complaint monitoring (prototype with sample data).']
    .filter((x) => x !== undefined)
    .join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
<div style="background:#0f2a4a;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-weight:bold">NyayaSetu</div>
<div style="border:1px solid #e2e8f0;border-top:0;padding:18px;border-radius:0 0 8px 8px">
<h2 style="margin:0 0 8px;font-size:18px">${esc(heading)}</h2>
<p style="margin:0 0 14px;font-size:14px;line-height:1.5">${esc(intro)}</p>
${rows.length ? `<table style="font-size:13px;border-collapse:collapse;width:100%">${rows.map(([k, v]) => `<tr><td style="padding:4px 10px 4px 0;color:#64748b;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join('')}</table>` : ''}
${link ? `<p style="margin:18px 0 4px"><a href="${esc(link)}" style="background:#0f2a4a;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none;font-size:14px">${esc(linkLabel || 'Open')}</a></p>` : ''}
<p style="margin:18px 0 0;font-size:11px;color:#94a3b8">${esc(footer || 'NyayaSetu - AICTE complaint monitoring (prototype with sample data).')}</p>
</div></div>`;
  return { text, html };
}

const caseLink = (id) => (appUrl() ? `${appUrl()}/complaints/${encodeURIComponent(id)}` : '');

const KIND_TEXT = {
  new: ['New case assigned to you', 'A new complaint has been routed to you.'],
  assigned: ['A case was assigned to you', 'A manager assigned this case to you.'],
  transferred: ['A case was transferred to your bureau', 'This case was transferred to your bureau and needs to be acknowledged.'],
  escalated: ['An escalated case needs your decision', 'This case passed its timeline and has been escalated to you.'],
};

export function tplAssigned(c, kind = 'new') {
  const [heading, intro] = KIND_TEXT[kind] || KIND_TEXT.new;
  const { text, html } = layout({
    heading,
    intro,
    rows: [
      ['Case', c.complaintId],
      ['Title', c.title],
      ['Institution', c.institution],
      ['Bureau', c.bureau],
      ['Priority', c.priority],
      ['Respond by', fmt(c.slaDeadline)],
      ['Next action', c.nextAction || '-'],
    ],
    link: caseLink(c.complaintId),
    linkLabel: 'Open the case',
  });
  return { subject: `[${c.priority}] ${heading}: ${c.complaintId}`, text, html };
}

export function tplOverlap(c, overlap) {
  const names = (overlap.bureaus || []).map(shortBureau).join(', ');
  const { text, html } = layout({
    heading: OVERLAP_MESSAGE,
    intro: `${c.institution} now has open cases with more than one bureau (${[shortBureau(c.bureau), names].filter(Boolean).join(', ')}). Please coordinate to avoid duplicate or conflicting action.`,
    rows: [
      ['Institution', `${c.institution}${c.institutionId ? ` (${c.institutionId})` : ''}`],
      ['New case', `${c.complaintId} (${shortBureau(c.bureau)})`],
      ['Other open cases', (overlap.caseIds || []).slice(0, 6).join(', ') || '-'],
    ],
    link: appUrl() ? `${appUrl()}/overlaps?i=${encodeURIComponent(c.institutionId || '')}` : '',
    linkLabel: 'Open the overlap monitor',
  });
  return { subject: `${OVERLAP_MESSAGE}: ${c.institution}`, text, html };
}

/** Receipt sent to the complainant. Only citizen-safe information. */
export function tplAcknowledgement(c) {
  const track = appUrl() ? `${appUrl()}/track` : '';
  const { text, html } = layout({
    heading: 'We have received your complaint',
    intro: `Thank you, ${c.complainantName}. Your complaint is registered and has been sent to the ${c.bureau}. Use the complaint ID and this email address to follow its progress.`,
    rows: [
      ['Complaint ID', c.complaintId],
      ['Institution', c.institution],
      ['Expected response by', fmt(c.slaDeadline)],
    ],
    link: track,
    linkLabel: 'Track your complaint',
  });
  return { subject: `Complaint received: ${c.complaintId}`, text, html };
}

export function tplOutcome(c) {
  const { text, html } = layout({
    heading: `Your complaint was ${c.status.toLowerCase()}`,
    intro: `The status of complaint ${c.complaintId} about ${c.institution} is now "${c.status}". You can read the outcome note on the tracking page.`,
    rows: [['Complaint ID', c.complaintId]],
    link: appUrl() ? `${appUrl()}/track` : '',
    linkLabel: 'View the outcome',
  });
  return { subject: `Complaint ${c.status.toLowerCase()}: ${c.complaintId}`, text, html };
}

const DIGEST_LABEL = { due_soon: 'Due within 48 hours', pending: 'New and not yet acknowledged', overdue: 'Past the timeline' };

/** items: [{ kind: 'due_soon'|'pending'|'overdue', complaintId, title, institution, due }] */
export function tplDigest(name, items) {
  const groups = ['overdue', 'due_soon', 'pending'].map((k) => [k, items.filter((i) => i.kind === k)]).filter(([, l]) => l.length);
  const lines = groups.flatMap(([k, l]) => [`${DIGEST_LABEL[k]} (${l.length})`, ...l.map((i) => `  ${i.complaintId} - ${i.title} - ${i.institution} - due ${fmt(i.due)}`), '']);
  const base = appUrl();
  const text = [`Hello ${name},`, '', `${items.length} case(s) need your attention:`, '', ...lines, base ? `Open the alert centre: ${base}/alerts` : '', '', 'NyayaSetu - AICTE complaint monitoring (prototype with sample data).'].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
<div style="background:#0f2a4a;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-weight:bold">NyayaSetu</div>
<div style="border:1px solid #e2e8f0;border-top:0;padding:18px;border-radius:0 0 8px 8px">
<h2 style="margin:0 0 8px;font-size:18px">${items.length} case(s) need your attention</h2>
<p style="margin:0 0 12px;font-size:14px">Hello ${esc(name)},</p>
${groups.map(([k, l]) => `<h3 style="margin:14px 0 4px;font-size:14px;color:${k === 'overdue' ? '#b91c1c' : '#334155'}">${esc(DIGEST_LABEL[k])} (${l.length})</h3><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">${l.map((i) => `<li><a href="${esc(caseLink(i.complaintId) || '#')}">${esc(i.complaintId)}</a> - ${esc(i.title)} <span style="color:#64748b">(${esc(i.institution)}, due ${esc(fmt(i.due))})</span></li>`).join('')}</ul>`).join('')}
${base ? `<p style="margin:18px 0 4px"><a href="${esc(base)}/alerts" style="background:#0f2a4a;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none;font-size:14px">Open the alert centre</a></p>` : ''}
<p style="margin:18px 0 0;font-size:11px;color:#94a3b8">NyayaSetu - AICTE complaint monitoring (prototype with sample data).</p>
</div></div>`;
  return { subject: `${items.length} case(s) need attention`, text, html };
}

export function tplTest(by) {
  const { text, html } = layout({
    heading: 'NyayaSetu test email',
    intro: `Email alerts are working. This test was requested by ${by}.`,
  });
  return { subject: 'NyayaSetu test email', text, html };
}

/** Progress update to the complainant when a case moves to In Review / Hearing Scheduled (or is reopened). Citizen-safe only. */
export function tplProgress(c) {
  const heading =
    c.status === 'Hearing Scheduled' ? 'A hearing has been scheduled for your complaint' : c.status === 'In Review' ? 'Your complaint is now being reviewed' : `Your complaint status is now "${c.status}"`;
  const { text, html } = layout({
    heading,
    intro: `There is an update on complaint ${c.complaintId} about ${c.institution}. You can see the full progress on the tracking page with your complaint ID and this email address.`,
    rows: [
      ['Complaint ID', c.complaintId],
      ['Status', c.status],
      ['Handled by', c.bureau],
      ['Response due by', fmt(c.slaDeadline)],
    ],
    link: appUrl() ? `${appUrl()}/track` : '',
    linkLabel: 'Track your complaint',
  });
  return { subject: `Update on your complaint ${c.complaintId}: ${c.status}`, text, html };
}

/** To the heads of the bureaus involved when coordination is recorded on an overlap. Staff-only content. */
export function tplCoordinated(group, rec, by) {
  const names = (group.bureauNames || []).map(shortBureau).join(', ');
  const { text, html } = layout({
    heading: `Coordination recorded: ${group.institution}`,
    intro: `${by} recorded how the bureaus will coordinate on the open cases for this institution. Please follow the agreed approach.`,
    rows: [
      ['Institution', `${group.institution}${group.institutionId ? ` (${group.institutionId})` : ''}`],
      ['Bureaus involved', names || '-'],
      ['Lead bureau', shortBureau(rec.leadBureau)],
      ['Decision', rec.note],
      ['Recorded by', by],
    ],
    link: appUrl() ? `${appUrl()}/overlaps?i=${encodeURIComponent(group.institutionId || '')}` : '',
    linkLabel: 'Open the overlap monitor',
  });
  return { subject: `Coordination recorded: ${group.institution}`, text, html };
}

/** Daily summary for the Chairman Office (sent by the scheduled SLA run only). */
export function tplChairmanSummary(name, s) {
  const base = appUrl();
  const top = (s.topOverlaps || []).map((o) => `${o.institution} (${(o.bureauNames || []).map(shortBureau).join(', ')})`);
  const { text, html } = layout({
    heading: 'Daily summary',
    intro: `Hello ${name}. Here is where things stand across all bureaus.`,
    rows: [
      ['Open cases', String(s.open)],
      ['Past their timeline', String(s.overdue)],
      ['Institutions needing coordination', String(s.overlapsRequired)],
      ...(top.length ? [['Most urgent overlaps', top.join('; ')]] : []),
    ],
    link: base ? `${base}/dashboard` : '',
    linkLabel: 'Open the dashboard',
  });
  return { subject: `Daily summary: ${s.overlapsRequired} overlap(s), ${s.overdue} overdue`, text, html };
}
