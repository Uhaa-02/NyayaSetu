// Parses a CSV of staff accounts (pure function, no database). Used by scripts/add_staff.js.
//
// Columns (header names are case-insensitive): email, name, role, bureau, region
//   role   : chairman | bureau_head | officer | regional      (also accepts "bureau head")
//   bureau : required for bureau_head and officer. Full name or short code (PGRC, RB, AB, FRB, AQB, VC)
//   region : required for regional (e.g. South Central)
import { parseCSV } from './csv.js';
import { BUREAUS, BUREAU_SHORT, REGIONS } from './constants.js';

const ROLES = ['chairman', 'bureau_head', 'officer', 'regional'];
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function normaliseBureau(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  return BUREAUS.find((b) => b.toLowerCase() === s || BUREAU_SHORT[b].toLowerCase() === s) || null;
}

export function parseStaffCSV(text) {
  const { headers, records } = parseCSV(text);
  const staff = [];
  const errors = [];
  const seen = new Set();
  const key = (r, k) => String(r[k] ?? r[Object.keys(r).find((h) => h.trim().toLowerCase() === k)] ?? '').trim();
  void headers;
  records.forEach((r, i) => {
    const line = i + 2;
    const email = key(r, 'email').toLowerCase();
    const name = key(r, 'name');
    const role = key(r, 'role').toLowerCase().replace(/[\s-]+/g, '_');
    if (!email && !name && !role) return; // blank line
    if (!EMAIL_RE.test(email)) return errors.push(`Line ${line}: "${email}" is not a valid e-mail address.`);
    if (seen.has(email)) return errors.push(`Line ${line}: ${email} appears twice.`);
    if (name.length < 2) return errors.push(`Line ${line}: name is required.`);
    if (!ROLES.includes(role)) return errors.push(`Line ${line}: role must be one of ${ROLES.join(', ')}.`);
    const u = { name, email, role, bureau: null, region: null };
    if (role === 'bureau_head' || role === 'officer') {
      u.bureau = normaliseBureau(key(r, 'bureau'));
      if (!u.bureau) return errors.push(`Line ${line}: ${role} needs a valid bureau (${Object.values(BUREAU_SHORT).join(', ')}).`);
    }
    if (role === 'regional') {
      const region = REGIONS.find((x) => x.toLowerCase() === key(r, 'region').toLowerCase());
      if (!region) return errors.push(`Line ${line}: regional needs a valid region (${REGIONS.join(', ')}).`);
      u.region = region;
    }
    seen.add(email);
    staff.push(u);
  });
  return { staff, errors };
}

/**
 * Puts real people into the demo staff list. For each row, the first demo account with the same role (and same
 * bureau / region) takes the row's e-mail and name; rows with no demo match are added. Returns a new list.
 */
export function applyStaffOverrides(base, rows) {
  const out = base.map((u) => ({ ...u }));
  const taken = new Set();
  for (const r of rows) {
    const i = out.findIndex(
      (u, idx) => !taken.has(idx) && u.role === r.role && (u.bureau || null) === (r.bureau || null) && (u.region || null) === (r.region || null)
    );
    if (i >= 0) {
      taken.add(i);
      out[i] = { ...out[i], email: r.email, name: r.name || out[i].name };
    } else {
      out.push({ name: r.name, email: r.email, role: r.role, bureau: r.bureau || null, region: r.region || null });
    }
  }
  return out;
}
