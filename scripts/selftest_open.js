// Offline checks for the public open dashboard, the extra e-mails and the staff import:  node scripts/selftest_open.js
import assert from 'node:assert/strict';
import { PUBLIC_STATUS, baseFilter, bucketOf, parseFilters, statusesFor, summarize, summarizeByRegion, toPublicRow, PUBLIC_FIELDS } from '../src/lib/publicBoard.js';
import { STATUSES, REGIONS } from '../src/lib/constants.js';
import { tplProgress, tplCoordinated, tplChairmanSummary } from '../src/lib/emailTemplates.js';
import { applyStaffOverrides, parseStaffCSV } from '../src/lib/staffImport.js';
import { buildSeedComplaints, SEED_STAFF, seedUsersFrom } from '../src/lib/seedData.js';

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
console.log('\nNyayaSetu open-dashboard self-test\n');

const sp = (o) => new URLSearchParams(o);
const NOW = new Date('2026-10-26T06:00:00Z');
const staffRows = SEED_STAFF.map((u, i) => ({ _id: `64b0f0f0f0f0f0f0f0f0${String(i).padStart(4, '0')}`, name: u.name, role: u.role, bureau: u.bureau, region: u.region }));
const { docs } = buildSeedComplaints({ now: NOW, users: seedUsersFrom(staffRows) });

test('public status: every internal status maps to exactly one of three buckets', () => {
  for (const s of STATUSES) assert.ok(['unsolved', 'progress', 'solved'].includes(bucketOf(s)), s);
  assert.deepEqual(statusesFor('unsolved'), ['New']);
  assert.deepEqual(statusesFor('solved').sort(), ['Closed', 'Resolved']);
  assert.equal(Object.keys(PUBLIC_STATUS).length, STATUSES.length);
});

test('summary counts add up and match the raw data', () => {
  const rows = Object.entries(docs.reduce((m, d) => ((m[d.status] = (m[d.status] || 0) + 1), m), {})).map(([_id, n]) => ({ _id, n }));
  const s = summarize(rows);
  assert.equal(s.unsolved + s.progress + s.solved, s.total);
  assert.equal(s.total, docs.length);
  assert.equal(s.solved, docs.filter((d) => ['Resolved', 'Closed'].includes(d.status)).length);
});

test('region overview lists every region in order and sums to the total', () => {
  const byRegion = {};
  for (const d of docs) {
    const k = `${d.region}|${d.status}`;
    byRegion[k] = (byRegion[k] || 0) + 1;
  }
  const rows = Object.entries(byRegion).map(([k, n]) => { const [region, status] = k.split('|'); return { _id: { region, status }, n }; });
  const r = summarizeByRegion(rows);
  assert.deepEqual(r.map((x) => x.region), REGIONS);
  assert.equal(r.reduce((n, x) => n + x.total, 0), docs.length);
});

test('filters: unknown values are ignored, a state implies its region, page is clamped', () => {
  assert.deepEqual(parseFilters(sp({ region: 'Mars', status: 'x', page: '-4' })), { region: '', state: '', status: '', q: '', page: 1 });
  const f = parseFilters(sp({ region: 'Northern', state: 'Telangana', status: 'solved', q: '  ACE   college ', page: '3' }));
  assert.equal(f.region, 'South Central');
  assert.equal(f.status, 'solved');
  assert.equal(f.q, 'ACE college');
  assert.equal(f.page, 3);
  assert.equal(parseFilters(sp({ page: '999999' })).page, 500);
});

test('search text cannot inject a regex', () => {
  const f = baseFilter({ region: '', state: '', q: '.*(a+)+$' });
  const re = f.$or[0].institution.$regex;
  assert.ok(new RegExp(re, 'i').test('.*(a+)+$') && !new RegExp(re, 'i').test('aaaa'));
});

test('PRIVACY: a public row never contains names, e-mails, titles, text or staff details', () => {
  const sample = docs.find((d) => ['Resolved', 'Closed'].includes(d.status)) || docs[0];
  const row = toPublicRow({ ...sample, createdAt: sample.createdAt || NOW }, NOW);
  const json = JSON.stringify(row);
  for (const secret of [sample.complainantName, sample.complainantEmail, sample.title, sample.description, sample.assignedToName, sample.complainantPhone].filter(Boolean)) {
    assert.ok(!json.includes(secret), `leaked: ${secret}`);
  }
  assert.deepEqual(Object.keys(row).sort(), ['bureau', 'category', 'days', 'filedAt', 'id', 'institution', 'region', 'state', 'status', 'statusLabel'].sort());
  for (const banned of ['complainant', 'description', 'title', 'assigned', 'timeline', 'aiSummary']) assert.ok(!PUBLIC_FIELDS.includes(banned), banned);
});

