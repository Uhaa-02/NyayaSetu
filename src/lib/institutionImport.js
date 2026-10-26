// Reads a CSV of real institutions (for example from AICTE's public list) into registry records.
//
// Columns (header names are matched loosely, order does not matter):
//   permanent_id, name, state            - required
//   city, address, type, year            - optional
//
// The first rows get more demo complaints, so overlaps show up clearly on a few institutions.

import { parseCSV } from './csv.js';
import { STATE_REGION, INSTITUTION_TYPES } from './constants.js';
import { normaliseInstitution } from './institutions.js';

const HEADERS = {
  permanentId: ['permanent_id', 'permanentid', 'aicte_id', 'aicte_permanent_id', 'id', 'permanent id'],
  name: ['name', 'institution', 'institution_name', 'institute', 'institute_name'],
  state: ['state'],
  city: ['city', 'district', 'town'],
  address: ['address'],
  type: ['type', 'institution_type'],
  year: ['year', 'established', 'established_year'],
};

const STATE_LOOKUP = new Map(Object.keys(STATE_REGION).map((s) => [s.toLowerCase(), s]));
STATE_LOOKUP.set('jammu & kashmir', 'Jammu and Kashmir');
STATE_LOOKUP.set('nct of delhi', 'Delhi');
STATE_LOOKUP.set('orissa', 'Odisha');

function findColumn(header, names) {
  return header.findIndex((h) => names.includes(h.trim().toLowerCase().replace(/[\s-]+/g, '_')) || names.includes(h.trim().toLowerCase()));
}

function guessType(name) {
  const n = name.toLowerCase();
  if (/pharm/.test(n)) return 'Pharmacy';
  if (/polytechnic/.test(n)) return 'Polytechnic';
  if (/architect/.test(n)) return 'Architecture';
  if (/manage|business|mba/.test(n)) return 'Management';
  return 'Engineering';
}

/** @returns {{institutions: object[], errors: string[]}} */
export function parseInstitutionCSV(text) {
  const { headers: header, records: rows } = parseCSV(text);
  const errors = [];
  if (!rows.length) return { institutions: [], errors: ['The file has no data rows.'] };

  const col = Object.fromEntries(Object.entries(HEADERS).map(([k, names]) => [k, findColumn(header, names)]));
  for (const req of ['permanentId', 'name', 'state']) {
    if (col[req] < 0) errors.push(`Missing required column: ${req === 'permanentId' ? 'permanent_id' : req}`);
  }
  if (errors.length) return { institutions: [], errors };

  const out = [];
  const seenId = new Set();
  const seenName = new Set();
  rows.forEach((r, i) => {
    const line = i + 2;
    const get = (k) => (col[k] >= 0 ? String(r[header[col[k]]] ?? '').trim() : '');
    const permanentId = get('permanentId');
    const name = get('name');
    const stateRaw = get('state');
    const state = STATE_LOOKUP.get(stateRaw.toLowerCase());
    if (!permanentId || !name || !stateRaw) return errors.push(`Line ${line}: permanent_id, name and state are required.`);
    if (!/^[A-Za-z0-9-]{3,20}$/.test(permanentId)) return errors.push(`Line ${line}: bad Permanent ID "${permanentId}".`);
    if (!state) return errors.push(`Line ${line}: unknown state "${stateRaw}".`);
    const key = normaliseInstitution(name);
    if (seenId.has(permanentId) || seenName.has(key)) return errors.push(`Line ${line}: duplicate institution "${name}".`);
    seenId.add(permanentId);
    seenName.add(key);

    const city = get('city') || state;
    const typeRaw = get('type');
    const type = INSTITUTION_TYPES.find((t) => t.toLowerCase() === typeRaw.toLowerCase()) || guessType(name);
    const year = Number(get('year'));
    out.push({
      permanentId,
      name,
      key,
      state,
      region: STATE_REGION[state],
      city,
      type,
      establishedYear: year >= 1900 && year <= 2100 ? year : undefined,
      address: get('address') || `${city}, ${state}`,
      verified: true,
      weight: out.length < 8 ? 10 : out.length < 20 ? 4 : 1,
    });
  });
  return { institutions: out, errors };
}
