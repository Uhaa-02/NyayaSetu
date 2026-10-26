// Seeds MongoDB with demo staff accounts, an institution registry and ~260 synthetic complaints
// (including cases that overlap across bureaus).
//
//   npm run seed
//
// WARNING: this DELETES all existing users, complaints, institutions and counters in the target database.
// Reads MONGODB_URI and DEMO_PASSWORD from .env.local (or the environment).

import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Complaint from '../src/models/Complaint.js';
import Counter from '../src/models/Counter.js';
import Institution from '../src/models/Institution.js';
import OverlapRecord from '../src/models/OverlapRecord.js';
import { SEED_STAFF, buildSeedComplaints, seedUsersFrom } from '../src/lib/seedData.js';
import { detectOverlaps } from '../src/lib/overlap.js';
import { withDnsFallback } from '../src/lib/dnsFix.js';
import { parseInstitutionCSV } from '../src/lib/institutionImport.js';
import { applyStaffOverrides, parseStaffCSV } from '../src/lib/staffImport.js';
import fs from 'node:fs';

config({ path: '.env.local' });
config(); // fall back to .env

const uri = process.env.MONGODB_URI;
if (!uri || uri.includes('<password>')) {
  console.error('\n  MONGODB_URI is missing (or still contains <password>).');
  console.error('  Create .env.local from .env.example and paste your MongoDB Atlas connection string.\n');
  process.exit(1);
}

const password = process.env.DEMO_PASSWORD || 'Demo@1234';

try {
  console.log('Connecting to MongoDB...');
  await withDnsFallback(() => mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 }));
  console.log(`Connected to database "${mongoose.connection.name}".`);

  console.log('Clearing old data...');
  await Promise.all([
    User.deleteMany({}),
    Complaint.deleteMany({}),
    Counter.deleteMany({}),
    Institution.deleteMany({}),
    OverlapRecord.deleteMany({}),
  ]);

  console.log('Creating staff accounts...');
  const passwordHash = await bcrypt.hash(password, 10);
  // Optional: data/staff.csv puts real people (and real e-mail addresses) into the staff list.
  let staffList = SEED_STAFF;
  if (fs.existsSync('data/staff.csv')) {
    const parsed = parseStaffCSV(fs.readFileSync('data/staff.csv', 'utf8'));
    parsed.errors.forEach((e) => console.warn('  staff.csv:', e));
    staffList = applyStaffOverrides(SEED_STAFF, parsed.staff);
    console.log(`Using ${parsed.staff.length} real staff e-mail(s) from data/staff.csv.`);
  }
  const created = await User.insertMany(staffList.map((u) => ({ ...u, passwordHash })));
  const users = seedUsersFrom(
    created.map((u) => ({ _id: u._id, name: u.name, role: u.role, bureau: u.bureau, region: u.region }))
  );

  console.log('Generating complaints (classified with the same engine the app uses)...');
  // Optional: use real institutions from data/institutions.csv instead of the built-in fictional ones.
  let institutions;
  if (fs.existsSync('data/institutions.csv')) {
    const parsed = parseInstitutionCSV(fs.readFileSync('data/institutions.csv', 'utf8'));
    parsed.errors.slice(0, 10).forEach((e) => console.warn('  institutions.csv:', e));
    if (parsed.institutions.length >= 10) {
      institutions = parsed.institutions;
      console.log(`Using ${institutions.length} institutions from data/institutions.csv (complaints are still synthetic sample data).`);
    } else {
      console.warn('  data/institutions.csv has fewer than 10 usable rows; using the built-in fictional institutions.');
    }
  }
  const built = buildSeedComplaints({ now: new Date(), users, institutions });
  const counters = built.counters;
  // drop undefined fields so MongoDB does not store them as null
  const docs = built.docs.map((d) => Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)));

  console.log('Registering institutions...');
  await Institution.insertMany(built.institutions);

  // Raw driver insert keeps the back-dated createdAt / updatedAt values exactly as generated.
  await Complaint.collection.insertMany(docs);
  await Counter.insertMany(Object.entries(counters).map(([_id, seq]) => ({ _id, seq })));
  if (built.overlapRecords.length) await OverlapRecord.insertMany(built.overlapRecords);

  await Complaint.syncIndexes();
  await User.syncIndexes();
  await Institution.syncIndexes();
  await OverlapRecord.syncIndexes();

  const isOpen = (d) => ['New', 'In Review', 'Hearing Scheduled'].includes(d.status);
  const open = docs.filter(isOpen).length;
  const overdue = docs.filter((d) => isOpen(d) && d.slaDeadline < new Date()).length;
  const overlaps = detectOverlaps(docs, { records: built.overlapRecords });
  const needCoordination = overlaps.filter((g) => g.status === 'Coordination Required').length;

  console.log('\nDone!');
  console.log(`  Staff accounts : ${created.length}`);
  console.log(`  Institutions   : ${built.institutions.length}`);
  console.log(`  Complaints     : ${docs.length}  (open: ${open}, currently overdue: ${overdue})`);
  console.log(`  Overlaps       : ${overlaps.length} institutions with several bureaus active (${needCoordination} need coordination)`);
  console.log('\nDemo logins (password for all: ' + password + ')');
  console.log('  chairman@nyayasetu.demo   - Chairman Office / Competent Authority (sees everything)');
  console.log('  head@nyayasetu.demo       - Bureau Head, Public Grievance Redressal Cell (PGRC)');
  console.log('  head.regulation@nyayasetu.demo - Bureau Head, Regulation Bureau (RB)');
  console.log('  officer@nyayasetu.demo    - Case Officer, PGRC');
  console.log('  regional.south@nyayasetu.demo  - Regional Office, South Central region\n');
} catch (err) {
  console.error('\nSeeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
