// Synthetic demo data. EVERYTHING here is fictional: institution names, people and complaint
// texts are invented for the prototype and do not refer to any real institution or person.
//
// buildSeedComplaints() is pure (no DB) - scripts/seed.js inserts the result, and
// scripts/selftest.js validates it. Complaints are pushed through the SAME classifier,
// SLA and duplicate logic the live app uses, so the demo data behaves like real data.

import {
  BUREAUS,
  CATEGORY_TO_BUREAU,
  ESCALATION_EXTENSION_HOURS,
  ESCALATION_LEVELS,
  PRIORITY_RANK,
  SLA_HOURS,
  STATE_REGION,
  shortBureau,
} from './constants.js';
import { classifyRules, DUPLICATE_THRESHOLD, similarity, tokenize } from './classify.js';
import { defaultNextAction } from './actions.js';
import { detectOverlaps } from './overlap.js';
import { matchInstitution, normaliseInstitution, prepareRegistry } from './institutions.js';

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;

// ------------------------------------------------------------------ staff
export const SEED_STAFF = [
  { name: 'Dr. Rajiv Menon', email: 'chairman@nyayasetu.demo', role: 'chairman', bureau: null },

  { name: 'Anita Deshmukh', email: 'head@nyayasetu.demo', role: 'bureau_head', bureau: 'Public Grievance Redressal Cell' },
  { name: 'Neha Kapoor', email: 'officer@nyayasetu.demo', role: 'officer', bureau: 'Public Grievance Redressal Cell' },
  { name: 'Arjun Verma', email: 'officer.grievance.2@nyayasetu.demo', role: 'officer', bureau: 'Public Grievance Redressal Cell' },

  { name: 'Suresh Iyer', email: 'head.approval@nyayasetu.demo', role: 'bureau_head', bureau: 'Approval Bureau' },
  { name: 'Pooja Bhatt', email: 'officer.approval.1@nyayasetu.demo', role: 'officer', bureau: 'Approval Bureau' },
  { name: 'Imran Shaikh', email: 'officer.approval.2@nyayasetu.demo', role: 'officer', bureau: 'Approval Bureau' },

  { name: 'Kavita Sharma', email: 'head.regulation@nyayasetu.demo', role: 'bureau_head', bureau: 'Regulation Bureau' },
  { name: 'Sandeep Joshi', email: 'officer.regulation.1@nyayasetu.demo', role: 'officer', bureau: 'Regulation Bureau' },
  { name: 'Lakshmi Narayan', email: 'officer.regulation.2@nyayasetu.demo', role: 'officer', bureau: 'Regulation Bureau' },

  { name: 'Mohan Reddy', email: 'head.fee@nyayasetu.demo', role: 'bureau_head', bureau: 'Fee Regulation Bureau' },
  { name: 'Vikram Singh', email: 'officer.fee.1@nyayasetu.demo', role: 'officer', bureau: 'Fee Regulation Bureau' },
  { name: 'Divya Menon', email: 'officer.fee.2@nyayasetu.demo', role: 'officer', bureau: 'Fee Regulation Bureau' },

  { name: 'Dr. Farah Siddiqui', email: 'head.academic@nyayasetu.demo', role: 'bureau_head', bureau: 'Academic Quality Bureau' },
  { name: 'Rohit Gupta', email: 'officer.academic.1@nyayasetu.demo', role: 'officer', bureau: 'Academic Quality Bureau' },
  { name: 'Shruti Patil', email: 'officer.academic.2@nyayasetu.demo', role: 'officer', bureau: 'Academic Quality Bureau' },

  { name: 'Rakesh Nair', email: 'head.vigilance@nyayasetu.demo', role: 'bureau_head', bureau: 'Vigilance Cell' },
  { name: 'Nikhil Bansal', email: 'officer.vigilance.1@nyayasetu.demo', role: 'officer', bureau: 'Vigilance Cell' },
  { name: 'Ayesha Khan', email: 'officer.vigilance.2@nyayasetu.demo', role: 'officer', bureau: 'Vigilance Cell' },

  // regional offices: see every bureau's cases for their own region
  { name: 'Sunita Rao', email: 'regional.south@nyayasetu.demo', role: 'regional', bureau: null, region: 'South Central' },
  { name: 'Pradeep Kulkarni', email: 'regional.west@nyayasetu.demo', role: 'regional', bureau: null, region: 'Western' },
  { name: 'Harpreet Kaur', email: 'regional.north@nyayasetu.demo', role: 'regional', bureau: null, region: 'Northern' },
];

