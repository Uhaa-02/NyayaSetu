// Offline self-test (no database needed):  npm test
// Verifies the classifier, SLA maths, CSV parser, analytics and the demo-data generator.

import assert from 'node:assert/strict';
import { classifyRules, similarity, tokenize } from '../src/lib/classify.js';
import { computeDeadline, slaState } from '../src/lib/sla.js';
import { parseCSV } from '../src/lib/csv.js';
import { computeAnalytics } from '../src/lib/analytics.js';
import { buildSeedComplaints, SEED_INSTITUTIONS, SEED_STAFF, SEED_TEMPLATES, seedUsersFrom } from '../src/lib/seedData.js';
import { validateComplaintInput } from '../src/lib/validation.js';
import { matchInstitution, prepareRegistry } from '../src/lib/institutions.js';
import { detectOverlaps, groupsVisibleTo } from '../src/lib/overlap.js';
import { buildAlerts } from '../src/lib/alerts.js';
import { buildReport, REPORT_TYPES } from '../src/lib/reports.js';
import { parseInstitutionCSV } from '../src/lib/institutionImport.js';
import { sendMail, resolveRecipient } from '../src/lib/mailer.js';
import { tplAcknowledgement, tplAssigned, tplDigest, tplOverlap, tplOutcome } from '../src/lib/emailTemplates.js';
import { toCSV } from '../src/lib/csv.js';
import { defaultNextAction } from '../src/lib/actions.js';
import { BUREAUS, CATEGORY_TO_BUREAU, OVERLAP_MESSAGE } from '../src/lib/constants.js';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log('  ok  ', name);
  } catch (e) {
    console.error('  FAIL', name, '\n      ', e.message);
    process.exitCode = 1;
  }
};

console.log('\nNyayaSetu self-test\n');

// ---------------------------------------------------------------- classifier
test('classifies harassment as Critical', () => {
  const r = classifyRules({
    title: 'Ragging of first year students in hostel',
    description: 'Students are being ragged by seniors every night and are scared to report.',
  });
  assert.equal(r.category, 'Harassment & Safety');
  assert.equal(r.priority, 'Critical');
});

test('classifies fee refund as Fee & Refund (low/medium)', () => {
  const r = classifyRules({
    title: 'Refund not processed',
    description: 'I withdrew before the cut-off date but my fee has not been refunded for 4 months.',
  });
  assert.equal(r.category, 'Fee & Refund');
  assert.ok(['Low', 'Medium'].includes(r.priority), r.priority);
});

test('forged grant documents => Financial Irregularity + Critical', () => {
  const r = classifyRules({
    title: 'Forged documents submitted for grant utilisation',
    description: 'The institute submitted forged bills and fake utilisation certificates to claim grant money. A proper audit is needed.',
  });
  assert.equal(r.category, 'Financial Irregularity');
  assert.equal(r.priority, 'Critical');
});

test('repeat institution raises the priority score', () => {
  const input = { title: 'Hostel without clean drinking water', description: 'The hostel has no safe drinking water for 120 students.' };
  const a = classifyRules(input, { repeatCount: 0 });
  const b = classifyRules(input, { repeatCount: 3 });
  assert.ok(b.priorityScore > a.priorityScore);
});

test('unknown text falls back to Other', () => {
  const r = classifyRules({ title: 'Hello there', description: 'Just wanted to say hello to the team today.' });
  assert.equal(r.category, 'Other');
});

// ---------------------------------------------------------------- duplicates
test('duplicate similarity: same text high, different text low', () => {
  const a = 'Fee collected above the approved fee structure. Students paid the excess amount and received no receipt.';
  const b = 'The fee collected is above the approved fee structure; students paid excess and got no receipt.';
  const c = 'Ragging of first year students in the hostel every night.';
  assert.ok(similarity(tokenize(a), tokenize(b)) >= 0.5);
  assert.ok(similarity(tokenize(a), tokenize(c)) < 0.2);
});

