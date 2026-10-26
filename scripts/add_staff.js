// Adds (or updates) staff accounts from data/staff.csv WITHOUT deleting anything else.
//
//   1. Copy data/staff.template.csv to data/staff.csv and fill in your real staff e-mail addresses.
//   2. npm run add-staff
//
// Existing accounts are matched by e-mail: name, role, bureau and region are updated, the password is kept.
// New accounts get DEMO_PASSWORD (default Demo@1234). Reads MONGODB_URI from .env.local.
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import fs from 'node:fs';
import User from '../src/models/User.js';
import { parseStaffCSV } from '../src/lib/staffImport.js';
import { withDnsFallback } from '../src/lib/dnsFix.js';

config({ path: '.env.local' });
config();

const file = process.argv[2] || 'data/staff.csv';
if (!fs.existsSync(file)) {
  console.error(`\n  ${file} not found. Copy data/staff.template.csv to ${file} and fill it in.\n`);
  process.exit(1);
}
const uri = process.env.MONGODB_URI;
if (!uri || uri.includes('<password>') || uri.includes('<cluster>')) {
  console.error('\n  MONGODB_URI is missing or still has a placeholder. Check .env.local.\n');
  process.exit(1);
}

const { staff, errors } = parseStaffCSV(fs.readFileSync(file, 'utf8'));
errors.forEach((e) => console.warn('  ' + e));
if (!staff.length) {
  console.error('\n  No valid rows found. Nothing was changed.\n');
  process.exit(1);
}

try {
  await withDnsFallback(() => mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 }));
  console.log(`Connected to database "${mongoose.connection.name}".`);
  const hash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'Demo@1234', 10);
  let added = 0;
  let updated = 0;
  for (const u of staff) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      Object.assign(existing, { ...u, active: true });
      await existing.save();
      updated++;
    } else {
      await User.create({ ...u, passwordHash: hash });
      added++;
    }
  }
  console.log(`Done: ${added} added, ${updated} updated, ${errors.length} skipped.`);
  console.log('New accounts sign in with DEMO_PASSWORD (default Demo@1234).');
} catch (e) {
  console.error('\n  Failed:', e.message, '\n');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
