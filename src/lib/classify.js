// AI-assisted triage: category, priority score, tags, summary and duplicate similarity.
//
//  1. A fast, explainable RULE ENGINE always runs (no API key, no cost, works offline).
//  2. If ANTHROPIC_API_KEY is set, an LLM refines category / summary / tags. The final
//     priority is the HIGHER of the rule score and the LLM suggestion (safety first).
//     Any LLM failure silently falls back to the rule engine.

import { CATEGORIES, PRIORITIES, PRIORITY_RANK } from './constants.js';

// ---------------------------------------------------------------- category rules
const CATEGORY_KEYWORDS = {
  'Fee & Refund': [
    'fee', 'fees', 'refund', 'tuition', 'caution deposit', 'excess fee', 'receipt', 'receipts',
    'original certificates', 'withheld', 'charged', 'overcharg', 'fee structure', 'withdrew', 'withdrawal',
  ],
  'Affiliation & Approval': [
    'affiliation', 'approval', 'approved', 'unapproved', 'intake', 'sanctioned', 'recognition',
    'recognised', 'accreditation', 'extension of approval', 'without approval', 'not approved',
    'invalid degree', 'new programme', 'new program',
  ],
  'Faculty & Staffing': [
    'faculty', 'teacher', 'teachers', 'lecturer', 'professor', 'staff', 'salary', 'salaries',
    'teaching staff', 'ph.d', 'phd', 'student-teacher', 'vacant posts',
  ],
  'Infrastructure & Facilities': [
    'laboratory', 'laboratories', 'lab', 'labs', 'equipment', 'hostel', 'building', 'classroom',
    'classrooms', 'drinking water', 'library', 'internet', 'wifi', 'toilet', 'washroom', 'canteen',
    'cracks', 'unsafe building', 'infrastructure', 'power backup', 'playground',
  ],
  'Admission Irregularities': [
    'admission', 'admissions', 'capitation', 'donation', 'management quota', 'seat', 'seats',
    'counselling', 'entrance rank', 'merit list', 'brochure', 'cut-off', 'spot admission',
  ],
  'Academic Quality': [
    'exam', 'exams', 'examination', 'result', 'results', 'syllabus', 'classes', 'curriculum',
    'internal marks', 'evaluation', 'placement', 'placements', 'attendance', 'backlog', 'semester',
    'revaluation',
  ],
  'Financial Irregularity': [
    'scholarship', 'grant', 'funds', 'misuse', 'misappropriation', 'embezzle', 'fraud', 'bribe',
    'bribery', 'forged', 'forgery', 'audit', 'utilisation', 'utilization', 'kickback', 'corruption',
    'inspection clearance',
  ],
  'Harassment & Safety': [
    'ragging', 'harass', 'harassment', 'harassed', 'assault', 'sexual', 'abuse', 'bullying',
    'molest', 'stalking', 'threatened', 'threatens', 'threatening', 'internal committee', 'icc', 'intimidat',
    'discriminat',
  ],
};

// Base severity per category (0-45). Harassment & Safety / Financial Irregularity start high.
const CATEGORY_BASE = {
  'Harassment & Safety': 45,
  'Financial Irregularity': 35,
  'Admission Irregularities': 30,
  'Affiliation & Approval': 25,
  'Fee & Refund': 20,
  'Faculty & Staffing': 18,
  'Infrastructure & Facilities': 15,
  'Academic Quality': 15,
  Other: 8,
};

// Urgency cues - each adds to the priority score.
const URGENCY_KEYWORDS = {
  suicide: 40, 'self-harm': 40, assault: 30, harass: 30, ragging: 30, sexual: 30, molest: 30,
  abuse: 20, threat: 20, threatened: 20, fraud: 25, forged: 25, forgery: 25, bribe: 25, bribery: 25,
  capitation: 20, embezzle: 25, misappropriation: 25, fake: 20, unapproved: 12, illegal: 10,
  unauthorised: 10, unauthorized: 10, 'without approval': 10, 'not approved': 8, collapse: 25,
  cracks: 12, unsafe: 12, safety: 12, fire: 10, 'legal notice': 12, court: 12, rti: 8, media: 5,
  urgent: 8, immediately: 5, withheld: 8, 'no response': 6, 'unanswered': 6, 'misleading': 8,
};

const SEVERITY_BANDS = [
  { min: 70, label: 'Critical' },
  { min: 50, label: 'High' },
  { min: 28, label: 'Medium' },
  { min: 0, label: 'Low' },
];

export function priorityFromScore(score) {
  return SEVERITY_BANDS.find((b) => score >= b.min).label;
}

function countOccurrences(haystack, needle) {
  // word-boundary aware for single words; plain includes for phrases/prefixes.
  if (needle.includes(' ') || needle.includes('.') || needle.includes('-')) {
    return haystack.includes(needle) ? 1 : 0;
  }
  const re = new RegExp(`\\b${needle}`, 'i'); // prefix match so "harass" hits "harassment"
  return re.test(haystack) ? 1 : 0;
}