// ---------------------------------------------------------------- SLA
test('SLA deadlines and states', () => {
  const t0 = new Date('2026-10-01T00:00:00Z');
  assert.equal(computeDeadline('Critical', t0).toISOString(), '2026-10-04T00:00:00.000Z');
  const c = { status: 'In Review', priority: 'High', slaDeadline: new Date('2026-10-08T00:00:00Z') };
  assert.equal(slaState(c, new Date('2026-10-02T00:00:00Z')).state, 'on_track');
  assert.equal(slaState(c, new Date('2026-10-07T20:00:00Z')).state, 'due_soon');
  assert.equal(slaState(c, new Date('2026-10-09T00:00:00Z')).state, 'overdue');
  assert.equal(slaState({ ...c, status: 'Resolved' }, new Date('2026-10-09T00:00:00Z')).state, 'done');
});

// ---------------------------------------------------------------- CSV
test('CSV parser handles quotes, commas and newlines', () => {
  const { headers, records } = parseCSV('a,b,c\r\n1,"hello, world","line1\nline2"\n2,"say ""hi""",x\n');
  assert.deepEqual(headers, ['a', 'b', 'c']);
  assert.equal(records.length, 2);
  assert.equal(records[0].b, 'hello, world');
  assert.equal(records[0].c, 'line1\nline2');
  assert.equal(records[1].b, 'say "hi"');
});