// ------------------------------------------------------------------ institutions (fictional)
// weight => how often complaints mention this institution (heavier = "repeat offender").
const RAW_INSTITUTIONS = [
  ['Greenfield Institute of Engineering & Technology', 'Telangana', 'Hyderabad', 'Engineering', 2001, 10],
  ['Sunrise Technical Campus', 'Maharashtra', 'Pune', 'Engineering', 1998, 9],
  ['Meridian College of Engineering', 'Gujarat', 'Ahmedabad', 'Engineering', 2005, 8],
  ['Harbourview Institute of Engineering', 'Assam', 'Guwahati', 'Engineering', 2008, 7],
  ['Lakeview College of Engineering', 'Andhra Pradesh', 'Visakhapatnam', 'Engineering', 2003, 5],
  ['Riverbend Institute of Technology', 'Karnataka', 'Mysuru', 'Engineering', 1999, 5],
  ['Northridge Institute of Management', 'Delhi', 'New Delhi', 'Management', 2010, 4],
  ['Silverline College of Engineering', 'Tamil Nadu', 'Coimbatore', 'Engineering', 2002, 4],
  ['Eastgate Institute of Technology', 'West Bengal', 'Durgapur', 'Engineering', 1996, 4],
  ['Highland Polytechnic & Technical Institute', 'Uttar Pradesh', 'Lucknow', 'Polytechnic', 1994, 4],
  ['Pinecrest School of Pharmacy', 'Kerala', 'Kochi', 'Pharmacy', 2007, 3],
  ['Oakwood Institute of Management Studies', 'Rajasthan', 'Jaipur', 'Management', 2011, 3],
  ['Crescent Valley Institute of Technology', 'Madhya Pradesh', 'Indore', 'Engineering', 2004, 3],
  ['Brightstar College of Architecture', 'Bihar', 'Patna', 'Architecture', 2009, 3],
  ['Lotus Grove Institute of Technology', 'Odisha', 'Bhubaneswar', 'Engineering', 2006, 3],
  ['Summit Peak Institute of Technology', 'Punjab', 'Ludhiana', 'Engineering', 2000, 2],
  ['Willow Creek College of Engineering', 'Haryana', 'Gurugram', 'Engineering', 2012, 2],
  ['Blue Horizon Institute of Management', 'Chhattisgarh', 'Raipur', 'Management', 2013, 2],
  ['Redstone College of Technology', 'Jharkhand', 'Ranchi', 'Engineering', 2001, 2],
  ['Maple Heights Institute of Pharmacy', 'Telangana', 'Warangal', 'Pharmacy', 2008, 2],
  ['Evergreen Institute of Technology & Research', 'Karnataka', 'Bengaluru', 'Engineering', 2010, 2],
  ['Coastal Bay College of Engineering', 'Tamil Nadu', 'Chennai', 'Engineering', 2003, 2],
  // registered institutions that have no complaints yet (so the registry looks like a registry)
  ['Aspen Ridge Institute of Technology', 'Maharashtra', 'Nagpur', 'Engineering', 2014, 0],
  ['Cedar Point College of Pharmacy', 'Gujarat', 'Vadodara', 'Pharmacy', 2012, 0],
  ['Harmony Hills School of Architecture', 'Kerala', 'Thiruvananthapuram', 'Architecture', 2015, 0],
  ['Ironwood Polytechnic College', 'Uttar Pradesh', 'Kanpur', 'Polytechnic', 1992, 0],
];

const STREETS = ['Knowledge Park', 'University Road', 'Technology Avenue', 'Institutional Area', 'NH-44 Bypass', 'Education Hub Road'];

// Fictional AICTE-style Permanent IDs: "1-" followed by 7 digits, deterministic per institution.
const permanentIdFor = (i) => `1-${String(1000000 + (((i + 3) * 7919341) % 9000000)).padStart(7, '0')}`;

export const SEED_INSTITUTIONS = RAW_INSTITUTIONS.map(([name, state, city, type, establishedYear, weight], i) => ({
  permanentId: permanentIdFor(i),
  name,
  key: normaliseInstitution(name),
  state,
  region: STATE_REGION[state],
  city,
  type,
  establishedYear,
  address: `Plot ${10 + ((i * 7) % 80)}, ${STREETS[i % STREETS.length]}, ${city}, ${state}`,
  verified: true,
  weight,
}));

const FIRST = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Kabir', 'Isha', 'Vivaan', 'Meera', 'Aditya', 'Sana', 'Arnav', 'Tara', 'Karan', 'Riya', 'Dev', 'Nisha', 'Harsh', 'Pallavi', 'Yash', 'Kiran', 'Manav', 'Simran', 'Rahul', 'Bhavna', 'Tejas', 'Lavanya', 'Ishaan', 'Fatima', 'Gautam', 'Zoya'];
const LAST = ['Sharma', 'Reddy', 'Patel', 'Iyer', 'Khan', 'Gupta', 'Nair', 'Das', 'Mehta', 'Singh', 'Rao', 'Joshi', 'Banerjee', 'Pillai', 'Chauhan', 'Naidu', 'Kulkarni', 'Mishra', 'Thakur', 'Verma'];

