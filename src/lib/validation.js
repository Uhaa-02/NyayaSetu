// Pure input validation for complaints (no DB, usable in tests and API routes).
import { STATES } from './constants.js';
import { normaliseInstitution } from './institutions.js';

const str = (x) => String(x ?? '').trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export { normaliseInstitution };

/** Accepts only http(s) links. Returns the cleaned URL or '' */
export function cleanUrl(x) {
  const v = str(x);
  if (!v) return '';
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString().slice(0, 500) : '';
  } catch {
    return '';
  }
}

/** Validates raw input. Returns { ok, errors: string[], value } */
export function validateComplaintInput(raw) {
  const errors = [];
  const r = raw || {};
  const stateInput = str(r.state);
  const state = STATES.find((s) => s.toLowerCase() === stateInput.toLowerCase());

  const value = {
    complainantName: str(r.complainantName),
    complainantEmail: str(r.complainantEmail).toLowerCase(),
    complainantPhone: str(r.complainantPhone),
    institution: str(r.institution),
    institutionId: str(r.institutionId).toUpperCase(), // optional AICTE Permanent ID
    documentUrl: str(r.documentUrl),
    state: state || stateInput,
    title: str(r.title),
    description: str(r.description),
  };

  if (value.complainantName.length < 2 || value.complainantName.length > 100)
    errors.push('Name must be 2-100 characters.');
  if (!EMAIL_RE.test(value.complainantEmail) || value.complainantEmail.length > 150)
    errors.push('A valid email address is required.');
  if (value.complainantPhone) {
    const digits = value.complainantPhone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) errors.push('Phone number must have 10-13 digits.');
  }
  if (value.institution.length < 3 || value.institution.length > 150)
    errors.push('Institution name must be 3-150 characters.');
  if (value.institutionId && !/^[A-Z0-9-]{3,20}$/.test(value.institutionId))
    errors.push('AICTE Permanent ID may only contain letters, digits and hyphens.');
  if (value.documentUrl && !cleanUrl(value.documentUrl)) errors.push('Supporting document link must start with http:// or https://');
  else value.documentUrl = cleanUrl(value.documentUrl);
  if (!state) errors.push(`State must be one of the supported states (got "${stateInput || 'empty'}").`);
  if (value.title.length < 5 || value.title.length > 150) errors.push('Title must be 5-150 characters.');
  if (value.description.length < 20 || value.description.length > 4000)
    errors.push('Description must be 20-4000 characters.');

  return { ok: errors.length === 0, errors, value };
}