// ---------------------------------------------------------------- input validation
test('input validation accepts good and rejects bad input', () => {
  const good = validateComplaintInput({
    complainantName: 'Asha Rao', complainantEmail: 'asha@example.com', institution: 'Test Institute of Technology',
    state: 'telangana', title: 'Fee refund pending', description: 'My refund has been pending for many months now.',
  });
  assert.equal(good.ok, true);
  assert.equal(good.value.state, 'Telangana');
  const bad = validateComplaintInput({ complainantName: 'A', complainantEmail: 'nope', state: 'Mars', title: 'x', description: 'short' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.length >= 5);
});

test('every demo complaint template is classified into its intended category', () => {
  for (const [cat, list] of Object.entries(SEED_TEMPLATES)) {
    for (const [t, x] of list) {
      const fill = (s) => s.replaceAll('{inst}', 'Test Institute').replaceAll('{n}', '120').replaceAll('{m}', '4').replaceAll('{k}', '3');
      const r = classifyRules({ title: fill(t), description: fill(x) });
      assert.equal(r.category, cat, `"${fill(t)}" -> ${r.category}`);
    }
  }
});

// ---------------------------------------------------------------- seed data + analytics
const fakeId = (i) => `64b0f0f0f0f0f0f0f0f0${String(i).padStart(4, '0')}`;
const staff = SEED_STAFF.map((u, i) => ({ _id: fakeId(i), name: u.name, role: u.role, bureau: u.bureau, region: u.region }));
const NOW = new Date('2026-10-21T06:00:00Z');
const { docs, counters, institutions: seedInstitutions, overlapRecords } = buildSeedComplaints({ now: NOW, users: seedUsersFrom(staff) });

test('seed data: 260 complaints, unique IDs, counters consistent', () => {
  assert.equal(docs.length, 260);
  assert.equal(new Set(docs.map((d) => d.complaintId)).size, 260);
  assert.equal(Object.values(counters).reduce((a, b) => a + b, 0), 260);
});

test('seed data: every complaint is valid and internally consistent', () => {
  for (const d of docs) {
    assert.ok(d.assignedTo, `${d.complaintId} has an assignee`);
    assert.ok(d.createdAt <= NOW, `${d.complaintId} created in the past`);
    if (d.resolvedAt) assert.ok(d.resolvedAt >= d.createdAt && d.resolvedAt <= NOW, `${d.complaintId} resolvedAt sane`);
    const times = d.timeline.map((t) => t.at.getTime());
    assert.deepEqual(times, [...times].sort((a, b) => a - b), `${d.complaintId} timeline ordered`);
    assert.ok(times.every((t) => t <= NOW.getTime() + 1000), `${d.complaintId} timeline not in the future`);
    assert.ok(d.timeline.some((t) => t.visibility === 'public'));
  }
});

test('seed data: classifier agrees with the intended category for most templates', () => {
  // Re-classify every template by regenerating a big sample and measuring category/intended agreement.
  const big = buildSeedComplaints({ now: NOW, users: seedUsersFrom(staff), count: 1200, seed: 7 });
  // intendedCategory is not stored on docs; measure via titles instead (title -> category must be stable)
  const byTitleKey = new Map();
  for (const d of big.docs) {
    const key = d.title.replace(/\d+/g, '#');
    (byTitleKey.get(key) || byTitleKey.set(key, new Set()).get(key)).add(d.category);
  }
  const unstable = [...byTitleKey.entries()].filter(([, set]) => set.size > 1);
  assert.equal(unstable.length, 0, `titles mapped to multiple categories: ${JSON.stringify(unstable.map(([k, v]) => [k, [...v]]))}`);
});

test('seed data: demo has overdue level-0 cases for the live SLA demo', () => {
  const freshOverdue = docs.filter((d) => ['New', 'In Review', 'Hearing Scheduled'].includes(d.status) && d.escalationLevel === 0 && d.slaDeadline < NOW);
  assert.ok(freshOverdue.length >= 10, `only ${freshOverdue.length}`);
});

// ---------------------------------------------------------------- institution data matching
const REG = prepareRegistry(SEED_INSTITUTIONS);
const G = SEED_INSTITUTIONS[0];
const OPEN = ['New', 'In Review', 'Hearing Scheduled'];

test('institution matching: abbreviations, case, city suffix and typos resolve to the same record', () => {
  for (const v of [
    'Greenfield Inst. of Engg & Tech',
    'greenfield institute of engineering and technology, hyderabad',
    G.name.toUpperCase(),
    G.name.replace('Greenfield', 'Greenfeild'),
  ]) {
    const m = matchInstitution(v, REG, { state: G.state });
    assert.ok(m, `no match for "${v}"`);
    assert.equal(m.institution.permanentId, G.permanentId, v);
  }
});

test('institution matching: AICTE Permanent ID alone is enough', () => {
  const m = matchInstitution(`ref ${SEED_INSTITUTIONS[3].permanentId}`, REG);
  assert.equal(m.method, 'id');
  assert.equal(m.institution.name, SEED_INSTITUTIONS[3].name);
});

test('institution matching: unknown names are not force-merged', () => {
  assert.equal(matchInstitution('Random College of Arts', REG), null);
  assert.equal(matchInstitution('', REG), null);
});

test('institution registry: unique IDs/names, valid shape', () => {
  assert.equal(new Set(SEED_INSTITUTIONS.map((i) => i.permanentId)).size, SEED_INSTITUTIONS.length);
  assert.equal(new Set(SEED_INSTITUTIONS.map((i) => i.key)).size, SEED_INSTITUTIONS.length);
  assert.ok(SEED_INSTITUTIONS.every((i) => /^1-\d{7}$/.test(i.permanentId) && i.region && i.address));
  assert.equal(seedInstitutions.length, SEED_INSTITUTIONS.length);
});

test('seed data: every complaint maps to a registry institution; spelling variants resolve correctly', () => {
  const ids = new Set(SEED_INSTITUTIONS.map((i) => i.permanentId));
  assert.ok(docs.every((d) => ids.has(d.institutionId)));
  const variants = docs.filter((d) => d.institutionAsEntered && d.institutionAsEntered !== d.institution);
  assert.ok(variants.length >= 10, `only ${variants.length} variant spellings`);
  for (const d of variants) {
    const m = matchInstitution(d.institutionAsEntered, REG, { state: d.state });
    assert.equal(m?.institution.permanentId, d.institutionId, d.institutionAsEntered);
  }
});

// ---------------------------------------------------------------- bureaus
test('bureaus: RB and PGRC exist; categories and seed data use known bureaus only', () => {
  assert.ok(BUREAUS.includes('Regulation Bureau') && BUREAUS.includes('Public Grievance Redressal Cell'));
  assert.ok(Object.values(CATEGORY_TO_BUREAU).every((b) => BUREAUS.includes(b)));
  assert.ok(docs.every((d) => BUREAUS.includes(d.bureau)));
  assert.ok(SEED_STAFF.filter((u) => u.bureau).every((u) => BUREAUS.includes(u.bureau)));
});

// ---------------------------------------------------------------- overlap detection
const overlaps = detectOverlaps(docs, { records: overlapRecords, now: NOW });

test('overlap detection: several bureaus on one institution, RB + PGRC included', () => {
  assert.ok(overlaps.length >= 8, `only ${overlaps.length} overlaps`);
  assert.ok(overlaps.some((g) => g.hasRbPgrc), 'no RB + PGRC overlap');
  for (const g of overlaps) {
    assert.ok(g.bureauCount >= 2);
    assert.equal(new Set(g.bureaus.map((b) => b.bureau)).size, g.bureauCount);
    assert.equal(g.bureaus.reduce((n, b) => n + b.count, 0), g.caseCount);
  }
});

test('overlap detection: counts only open cases and groups by institution ID', () => {
  for (const g of overlaps) {
    const mine = docs.filter((d) => d.institutionId === g.institutionId && OPEN.includes(d.status));
    assert.equal(mine.length, g.caseCount);
    assert.ok(new Set(mine.map((d) => d.bureau)).size >= 2);
  }
  const spelled = docs.some((d) => d.institutionAsEntered && d.institutionAsEntered !== d.institution && OPEN.includes(d.status) && overlaps.some((g) => g.institutionId === d.institutionId));
  assert.ok(spelled, 'a differently-spelled case is inside an overlap');
});

test('overlap detection: closing a bureau\'s cases ends the overlap; a new bureau re-opens coordination', () => {
  const g = overlaps.find((x) => x.bureauCount === 2);
  assert.ok(g);
  const rows = docs.map((d) => ({ ...d }));
  const minority = g.bureaus[g.bureaus.length - 1].bureau;
  for (const r of rows) if (r.institutionId === g.institutionId && r.bureau === minority) r.status = 'Closed';
  assert.ok(!detectOverlaps(rows, { now: NOW }).some((x) => x.institutionId === g.institutionId));

  const rec = { institutionId: g.institutionId, bureausAtCoordination: g.bureauNames, leadBureau: g.bureauNames[0], note: 'x', coordinatedBy: 't', coordinatedAt: NOW };
  const withRec = (list) => detectOverlaps(list, { records: [rec], now: NOW }).find((x) => x.institutionId === g.institutionId);
  assert.equal(withRec(docs).status, 'Coordinated');
  const third = BUREAUS.find((b) => !g.bureauNames.includes(b));
  const extra = { ...docs.find((d) => d.institutionId === g.institutionId && OPEN.includes(d.status)), complaintId: 'NS-X', bureau: third };
  const after = withRec([...docs, extra]);
  assert.equal(after.status, 'Coordination Required');
  assert.equal(after.record.stale, true);
});

test('overlap visibility: chairman sees all, bureau staff their bureau, regional their region', () => {
  assert.equal(groupsVisibleTo(overlaps, { role: 'chairman' }).length, overlaps.length);
  const rb = groupsVisibleTo(overlaps, { role: 'officer', bureau: 'Regulation Bureau' });
  assert.ok(rb.length > 0 && rb.every((g) => g.bureauNames.includes('Regulation Bureau')));
  const south = groupsVisibleTo(overlaps, { role: 'regional', region: 'South Central' });
  assert.ok(south.every((g) => g.region === 'South Central'));
});

test('overlap seed: linked and coordinated examples exist; each region keeps an open overlap', () => {
  assert.ok(overlaps.some((g) => g.allLinked), 'no linked overlaps');
  assert.ok(overlaps.some((g) => g.status === 'Coordinated'), 'no coordinated overlaps');
  for (const r of new Set(overlaps.map((g) => g.region))) {
    assert.ok(overlaps.some((g) => g.region === r && g.status === 'Coordination Required'), r);
  }
});

// ---------------------------------------------------------------- case tracking fields
test('seed data: last/next action, transfers, links and documents are consistent', () => {
  assert.ok(docs.every((d) => d.lastAction && d.lastActionAt));
  assert.ok(docs.filter((d) => OPEN.includes(d.status)).every((d) => d.nextAction && d.nextActionDue));
  const transferred = docs.filter((d) => d.transferCount > 0);
  assert.ok(transferred.length >= 10, `only ${transferred.length} transferred`);
  for (const d of transferred) assert.equal(d.transfers.length, d.transferCount);
  const byId = new Map(docs.map((d) => [d.complaintId, d]));
  for (const d of docs) for (const l of d.linkedCases || []) {
    assert.ok(byId.has(l) && byId.get(l).institutionId === d.institutionId, 'links stay within one institution');
  }
  assert.ok(docs.some((d) => d.documents?.length));
  assert.equal(defaultNextAction('Closed').text, '');
});

// ---------------------------------------------------------------- alerts
test('alerts: the main types fire on demo data and counts add up', () => {
  const open = docs.filter((d) => OPEN.includes(d.status));
  const { items, counts } = buildAlerts({ rows: open, overlaps, session: { role: 'chairman' }, now: NOW });
  assert.ok(items.length > 0);
  for (const type of ['overlap', 'sla_breach', 'due_soon']) assert.ok(items.some((i) => i.type === type), `no ${type} alerts`);
  assert.equal(items.filter((i) => i.type === 'overlap').length, overlaps.filter((g) => g.status === 'Coordination Required').length);
  assert.ok(items.some((i) => i.title === OVERLAP_MESSAGE));
  assert.ok(counts && typeof counts === 'object');
});

// ---------------------------------------------------------------- reports
test('reports: every type builds with consistent columns/rows', () => {
  for (const { id } of REPORT_TYPES) {
    const r = buildReport(id, docs, { now: NOW, overlaps });
    assert.ok(r && r.title && r.columns.length && Array.isArray(r.rows), id);
    for (const row of r.rows) for (const c of r.columns) assert.ok(c.key in row, `${id}: row missing ${c.key}`);
  }
  assert.equal(buildReport('monthly', docs, { now: NOW }).rows.length > 0, true);
  assert.equal(buildReport('overlap', docs, { now: NOW, overlaps }).rows.length > 0, true);
});

test('institution CSV import: maps columns, normalises states, reports bad rows', () => {
  const csv = 'Permanent ID,Institution Name,State,District\n1-2000001,Alpha Institute of Technology,telangana,Hyderabad\n1-2000002,Beta College of Pharmacy,Orissa,Cuttack\n1-2000001,Dup,Telangana,X\n1-bad id,Gamma,Mars,Y\n';
  const r = parseInstitutionCSV(csv);
  assert.equal(r.institutions.length, 2);
  assert.equal(r.errors.length, 2);
  assert.equal(r.institutions[0].state, 'Telangana');
  assert.equal(r.institutions[0].region, 'South Central');
  assert.equal(r.institutions[1].state, 'Odisha');
  assert.equal(r.institutions[1].type, 'Pharmacy');
  assert.equal(parseInstitutionCSV('a,b\n1,2\n').institutions.length, 0);
});

test('seed with imported institutions: matching, overlaps and variants still work', () => {
  const states = ['Telangana', 'Karnataka', 'Maharashtra', 'Delhi', 'Tamil Nadu', 'Goa', 'Uttarakhand', 'Bihar'];
  let csv = 'permanent_id,name,state,city\n';
  for (let i = 0; i < 50; i++) csv += `1-${2000000 + i * 13711},Test${i} Institute of Engineering & Technology,${states[i % 8]},City${i}\n`;
  const { institutions } = parseInstitutionCSV(csv);
  assert.equal(institutions.length, 50);
  const b = buildSeedComplaints({ now: NOW, users: seedUsersFrom(staff), institutions });
  assert.equal(b.docs.length, 260);
  assert.equal(b.institutions.length, 50);
  assert.ok(b.docs.every((d) => institutions.some((x) => x.permanentId === d.institutionId)));
  assert.ok(detectOverlaps(b.docs, { records: b.overlapRecords, now: NOW }).length >= 5);
});

test('csv export: BOM, quoting and formula-injection guard', () => {
  const csv = toCSV([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [{ a: '=SUM(1,1)', b: 'x, "y"' }, { a: 5, b: 'ok' }]);
  assert.ok(csv.startsWith('﻿A,B'));
  assert.ok(csv.includes("'=SUM(1,1)"));
  assert.ok(csv.includes('"x, ""y"""'));
});

test('analytics: pending + under process + disposed = total; transferred matches', () => {
  const k = computeAnalytics(docs, NOW).kpis;
  assert.equal(k.pending + k.underProcess + k.disposed, k.total);
  assert.equal(k.transferred, docs.filter((d) => d.transferCount > 0).length);
});

test('validation: optional AICTE ID and document link', () => {
  const base = { complainantName: 'Asha Rao', complainantEmail: 'asha@example.com', institution: 'Test Institute', state: 'Telangana', title: 'Fee refund pending', description: 'My refund has been pending for many months now.' };
  assert.equal(validateComplaintInput({ ...base, institutionId: '1-1234567', documentUrl: 'https://example.com/a.pdf' }).ok, true);
  assert.equal(validateComplaintInput({ ...base, institutionId: 'bad id!' }).ok, false);
  assert.equal(validateComplaintInput({ ...base, documentUrl: 'javascript:alert(1)' }).ok, false);
});

// ---------------------------------------------------------------- email
test('email templates: contain the key facts, escape HTML, and never leak internal data to the complainant', () => {
  const c = { complaintId: 'NS-2026-000001', title: '<b>Fee</b> refund', institution: 'Test & Co Institute', institutionId: '1-2000000', bureau: 'Regulation Bureau', priority: 'High', slaDeadline: NOW, nextAction: 'Acknowledge', complainantName: 'Asha', status: 'Resolved', aiSummary: 'SECRET-AI', priorityScore: 77 };
  const a = tplAssigned(c, 'new');
  assert.ok(a.subject.includes('NS-2026-000001') && a.text.includes('Test & Co Institute'));
  assert.ok(a.html.includes('&lt;b&gt;Fee&lt;/b&gt;') && !a.html.includes('<b>Fee</b>'));
  for (const t of [tplAcknowledgement(c), tplOutcome(c)]) {
    assert.ok(!t.text.includes('SECRET-AI') && !t.html.includes('SECRET-AI') && !t.text.includes('77'));
  }
  assert.ok(tplOverlap(c, { bureaus: ['Public Grievance Redressal Cell'], caseIds: ['NS-2026-000002'] }).subject.includes('Coordination Required'));
  const d = tplDigest('Neha', [{ kind: 'overdue', complaintId: 'NS-1', title: 't', institution: 'i', due: NOW }, { kind: 'pending', complaintId: 'NS-2', title: 't', institution: 'i', due: NOW }]);
  assert.ok(d.subject.startsWith('2 case(s)') && d.text.includes('Past the timeline (1)') && d.text.includes('New and not yet acknowledged (1)'));
});

test('email recipients: fictional demo addresses are skipped, MAIL_DEMO_TO redirects everything', () => {
  assert.equal(resolveRecipient('officer@nyayasetu.demo', { demoTo: '' }), null);
  assert.equal(resolveRecipient('not-an-email', { demoTo: '' }), null);
  assert.equal(resolveRecipient('Real.Person@college.edu', { demoTo: '' }), 'real.person@college.edu');
  assert.equal(resolveRecipient('officer@nyayasetu.demo', { demoTo: 'me@gmail.com' }), 'me@gmail.com');
});

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ok  ', name);
  } catch (e) {
    console.error('  FAIL', name, '\n      ', e.message);
    process.exitCode = 1;
  }
}