// ------------------------------------------------------------------ complaint templates
// Placeholders: {inst} institution, {n} number of students, {m} months, {k} small number.
const TEMPLATES = {
  'Fee & Refund': [
    ['Original certificates withheld over additional fee demand',
      '{inst} has withheld my original certificates until I pay an additional amount that was never mentioned in the admission brochure. I have already paid the full tuition fee as per the approved fee structure and have receipts for every payment. The accounts office has not given any written explanation.'],
    ['Refund not processed after withdrawal of admission',
      'I withdrew from {inst} before the cut-off date but my fee has still not been refunded after {m} months. The refund policy requires payment within 15 days. My repeated emails to the accounts office have gone unanswered.'],
    ['Fee collected above the approved fee structure',
      'The institute has collected tuition fee higher than the structure approved by the state fee regulatory committee. About {n} students in my batch have paid the excess amount and received no proper receipt. Parents have complained to the management but nothing has changed.'],
    ['Caution deposit not returned for {m} months',
      'My caution deposit and mess advance at {inst} have not been returned even after clearing all dues and submitting the no-dues certificate. The office keeps asking me to visit again and again and no refund has been processed.'],
    ['Hidden charges added to the semester fee',
      '{inst} has added several hidden charges to the semester fee for development, examination and lab usage without any prior notice. The charged amount is nearly 30 percent more than the fee displayed at the time of joining. No receipt breakup is provided.'],
  ],
  'Affiliation & Approval': [
    ['Institute running intake beyond approved seats',
      '{inst} has admitted more students than the sanctioned intake for the current academic year. Around {n} students may be affected if the extra admissions are not recognised. The management says approval will be obtained later.'],
    ['Programme offered without AICTE approval',
      'The institute is advertising a new programme and collecting fees although it has no approval from AICTE for it. This is unapproved and illegal. Students are at risk of getting an invalid degree and wasting their years.'],
    ['Affiliation certificate not displayed, students misled',
      '{inst} claims affiliation to the state technical university but refuses to show the affiliation letter to parents. The brochure shows a recognition that we cannot verify anywhere. {n} students have already joined on this basis.'],
    ['Approval extension pending but fresh admissions continue',
      'The affiliation and approval for {inst} appears to have lapsed this year, but the institute continues fresh admissions and tells students everything is in order. Please verify the extension of approval status and inform students.'],
    ['Accreditation claim in advertisements is false',
      '{inst} advertises NBA accreditation for all branches on hoardings and its website, but students find the accreditation and recognition is valid for only one programme. The claim appears fake and is misleading parents.'],
  ],
  'Faculty & Staffing': [
    ['Shortage of qualified faculty in core departments',
      'Our department at {inst} has only {k} permanent faculty members for more than {n} students. Several subjects are taught by guest lecturers without a Ph.D or required experience, which is below the norms. The student-teacher ratio is far above the limit.'],
    ['Faculty salaries unpaid for {m} months',
      'Teaching staff at {inst} have not received their salaries for {m} months and many are leaving. Classes are being cancelled as a result. Staff members fear retaliation if they complain directly.'],
    ['Faculty listed on paper but not actually teaching',
      'During the last inspection the institute showed names of faculty members who do not actually work there. Our subjects have no regular teacher and the list submitted to AICTE appears fake. Students have complained to the principal without any response.'],
    ['Faculty overloaded and without appointment letters',
      'Faculty at {inst} are forced to handle an excessive workload with {n} students in a single section. Many are not given proper contracts or appointment letters. The quality of teaching has suffered and students are unable to clear doubts.'],
  ],
  'Infrastructure & Facilities': [
    ['Laboratories without working equipment',
      'Most laboratories at {inst} have broken or missing equipment, and students only watch demonstrations. The computer lab has about half the required systems and the internet rarely works. We have raised this with the lab in-charge many times.'],
    ['Hostel without clean drinking water',
      'The hostel at {inst} has no safe drinking water and the washrooms are not cleaned for days. About {n} students are living in these conditions and several have fallen ill. The management ignores our requests.'],
    ['Unsafe building with cracks in classrooms',
      'Large cracks have appeared in the walls and ceiling of the main academic building at {inst}. Classrooms on the upper floors feel unsafe during rains and there is a risk of collapse. Students are afraid to attend classes here.'],
    ['Library and Wi-Fi facilities not available',
      'The central library at {inst} has no recent books and stays closed most days. The Wi-Fi promised in the prospectus is not available anywhere on campus. The playground and canteen are also in poor condition.'],
  ],
  'Admission Irregularities': [
    ['Capitation fee demanded during admission',
      'At {inst}, the admission staff demanded a donation of several lakh rupees in cash for a seat, over and above the official fee. They said the seat would otherwise be given to someone else. I have a recording of the conversation and can share it.'],
    ['Management quota seats sold to the highest bidder',
      'Management quota seats in {inst} are reportedly being sold during counselling instead of being given on merit. Meritorious students with a higher entrance rank were denied admission. Around {n} candidates were affected last year.'],
    ['Admission given without valid entrance rank',
      'Several students were admitted at {inst} without a valid entrance exam rank or eligibility certificate. Their admissions were done in a spot round after the official cut-off. This will create trouble for everyone when approvals are verified.'],
    ['Misleading admission brochure during counselling',
      'During counselling, {inst} showed an admission brochure promising guaranteed seats and 100 percent placements. The real intake and merit list were different, and the promise was misleading.'],
  ],
  'Academic Quality': [
    ['Exams delayed and results not declared for {m} months',
      'The semester examinations at {inst} were delayed twice and the results have not been declared for {m} months. Students are unable to apply for higher studies or jobs. Requests for revaluation are also being ignored.'],
    ['Syllabus not completed and classes not conducted',
      'Classes in my branch at {inst} are held only a few days a week and the syllabus for most subjects is still incomplete with exams approaching. Attendance is being marked without classes. {n} students of my year face the same problem.'],
    ['Unfair internal marks and evaluation practices',
      'Internal evaluation at {inst} is done arbitrarily, and marks are reduced for students who raise questions. There is no transparency in the evaluation and no way to challenge the marks. Many students now have backlogs only because of this.'],
    ['Placement record is exaggerated',
      '{inst} showed a placement record in its presentation that does not match reality. Most students got no offers this year and the visiting companies were mostly for internships. The placement cell does not share any data.'],
  ],
  'Financial Irregularity': [
    ['Scholarship funds misused by the institute',
      'The scholarship amount for SC/ST students was received by {inst} but not passed on to the students for the past {m} months. The office says the funds are delayed, but several students have confirmed that the money was credited to the college account. This looks like misappropriation of funds.'],
    ['Forged documents submitted for grant utilisation',
      'I have reason to believe that {inst} submitted forged bills and fake utilisation certificates to claim government grant money. The expenditure shown on laboratory equipment does not exist on campus. A proper audit is needed.'],
    ['Bribe demanded for inspection clearance',
      'An agent of {inst} told us that a bribe was paid to the inspection team for clearance and that all students must now contribute money towards it. This is corruption and it affects the credibility of the whole approval process.'],
    ['Fraud in collection of examination fee',
      'Examination fee was collected from {n} students of {inst} in cash without any receipts and the funds were never deposited with the university. The money appears to have been misused and the accounts staff admit it was used for other purposes. This is fraud and needs a proper audit.'],
  ],
  'Harassment & Safety': [
    ['Ragging of first year students in hostel',
      'First year students at {inst} are being ragged by seniors in the hostel every night. Some students have been forced to do degrading tasks and are scared to report. The hostel warden has ignored all earlier verbal complaints.'],
    ['Harassment by department staff',
      'A faculty member in the department at {inst} has been harassing female students by passing inappropriate comments and threatening to fail those who complain. Many students are afraid to raise this openly. We request an urgent inquiry.'],
    ['Sexual harassment complaint not addressed by internal committee',
      'I filed a written complaint with the internal committee at {inst} against a staff member for sexual harassment but no action has been taken for {m} months. The committee has not even called me for a hearing. I fear for my safety on campus.'],
    ['Discrimination and bullying against students from other states',
      'Students from other states at {inst} face bullying and discrimination from a group of local students and some staff. Complaints to the warden were ignored. Several students want to leave the college.'],
  ],
  Other: [
    ['General grievance about lack of communication from the institute',
      'The institute does not respond to emails or phone calls from parents. Our requests for basic information about the course schedule and contact persons are still pending. Kindly help us get a proper reply from {inst}.'],
    ['Official website shows wrong contact details',
      'The official website of {inst} lists contact numbers and email addresses that do not work. Parents cannot reach any official for queries. Please ask the institute to update its details.'],
  ],
};

