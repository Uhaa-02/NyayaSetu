import mongoose from 'mongoose';
import { INSTITUTION_TYPES } from '../lib/constants.js';

// Institution registry: one record per institution, identified by its AICTE Permanent ID.
// (The IDs in the demo data are fictional.) Complaints point to it through `institutionId`.
const InstitutionSchema = new mongoose.Schema(
  {
    permanentId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, unique: true }, // lower-case name
    type: { type: String, enum: INSTITUTION_TYPES, default: 'Engineering' },
    city: { type: String, default: '' },
    address: { type: String, default: '' },
    state: { type: String, required: true },
    region: { type: String, required: true },
    establishedYear: Number,
    verified: { type: Boolean, default: true }, // false = created automatically from a complaint
  },
  { timestamps: true }
);

InstitutionSchema.index({ state: 1 });
InstitutionSchema.index({ region: 1 });

export default mongoose.models.Institution || mongoose.model('Institution', InstitutionSchema);