await testAsync('email sending: skipped without a key; correct request with a key; failures never throw', async () => {
  const savedFetch = globalThis.fetch;
  const env = { ...process.env };
  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_DEMO_TO;
    assert.equal((await sendMail({ to: 'a@college.edu', subject: 's', text: 't' })).ok, false);

    process.env.RESEND_API_KEY = 're_test';
    let sent = null;
    globalThis.fetch = async (url, init) => {
      sent = { url, init, body: JSON.parse(init.body) };
      return { ok: true, json: async () => ({ id: 'abc' }) };
    };
    const r = await sendMail({ to: ['a@college.edu', 'a@college.edu', 'x@nyayasetu.demo'], subject: 'Hi', text: 'body' });
    assert.equal(r.ok, true);
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.equal(sent.init.headers.Authorization, 'Bearer re_test');
    assert.deepEqual(sent.body.to, ['a@college.edu']);

    process.env.MAIL_DEMO_TO = 'me@gmail.com';
    await sendMail({ to: 'x@nyayasetu.demo', subject: 'Hi', text: 'b' });
    assert.deepEqual(sent.body.to, ['me@gmail.com']);
    assert.ok(sent.body.subject.startsWith('[demo: for x@nyayasetu.demo]'));

    globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ message: 'domain not verified' }) });
    const bad = await sendMail({ to: 'a@college.edu', subject: 's', text: 't' });
    assert.equal(bad.ok, false);
    assert.ok(bad.error.includes('domain not verified'));
    globalThis.fetch = async () => {
      throw new Error('network down');
    };
    assert.equal((await sendMail({ to: 'a@college.edu', subject: 's', text: 't' })).ok, false);
  } finally {
    globalThis.fetch = savedFetch;
    process.env = env;
  }
});