export const SEED_TEMPLATES = TEMPLATES;

const CATEGORY_WEIGHTS = {
  'Fee & Refund': 22,
  'Affiliation & Approval': 12,
  'Faculty & Staffing': 12,
  'Infrastructure & Facilities': 14,
  'Admission Irregularities': 12,
  'Academic Quality': 12,
  'Financial Irregularity': 6,
  'Harassment & Safety': 5,
  Other: 5,
};

const EXTRA_SENTENCES = [
  'I request AICTE to look into this at the earliest.',
  'Several other students are facing the same situation.',
  'We have photographs and documents to support this complaint.',
  'I have also written to the state authorities.',
  'Please treat my details as confidential.',
  'The principal has promised action but nothing has happened so far.',
];

const INTERNAL_NOTES = [
  'Called the institute and requested supporting documents within 7 days.',
  'Institute has been asked to submit its written reply.',
  'Documents received from the complainant and verified.',
  'Inquiry in progress. Waiting for the institute to respond.',
  'Reviewed with the bureau head; field verification may be needed.',
];

const OUTCOMES = {
  'Fee & Refund': 'Institute directed to refund the excess amount within 15 days. Compliance report received.',
  'Affiliation & Approval': 'Approval status verified. Institute issued a show-cause notice and corrected its public disclosures.',
  'Faculty & Staffing': 'Institute submitted a faculty compliance report. Pending salaries were cleared under supervision.',
  'Infrastructure & Facilities': 'Inspection completed. Institute has fixed the reported issues and shared photographic proof.',
  'Admission Irregularities': 'Admission records reviewed. Corrective action taken and the complainant was informed.',
  'Academic Quality': 'University coordinated with the institute. Results were declared and academic calendar revised.',
  'Financial Irregularity': 'Audit completed. Funds were released to the affected students and a warning was issued.',
  'Harassment & Safety': 'Inquiry committee report received. Disciplinary action initiated and safety measures put in place.',
  Other: 'Institute contacted and the issue was resolved to the complainant\'s satisfaction.',
};

