// Shared constants. Pure data only (no imports) so this file is safe to use on the
// server, in the browser and in the Node seed script.

export const APP_NAME = 'NyayaSetu';
export const APP_TAGLINE = 'Unified complaint intelligence for AICTE bureaus';

export const ROLES = {
  OFFICER: 'officer',
  BUREAU_HEAD: 'bureau_head',
  CHAIRMAN: 'chairman',
  REGIONAL: 'regional',
};

export const ROLE_LABELS = {
  officer: 'Case Officer',
  bureau_head: 'Bureau Head',
  chairman: 'Chairman Office',
  regional: 'Regional Office',
};

// Bureaus / cells that deal with institution-related complaints.
// RB = Regulation Bureau and PGRC = Public Grievance Redressal Cell, as named in the problem statement.
export const BUREAUS = [
  'Public Grievance Redressal Cell',
  'Regulation Bureau',
  'Approval Bureau',
  'Fee Regulation Bureau',
  'Academic Quality Bureau',
  'Vigilance Cell',
];

export const BUREAU_SHORT = {
  'Public Grievance Redressal Cell': 'PGRC',
  'Regulation Bureau': 'RB',
  'Approval Bureau': 'AB',
  'Fee Regulation Bureau': 'FRB',
  'Academic Quality Bureau': 'AQB',
  'Vigilance Cell': 'VC',
};

export const shortBureau = (b) => BUREAU_SHORT[b] || b;

export const CATEGORIES = [
  'Fee & Refund',
  'Affiliation & Approval',
  'Faculty & Staffing',
  'Infrastructure & Facilities',
  'Admission Irregularities',
  'Academic Quality',
  'Financial Irregularity',
  'Harassment & Safety',
  'Other',
];

// Which bureau normally handles which category (auto-routing).
export const CATEGORY_TO_BUREAU = {
  'Fee & Refund': 'Fee Regulation Bureau',
  'Affiliation & Approval': 'Regulation Bureau',
  'Faculty & Staffing': 'Academic Quality Bureau',
  'Infrastructure & Facilities': 'Approval Bureau',
  'Admission Irregularities': 'Public Grievance Redressal Cell',
  'Academic Quality': 'Academic Quality Bureau',
  'Financial Irregularity': 'Vigilance Cell',
  'Harassment & Safety': 'Public Grievance Redressal Cell',
  Other: 'Public Grievance Redressal Cell',
};

export const STATUSES = ['New', 'In Review', 'Hearing Scheduled', 'Resolved', 'Closed'];
export const OPEN_STATUSES = ['New', 'In Review', 'Hearing Scheduled'];
export const DONE_STATUSES = ['Resolved', 'Closed'];

// Dashboard stages used by the problem statement: pending, under process, disposed
// (transferred and escalated are tracked separately because they overlap with these).
export const PENDING_STATUSES = ['New'];
export const PROCESS_STATUSES = ['In Review', 'Hearing Scheduled'];
export const STAGES = {
  pending: PENDING_STATUSES,
  process: PROCESS_STATUSES,
  disposed: DONE_STATUSES,
};

// Alert thresholds (hours)
export const DUE_SOON_HOURS = 48;
export const PENDING_REMINDER_HOURS = 48;

// Allowed status transitions.
export const TRANSITIONS = {
  New: ['In Review', 'Closed'],
  'In Review': ['Hearing Scheduled', 'Resolved', 'Closed'],
  'Hearing Scheduled': ['In Review', 'Resolved', 'Closed'],
  Resolved: ['Closed', 'In Review'],
  Closed: ['In Review'],
};

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
export const PRIORITY_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

// Service-level agreement: hours allowed to resolve a complaint, by priority.
export const SLA_HOURS = { Critical: 72, High: 168, Medium: 336, Low: 720 };

// Escalation ladder. A breached SLA moves a case one rung up and grants extra time.
export const ESCALATION_LEVELS = ['Case Officer', 'Bureau Head', 'Chairman Office'];
export const ESCALATION_EXTENSION_HOURS = { 1: 72, 2: 48 };

export const SOURCES = ['Web Form', 'Email', 'Bulk Upload', 'Officer Entry', 'Portal'];

export const INSTITUTION_TYPES = ['Engineering', 'Pharmacy', 'Management', 'Architecture', 'Polytechnic'];

// Regional offices (one demo account each)
export const REGIONAL_OFFICE_CITY = {
  'South Central': 'Hyderabad',
  Western: 'Mumbai',
  Northern: 'New Delhi',
  Eastern: 'Kolkata',
  Southern: 'Chennai',
  'South Western': 'Bengaluru',
  Central: 'Bhopal',
  'North-Eastern': 'Guwahati',
};

export const OVERLAP_MESSAGE = 'Potential Overlapping Cases – Coordination Required';

export const STATE_REGION = {
  Telangana: 'South Central',
  'Andhra Pradesh': 'South Central',
  Karnataka: 'South Western',
  'Tamil Nadu': 'Southern',
  Kerala: 'Southern',
  Maharashtra: 'Western',
  Gujarat: 'Western',
  Rajasthan: 'Northern',
  Delhi: 'Northern',
  Punjab: 'Northern',
  Haryana: 'Northern',
  'Uttar Pradesh': 'Central',
  'Madhya Pradesh': 'Central',
  Chhattisgarh: 'Central',
  Bihar: 'Eastern',
  'West Bengal': 'Eastern',
  Odisha: 'Eastern',
  Jharkhand: 'Eastern',
  Assam: 'North-Eastern',
  Uttarakhand: 'Northern',
  'Himachal Pradesh': 'Northern',
  'Jammu and Kashmir': 'Northern',
  Chandigarh: 'Northern',
  Goa: 'Western',
  Puducherry: 'Southern',
  Meghalaya: 'North-Eastern',
  Tripura: 'North-Eastern',
  Manipur: 'North-Eastern',
  Nagaland: 'North-Eastern',
  Mizoram: 'North-Eastern',
  Sikkim: 'North-Eastern',
  'Arunachal Pradesh': 'North-Eastern',
};

export const STATES = Object.keys(STATE_REGION).sort();
export const REGIONS = [
  'Northern',
  'North-Eastern',
  'Eastern',
  'Central',
  'Western',
  'South Central',
  'South Western',
  'Southern',
];