function extractStudentsAffected(text) {
  const m = text.match(/(\d{2,5})\s*(?:\+\s*)?(?:students|candidates|parents|aspirants|families)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function toTitleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSummary(title, description, category) {
  const clean = String(description || '').replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  let summary = sentences.slice(0, 2).join(' ');
  if (summary.length > 260) summary = summary.slice(0, 257).trimEnd() + '...';
  if (!summary) summary = title;
  return `${category}: ${summary}`;
}

/**
 * Rule-based classifier. Pure & synchronous.
 * @param {{title:string, description:string, institution?:string}} input
 * @param {{repeatCount?:number}} ctx  number of OPEN complaints already filed against this institution
 */
export function classifyRules(input, ctx = {}) {
  const title = String(input.title || '');
  const description = String(input.description || '');
  const text = `${title}. ${title}. ${description}`.toLowerCase(); // title counted twice => more weight

  // 1) category scoring
  const scores = {};
  const matched = {};
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    let s = 0;
    for (const w of words) {
      const hit = countOccurrences(text, w);
      if (hit) {
        s += w.includes(' ') ? 2 : 1;
        (matched[cat] ||= []).push(w);
      }
    }
    scores[cat] = s;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  let [topCat, topScore] = ranked[0];
  const secondScore = ranked[1] ? ranked[1][1] : 0;
  let category = topScore > 0 ? topCat : 'Other';
  // Safety first: any strong harassment / safety cue wins even if other words dominate.
  if (scores['Harassment & Safety'] >= 1 && /ragging|sexual|assault|molest|harass/i.test(text)) {
    category = 'Harassment & Safety';
    topScore = scores[category];
  }
  const confidence =
    category === 'Other' ? 0.4 : Math.min(0.98, Math.max(0.5, topScore / (topScore + secondScore + 0.6)));

  // 2) priority score
  let score = CATEGORY_BASE[category] ?? 8;
  const urgencyHits = [];
  for (const [w, pts] of Object.entries(URGENCY_KEYWORDS)) {
    if (countOccurrences(text, w)) {
      score += pts;
      urgencyHits.push(w);
    }
  }
  const students = extractStudentsAffected(text);
  if (students) score += Math.min(25, Math.round(students / 20));
  const repeat = Math.min(15, (ctx.repeatCount || 0) * 5);
  score += repeat;
  score = Math.min(100, Math.round(score));

  const tags = [
    ...new Set([...(matched[category] || []).slice(0, 3), ...urgencyHits.slice(0, 3)]),
  ]
    .slice(0, 5)
    .map(toTitleCase);
  if (students) tags.push(`${students}+ Students`);
  if (repeat >= 10) tags.push('Repeat Institution');

  return {
    category,
    priority: priorityFromScore(score),
    priorityScore: score,
    aiTags: tags.slice(0, 6),
    aiSummary: buildSummary(title, description, category),
    aiConfidence: Number(confidence.toFixed(2)),
    classifiedBy: 'rules',
  };
}

// ---------------------------------------------------------------- optional LLM refinement
async function classifyWithLLM(input) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const prompt =
      `You triage complaints against technical institutions for AICTE (India).\n` +
      `Return ONLY compact JSON with keys: category (one of ${JSON.stringify(CATEGORIES)}), ` +
      `priority (one of ${JSON.stringify(PRIORITIES)}), summary (max 40 words), tags (array of up to 5 short strings).\n\n` +
      `Institution: ${String(input.institution || '').slice(0, 150)}\n` +
      `Title: ${String(input.title || '').slice(0, 200)}\n` +
      `Complaint: ${String(input.description || '').slice(0, 3000)}`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonStr);
    if (!CATEGORIES.includes(parsed.category) || !PRIORITIES.includes(parsed.priority)) return null;
    return {
      category: parsed.category,
      priority: parsed.priority,
      summary: String(parsed.summary || '').slice(0, 400),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map((t) => String(t).slice(0, 30)) : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Full analysis used by the API: rules first, LLM refinement when configured. */
export async function analyzeComplaint(input, ctx = {}) {
  const base = classifyRules(input, ctx);
  const llm = await classifyWithLLM(input);
  if (!llm) return base;

  const higher =
    PRIORITY_RANK[llm.priority] > PRIORITY_RANK[base.priority] ? llm.priority : base.priority;
  return {
    ...base,
    category: llm.category,
    priority: higher,
    aiSummary: llm.summary ? `${llm.category}: ${llm.summary}` : base.aiSummary,
    aiTags: llm.tags.length ? llm.tags : base.aiTags,
    aiConfidence: Math.max(base.aiConfidence, 0.85),
    classifiedBy: 'llm',
  };
}

// ---------------------------------------------------------------- duplicate detection
const STOP = new Set(
  ('the and for are was were with that this have has had not but from they their there been being will would ' +
    'about which when what who whom into onto over under than then them these those such our your you its ' +
    'his her she him can could should may might also only any all more most some very just still even ' +
    'institute college students student complaint please kindly sir madam').split(' ')
);

export function tokenize(text) {
  return [
    ...new Set(
      String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w))
    ),
  ];
}

export function similarity(a, b) {
  const A = new Set(Array.isArray(a) ? a : tokenize(a));
  const B = new Set(Array.isArray(b) ? b : tokenize(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter); // Jaccard
}

export const DUPLICATE_THRESHOLD = 0.5;