// ------------------------------------------------------------------ helpers
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n, w = 6) => String(n).padStart(w, '0');

export function seedUsersFrom(createdUsers) {
  // createdUsers: array of { _id, name, role, bureau } (as stored)
  const out = { chairman: null, heads: {}, officers: {}, regional: {} };
  for (const u of createdUsers) {
    if (u.role === 'chairman') out.chairman = u;
    else if (u.role === 'regional') out.regional[u.region] = u;
    else if (u.role === 'bureau_head') out.heads[u.bureau] = u;
    else (out.officers[u.bureau] ||= []).push(u);
  }
  return out;
}

// Ways real complainants write the same institution name (abbreviations, "and" for "&", a city suffix...).
function nameVariant(name, city, pick) {
  const swaps = [
    [/Institute/g, 'Inst.'],
    [/Engineering/g, 'Engg'],
    [/Technology/g, 'Tech'],
    [/College/g, 'Coll.'],
    [/Management/g, 'Mgmt'],
    [/ & /g, ' and '],
  ];
  let v = name;
  const n = 1 + Math.floor(pick() * 3);
  for (let i = 0; i < n; i++) {
    const [re, to] = swaps[Math.floor(pick() * swaps.length)];
    v = v.replace(re, to);
  }
  if (pick() < 0.35) v = v.toLowerCase();
  if (pick() < 0.3) v = `${v}, ${city}`;
  return v === name ? name.toUpperCase().replace(/ & /g, ' AND ') : v;
}

/**
 * @param {{now?:Date, users:{chairman:any, heads:Record<string,any>, officers:Record<string,any[]>}, count?:number, seed?:number}} opts
 * @returns {{docs:object[], counters:Record<string,number>}}
 */