const a = computeAnalytics(docs, NOW);
test('analytics: KPIs are coherent', () => {
  const k = a.kpis;
  assert.equal(k.total, 260);
  assert.equal(k.open + k.resolved, k.total);
  assert.ok(k.overdue >= 10 && k.overdue <= k.open);
  assert.ok(k.avgResolutionDays > 0);
  assert.ok(k.slaCompliance >= 50 && k.slaCompliance <= 100, `compliance ${k.slaCompliance}`);
  assert.equal(a.byStatus.reduce((s, x) => s + x.value, 0), 260);
  assert.equal(a.byCategory.reduce((s, x) => s + x.value, 0), 260);
  assert.equal(a.byBureau.reduce((s, x) => s + x.total, 0), 260);
  assert.equal(a.heatmap.cells.flat().reduce((x, y) => x + y, 0), 260);
  assert.equal(a.aging.reduce((s, x) => s + x.value, 0), k.open);
  assert.equal(a.trend.length, 6);
  assert.ok(a.topInstitutions[0].total >= a.topInstitutions[1].total);
});

test('seed data: some duplicates are detected and category mix looks sensible', () => {
  const dups = docs.filter((d) => d.duplicateOf).length;
  assert.ok(dups >= 5, `dups ${dups}`);
  assert.ok(a.byCategory.length >= 8);
});

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}.`);
console.log('\nSample analytics snapshot:');
console.log(JSON.stringify(a.kpis, null, 2));
console.log('Priority mix (open):', a.byPriority.map((p) => `${p.name}:${p.value}`).join('  '));
console.log('Categories:', a.byCategory.map((p) => `${p.name}:${p.value}`).join(' | '));
console.log('Duplicates flagged:', docs.filter((d) => d.duplicateOf).length);
console.log('');