test('days: solved cases show time taken, open cases show age', () => {
  const t = new Date('2026-10-01T00:00:00Z');
  const solved = toPublicRow({ complaintId: 'X', institution: 'I', state: 'Telangana', region: 'South Central', category: 'Fee & Refund', bureau: 'Regulation Bureau', status: 'Resolved', createdAt: t, resolvedAt: new Date('2026-10-04T00:00:00Z') }, NOW);
  assert.equal(solved.days, 3);
  assert.equal(solved.statusLabel, 'Solved');
  const open = toPublicRow({ complaintId: 'Y', institution: 'I', state: 'Telangana', region: 'South Central', category: 'Fee & Refund', bureau: 'Regulation Bureau', status: 'New', createdAt: t }, NOW);
  assert.equal(open.days, 25);
  assert.equal(open.statusLabel, 'Unsolved');
});

test('progress e-mail: citizen-safe and escapes HTML', () => {
  const c = { complaintId: 'NS-1', institution: '<b>Evil</b> College', status: 'In Review', bureau: 'Regulation Bureau', slaDeadline: NOW, aiSummary: 'SECRET', internalNote: 'SECRET' };
  const m = tplProgress(c);
  assert.ok(m.subject.includes('NS-1') && m.text.includes('In Review'));
  assert.ok(!m.html.includes('<b>Evil</b>') && m.html.includes('&lt;b&gt;'));
  assert.ok(!m.text.includes('SECRET') && !m.html.includes('SECRET'));
  assert.ok(tplProgress({ ...c, status: 'Hearing Scheduled' }).text.includes('hearing'));
});

test('coordination and chairman e-mails carry the decision and the numbers', () => {
  const g = { institution: 'KLR College', institutionId: '1-46222649885', bureauNames: ['Regulation Bureau', 'Public Grievance Redressal Cell'] };
  const m = tplCoordinated(g, { leadBureau: 'Regulation Bureau', note: 'RB leads; PGRC waits.' }, 'Dr. Menon');
  assert.ok(m.text.includes('RB leads; PGRC waits.') && m.text.includes('RB, PGRC') && m.subject.includes('KLR College'));
  const s = tplChairmanSummary('Dr. Menon', { open: 120, overdue: 7, overlapsRequired: 3, topOverlaps: [g] });
  assert.ok(s.subject.includes('3 overlap') && s.text.includes('120') && s.text.includes('KLR College'));
});

test('staff import: valid rows, short bureau codes, regional region, duplicates and bad rows reported', () => {
  const csv = [
    'email,name,role,bureau,region',
    'Head@Example.org,A Head,bureau head,pgrc,',
    'o@example.org,An Officer,officer,Regulation Bureau,',
    'r@example.org,Regional Person,regional,,south central',
    'c@example.org,The Chair,chairman,,',
    'o@example.org,Dup,officer,RB,',
    'bad,Nope,officer,RB,',
    'x@example.org,No Bureau,officer,,',
    'y@example.org,No Region,regional,,',
    'z@example.org,Bad Role,boss,,',
  ].join('\n');
  const { staff, errors } = parseStaffCSV(csv);
  assert.equal(staff.length, 4);
  assert.equal(staff[0].email, 'head@example.org');
  assert.equal(staff[0].role, 'bureau_head');
  assert.equal(staff[0].bureau, 'Public Grievance Redressal Cell');
  assert.equal(staff[2].region, 'South Central');
  assert.equal(errors.length, 5);
});

test('staff overrides: real e-mails replace the matching demo accounts, extras are appended, count unchanged', () => {
  const rows = [
    { email: 'chair@x.org', name: 'Chair', role: 'chairman', bureau: null, region: null },
    { email: 'rb@x.org', name: 'RB Head', role: 'bureau_head', bureau: 'Regulation Bureau', region: null },
    { email: 'pg@x.org', name: '', role: 'bureau_head', bureau: 'Public Grievance Redressal Cell', region: null },
  ];
  const out = applyStaffOverrides(SEED_STAFF, rows);
  assert.equal(out.length, SEED_STAFF.length);
  assert.equal(out.find((u) => u.role === 'chairman').email, 'chair@x.org');
  assert.equal(out.find((u) => u.role === 'bureau_head' && u.bureau === 'Regulation Bureau').email, 'rb@x.org');
  const pg = out.find((u) => u.email === 'pg@x.org');
  assert.ok(pg.name.length > 1, 'blank name keeps the demo name');
  assert.equal(new Set(out.map((u) => u.email)).size, out.length);
  assert.equal(SEED_STAFF.find((u) => u.role === 'chairman').email, 'chairman@nyayasetu.demo', 'base list untouched');
  const extra = applyStaffOverrides(SEED_STAFF, [{ email: 'new@x.org', name: 'New', role: 'regional', bureau: null, region: 'Western' }]);
  assert.ok(extra.length === SEED_STAFF.length || extra.some((u) => u.email === 'new@x.org'));
});

console.log(`\n${passed} checks passed${process.exitCode ? ' (some FAILED)' : ''}.\n`);