export function buildSeedComplaints({ now = new Date(), users, count = 260, seed = 20261021, institutions: instList = SEED_INSTITUTIONS }) {
  const rnd = mulberry32(seed);
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const weighted = (items, w) => {
    const total = items.reduce((s, it) => s + w(it), 0);
    let r = rnd() * total;
    for (const it of items) {
      r -= w(it);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  };

  const registry = prepareRegistry(instList);
  const SPECIAL = 12; // fresh SLA breaches so "Run SLA check" visibly escalates cases in the demo
  const priorByInst = new Map();
  const specs = [];

  for (let i = 0; i < count; i++) {
    const special = i < SPECIAL;
    const category = special
      ? ['Fee & Refund', 'Infrastructure & Facilities', 'Academic Quality', 'Faculty & Staffing', 'Affiliation & Approval', 'Admission Irregularities'][i % 6]
      : weighted(Object.keys(CATEGORY_WEIGHTS), (c) => CATEGORY_WEIGHTS[c]);
    const inst = weighted(instList, (x) => x.weight);
    const [titleT, textT] = pick(TEMPLATES[category]);
    const fill = (s) =>
      s
        .replaceAll('{inst}', inst.name)
        .replaceAll('{n}', String(int(40, 600)))
        .replaceAll('{m}', String(int(2, 9)))
        .replaceAll('{k}', String(int(2, 6)));
    const title = fill(titleT);
    let description = fill(textT);
    if (rnd() < 0.5) description += ' ' + pick(EXTRA_SENTENCES);

    const first = pick(FIRST);
    const last = pick(LAST);
    const prior = priorByInst.get(inst.name) || 0;
    priorByInst.set(inst.name, prior + 1);

    const ai = classifyRules({ title, description, institution: inst.name }, { repeatCount: Math.min(3, Math.floor(prior / 6)) });

    // some complainants spell the institution differently; data matching must still find the right record
    let variant = '';
    if (!special && rnd() < 0.14) {
      const v = nameVariant(inst.name, inst.city, rnd);
      const m = matchInstitution(v, registry, { state: inst.state });
      if (m && m.institution.permanentId === inst.permanentId) variant = v;
    }

    specs.push({
      special,
      variant,
      transferred: !special && rnd() < 0.09,
      intendedCategory: category,
      inst,
      first,
      last,
      title,
      description,
      ai,
      ageDays: special ? 0 : Math.pow(rnd(), 1.25) * 150 + 0.2,
    });
  }

  // finish specials' age now that their SLA is known (just past the deadline, still level 0)
  for (const s of specs) {
    if (s.special) s.ageDays = SLA_HOURS[s.ai.priority] / 24 + 0.3 + rnd() * 5;
  }

  // chronological order (oldest first) => IDs and duplicate detection behave like production
  specs.sort((a, b) => b.ageDays - a.ageDays);

  const docs = [];
  const counters = {};
  const seenByInst = new Map();
  const rrByBureau = {};

  for (const s of specs) {
    const { ai, inst } = s;
    const createdAt = new Date(now.getTime() - s.ageDays * DAY);
    const year = createdAt.getFullYear();
    counters[`complaint-${year}`] = (counters[`complaint-${year}`] || 0) + 1;
    const complaintId = `NS-${year}-${pad(counters[`complaint-${year}`])}`;

    const bureau = CATEGORY_TO_BUREAU[ai.category];
    // transferred cases were first received by another bureau/cell (usually PGRC) and moved to the right one
    let firstBureau = bureau;
    if (s.transferred) {
      const others = BUREAUS.filter((b) => b !== bureau);
      firstBureau = bureau !== 'Public Grievance Redressal Cell' && rnd() < 0.6 ? 'Public Grievance Redressal Cell' : pick(others);
    }
    const slaHours = SLA_HOURS[ai.priority];
    const slaDays = slaHours / 24;
    const originalDeadline = new Date(createdAt.getTime() + slaHours * HOUR);

    // ---- status
    let status;
    let escalationLevel = 0;
    const r = rnd();
    if (s.special) status = r < 0.6 ? 'In Review' : 'New';
    else if (s.ageDays < slaDays * 0.6) status = r < 0.55 ? 'New' : r < 0.95 ? 'In Review' : 'Hearing Scheduled';
    else if (s.ageDays < slaDays)
      status = r < 0.12 ? 'New' : r < 0.5 ? 'In Review' : r < 0.65 ? 'Hearing Scheduled' : r < 0.92 ? 'Resolved' : 'Closed';
    else if (r < 0.8) status = rnd() < 0.7 ? 'Resolved' : 'Closed';
    else {
      status = pick(['In Review', 'In Review', 'Hearing Scheduled', 'New']);
      escalationLevel = rnd() < 0.7 ? 1 : 2;
    }
    const isOpen = ['New', 'In Review', 'Hearing Scheduled'].includes(status);

    // ---- staff
    const officers = users.officers[bureau] || [];
    rrByBureau[bureau] = (rrByBureau[bureau] || 0) + 1;
    const officer = officers.length ? officers[(rrByBureau[bureau] + int(0, 1)) % officers.length] : users.heads[bureau];
    const head = users.heads[bureau];
    const chairman = users.chairman;
    let assignee = officer;
    if (isOpen && escalationLevel === 1) assignee = head;
    if (isOpen && escalationLevel === 2) assignee = chairman;

    // ---- resolution timing
    let resolvedAt;
    let closedAt;
    if (!isOpen) {
      const factor = s.ageDays < slaDays ? 0.3 + rnd() * 0.6 : 0.15 + rnd() * 1.2;
      const durDays = Math.max(0.2, Math.min(s.ageDays - 0.05, (s.ageDays < slaDays ? s.ageDays : slaDays) * factor));
      resolvedAt = new Date(createdAt.getTime() + durDays * DAY);
      if (status === 'Closed') {
        closedAt = new Date(Math.min(now.getTime() - 1000, resolvedAt.getTime() + int(1, 5) * DAY));
      }
    }

    // ---- escalation timing + deadline
    let slaDeadline = originalDeadline;
    let escalatedAt;
    const timelineExtra = [];
    if (isOpen && escalationLevel >= 1) {
      const e1 = new Date(Math.min(now.getTime() - 10 * 60000, originalDeadline.getTime() + int(1, 6) * HOUR));
      escalatedAt = e1;
      timelineExtra.push({ at: e1, level: 1 });
      slaDeadline =
        rnd() < 0.7
          ? new Date(now.getTime() + int(4, 60) * HOUR)
          : new Date(now.getTime() - int(2, 20) * HOUR);
      if (escalationLevel === 2) {
        const e2 = new Date(Math.max(e1.getTime(), Math.min(now.getTime() - 5 * 60000, e1.getTime() + ESCALATION_EXTENSION_HOURS[1] * HOUR)));
        escalatedAt = e2;
        timelineExtra.push({ at: e2, level: 2 });
        slaDeadline = new Date(now.getTime() + int(3, 40) * HOUR);
      }
    }

    // ---- timeline
    const tl = [];
    const push = (e) => tl.push({ by: 'System', byRole: 'system', visibility: 'internal', ...e });
    push({ action: 'created', message: 'Complaint received via Web Form.', by: `${s.first} ${s.last}`, byRole: 'citizen', at: createdAt, visibility: 'public' });
    push({
      action: 'classified',
      message: `Auto-triage (rule engine): ${ai.category}, ${ai.priority} priority (score ${ai.priorityScore}/100, confidence ${Math.round(ai.aiConfidence * 100)}%).`,
      at: createdAt,
    });
    push({ action: 'assigned', message: `Routed to ${firstBureau} for review.`, at: createdAt, visibility: 'public' });
    if (s.variant) {
      push({
        action: 'classified',
        message: `Institution matched to ${inst.name} (AICTE ID ${inst.permanentId}) from "${s.variant}" (name match).`,
        at: createdAt,
      });
    }
    const transfers = [];
    if (s.transferred) {
      const tAt = new Date(createdAt.getTime() + int(3, 36) * HOUR);
      const reason = pick([
        'Falls under the jurisdiction of this bureau.',
        'Subject matter belongs to this bureau, not the receiving cell.',
        'Transferred after initial scrutiny.',
      ]);
      push({ action: 'bureau', message: `Transferred from ${firstBureau} to ${bureau}. Reason: ${reason}`, by: (users.heads[firstBureau] || officer).name, byRole: 'bureau_head', at: tAt, visibility: 'public' });
      transfers.push({ from: firstBureau, to: bureau, by: (users.heads[firstBureau] || officer).name, reason, at: tAt });
      push({ action: 'assigned', message: `Assigned to ${officer.name} on transfer. SLA: ${Math.round(slaDays)} days.`, at: tAt });
    } else {
      push({ action: 'assigned', message: `Auto-assigned to ${officer.name} (lowest open workload). SLA: ${Math.round(slaDays)} days.`, at: createdAt });
    }

    const endCap = new Date((resolvedAt ? resolvedAt.getTime() : now.getTime()) - 60000);
    const at = (hoursAfterCreate) => new Date(Math.min(endCap.getTime(), createdAt.getTime() + hoursAfterCreate * HOUR));
    const stampBy = { by: officer.name, byRole: 'officer' };

    if (status !== 'New') {
      push({ action: 'status', message: 'Status changed from New to In Review.', from: 'New', to: 'In Review', at: at(int(2, 30)), visibility: 'public', ...stampBy });
      if (rnd() < 0.5) push({ action: 'note', message: pick(INTERNAL_NOTES), at: at(int(30, 90)), ...stampBy });
    }
    if (status === 'Hearing Scheduled' || (!isOpen && rnd() < 0.3)) {
      push({ action: 'status', message: 'Status changed from In Review to Hearing Scheduled.', from: 'In Review', to: 'Hearing Scheduled', at: at(int(60, 140)), visibility: 'public', ...stampBy });
    }
    for (const e of timelineExtra) {
      const target = e.level === 1 ? head : chairman;
      push({
        action: 'escalated',
        message: `SLA breached. Auto-escalated to ${ESCALATION_LEVELS[e.level]} (${target.name}). New deadline: ${ESCALATION_EXTENSION_HOURS[e.level]}h.`,
        by: 'SLA Engine',
        at: e.at,
        visibility: 'public',
      });
    }
    if (!isOpen) {
      const fromStatus = tl.some((t) => t.to === 'Hearing Scheduled') ? 'Hearing Scheduled' : 'In Review';
      push({ action: 'status', message: `Status changed from ${fromStatus} to Resolved.`, from: fromStatus, to: 'Resolved', at: resolvedAt, visibility: 'public', ...stampBy });
      push({ action: 'note', message: `Outcome: ${OUTCOMES[ai.category]}`, at: resolvedAt, visibility: 'public', ...stampBy });
      if (status === 'Closed') {
        push({ action: 'status', message: 'Status changed from Resolved to Closed.', from: 'Resolved', to: 'Closed', at: closedAt, visibility: 'public', ...stampBy });
        push({ action: 'note', message: 'Outcome: Closed after the complainant confirmed the resolution.', at: closedAt, visibility: 'public', ...stampBy });
      }
    }

    // ---- duplicates (compare with earlier complaints about the same institution, 120d window)
    const tokens = tokenize(`${s.title} ${s.description}`);
    let dup = { id: null, score: 0 };
    for (const prev of seenByInst.get(inst.name) || []) {
      if (createdAt.getTime() - prev.createdAt.getTime() > 120 * DAY) continue;
      const sc = similarity(tokens, prev.tokens);
      if (sc > dup.score) dup = { id: prev.complaintId, score: sc };
    }
    const isDup = dup.score >= DUPLICATE_THRESHOLD;
    if (isDup) {
      push({ action: 'duplicate', message: `Possible duplicate of ${dup.id} (${Math.round(dup.score * 100)}% text similarity). Review and link if appropriate.`, at: createdAt });
    }
    (seenByInst.get(inst.name) || seenByInst.set(inst.name, []).get(inst.name)).push({ complaintId, tokens, createdAt });

    tl.sort((a, b) => a.at - b.at);
    const updatedAt = tl.length ? tl[tl.length - 1].at : createdAt;
    const lastEntry = [...tl].reverse().find((t) => t.action !== 'classified') || tl[tl.length - 1];

    // ---- next action required
    let nextAction = '';
    let nextActionDue;
    if (isOpen) {
      if (escalationLevel >= 1) {
        nextAction = `Review the escalated case and decide the way forward (${ESCALATION_LEVELS[escalationLevel]})`;
        nextActionDue = slaDeadline;
      } else {
        const d = defaultNextAction(status, now);
        nextAction = d.text;
        // spread due dates around "now" so some are already late and the reminders have something to show
        nextActionDue = new Date(now.getTime() + int(-30, 120) * HOUR);
      }
    } else if (status === 'Resolved') {
      nextAction = defaultNextAction('Resolved', now).text;
      nextActionDue = new Date(now.getTime() + int(24, 96) * HOUR);
    }

    // ---- a few cases already carry supporting documents
    const documents = [];
    if (rnd() < 0.16) {
      documents.push({
        name: pick(['Fee receipts (complainant)', 'Admission brochure copy', 'Email correspondence with institute', 'Photographs of the issue']),
        url: `https://example.com/sample-documents/${complaintId.toLowerCase()}.pdf`,
        addedBy: `${s.first} ${s.last}`,
        at: createdAt,
      });
    }

    docs.push({
      complaintId,
      complainantName: `${s.first} ${s.last}`,
      complainantEmail: `${s.first}.${s.last}${int(10, 99)}@example.com`.toLowerCase(),
      complainantPhone: rnd() < 0.4 ? `9000${pad(int(0, 999999))}` : '',
      institution: inst.name,
      institutionId: inst.permanentId,
      institutionAsEntered: s.variant,
      institutionKey: normaliseInstitution(inst.name),
      state: inst.state,
      region: inst.region,
      title: s.title,
      description: s.description,
      category: ai.category,
      priority: ai.priority,
      priorityRank: PRIORITY_RANK[ai.priority],
      priorityScore: ai.priorityScore,
      aiTags: ai.aiTags,
      aiSummary: ai.aiSummary,
      aiConfidence: ai.aiConfidence,
      classifiedBy: 'rules',
      status,
      bureau,
      assignedTo: assignee ? assignee._id : null,
      assignedToName: assignee ? assignee.name : '',
      source: rnd() < 0.8 ? 'Web Form' : pick(['Email', 'Portal', 'Bulk Upload']),
      slaHours,
      originalDeadline,
      slaDeadline,
      escalationLevel: isOpen ? escalationLevel : 0,
      escalatedAt,
      duplicateOf: isDup ? dup.id : null,
      duplicateScore: isDup ? Number(dup.score.toFixed(2)) : 0,
      resolvedAt,
      closedAt,
      lastAction: String(lastEntry.message).slice(0, 220),
      lastActionAt: lastEntry.at,
      lastActionBy: lastEntry.by || '',
      nextAction,
      nextActionDue,
      transferCount: transfers.length,
      transfers,
      linkedCases: [],
      documents,
      timeline: tl,
      createdAt,
      updatedAt,
      __v: 0,
    });
  }

  // ---- cross-bureau overlaps: link some of them and record coordination for a couple
  const groups = detectOverlaps(docs, { now });
  const overlapRecords = [];
  const byId = new Map(docs.map((d) => [d.complaintId, d]));
  const regionHasOpenOverlap = new Set(); // keep at least one overlap needing action in every region
  groups.forEach((g, idx) => {
    if (idx % 4 === 1) {
      // officers have mapped the top case of each bureau to each other
      const tops = g.bureaus.map((b) => b.cases[0].complaintId);
      for (const id of tops) {
        const d = byId.get(id);
        const others = tops.filter((x) => x !== id);
        d.linkedCases = others;
        const at = new Date(now.getTime() - int(2, 40) * HOUR);
        d.timeline.push({ action: 'link', message: `Linked with ${others.join(', ')} (cross-bureau, same institution).`, by: d.assignedToName || 'System', byRole: 'officer', at, visibility: 'internal' });
        d.timeline.sort((a, b) => a.at - b.at);
        const last = d.timeline[d.timeline.length - 1];
        d.lastAction = last.message.slice(0, 220);
        d.lastActionAt = last.at;
        d.lastActionBy = last.by;
        d.updatedAt = last.at;
      }
    }
    const coordinate = idx % 5 === 2 && regionHasOpenOverlap.has(g.region);
    if (!coordinate) regionHasOpenOverlap.add(g.region);
    if (coordinate) {
      const lead = g.bureaus[0].bureau;
      const head = users.heads[lead];
      overlapRecords.push({
        institutionId: g.institutionId,
        leadBureau: lead,
        note: `${shortBureau(lead)} will take the lead; the other bureaus will hold their actions and share findings before any order is issued.`,
        bureausAtCoordination: g.bureauNames,
        coordinatedBy: head ? head.name : 'Bureau Head',
        coordinatedByRole: 'bureau_head',
        coordinatedAt: new Date(now.getTime() - int(20, 90) * HOUR),
      });
    }
  });

  const institutions = instList.map(({ weight, ...rest }) => rest);
  return { docs, counters, institutions, overlapRecords };
}
