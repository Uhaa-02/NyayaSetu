// Institution data matching (pure, no database).
//
// Complaints name institutions in many ways ("Greenfield Inst. of Engg & Tech", "greenfield institute
// of engineering and technology, hyderabad", or just the AICTE Permanent ID). To find every case that
// concerns the SAME institution, each complaint is matched to one record of the institution registry.
// That registry ID, not the free text, is what the overlap detector groups on.

const ABBREVIATIONS = {
  inst: 'institute',
  insti: 'institute',
  institue: 'institute',
  engg: 'engineering',
  eng: 'engineering',
  engr: 'engineering',
  tech: 'technology',
  technol: 'technology',
  technological: 'technology',
  technical: 'technology',
  coll: 'college',
  clg: 'college',
  univ: 'university',
  mgmt: 'management',
  mgt: 'management',
  poly: 'polytechnic',
  sch: 'school',
  pharm: 'pharmacy',
  arch: 'architecture',
  res: 'research',
  sci: 'science',
  edu: 'education',
};

const STOPWORDS = new Set(['of', 'the', 'and', 'for', 'in', 'at', 'a', 'an']);

/** Lower-case, whitespace-collapsed name. Used as the stored key (kept compatible with older data). */
export function normaliseInstitution(name) {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Tokens used for matching: lower-case words, abbreviations expanded, stop-words removed. */
export function nameTokens(name) {
  const words = String(name ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ABBREVIATIONS[w] || w)
    .filter((w) => !STOPWORDS.has(w));
  return [...new Set(words)];
}

function editDistanceAtMostOne(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length === b.length) {
      i++;
      j++;
    } else if (a.length > b.length) i++;
    else j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function tokensMatch(a, b) {
  if (a === b) return true;
  // tolerate a single typo in longer words ("greenfeild")
  return a.length >= 6 && b.length >= 6 && editDistanceAtMostOne(a, b);
}

/** Fuzzy Jaccard similarity of two token lists (0..1). */
export function nameSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const used = new Set();
  let matched = 0;
  for (const a of tokensA) {
    const hit = tokensB.findIndex((b, idx) => !used.has(idx) && tokensMatch(a, b));
    if (hit >= 0) {
      used.add(hit);
      matched++;
    }
  }
  const union = tokensA.length + tokensB.length - matched;
  return union ? matched / union : 0;
}

const ID_RE = /\b(?:\d-\d{5,12}|UNV-\d{3,8})\b/i;

/**
 * Finds the registry institution a free-text name refers to.
 * @param {string} input     what the complainant typed (a name, a Permanent ID, or both)
 * @param {Array<{permanentId:string,name:string,state?:string}>} registry
 * @param {{state?:string, threshold?:number}} opts
 * @returns {{institution:object, score:number, method:'id'|'exact'|'fuzzy'}|null}
 */
export function matchInstitution(input, registry, { state, threshold = 0.6 } = {}) {
  const text = String(input ?? '').trim();
  if (!text || !registry?.length) return null;

  // 1) an explicit AICTE Permanent ID anywhere in the text wins
  const idHit = text.match(ID_RE);
  if (idHit) {
    const found = registry.find((r) => r.permanentId.toLowerCase() === idHit[0].toLowerCase());
    if (found) return { institution: found, score: 1, method: 'id' };
  }

  // 2) exact normalised name
  const key = normaliseInstitution(text);
  const exact = registry.find((r) => normaliseInstitution(r.name) === key);
  if (exact) return { institution: exact, score: 1, method: 'exact' };

  // 3) fuzzy token match, stricter when the state disagrees
  const tokens = nameTokens(text.replace(ID_RE, ' '));
  if (!tokens.length) return null;
  let best = null;
  let second = 0;
  for (const r of registry) {
    let score = nameSimilarity(tokens, r._tokens || nameTokens(r.name));
    if (state && r.state && r.state !== state) score *= 0.75; // same name in another state is probably a different campus
    if (!best || score > best.score) {
      if (best) second = best.score;
      best = { institution: r, score };
    } else if (score > second) second = score;
  }
  if (best && best.score >= threshold && best.score - second >= 0.05) {
    return { institution: best.institution, score: Number(best.score.toFixed(2)), method: 'fuzzy' };
  }
  return null;
}

/** Prepares a registry array for repeated matching (caches tokens). */
export function prepareRegistry(list) {
  return list.map((r) => ({ ...r, _tokens: nameTokens(r.name) }));
}
