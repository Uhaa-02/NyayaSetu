import mongoose from 'mongoose';

// Records that the bureaus dealing with one institution have coordinated.
// "Coordinated" only holds while the set of bureaus is unchanged: if another bureau starts
// handling the institution later, the overlap becomes "Coordination Required" again.
const OverlapRecordSchema = new mongoose.Schema(
  {
    institutionId: { type: String, required: true, unique: true, index: true },
    leadBureau: { type: String, required: true },
    note: { type: String, required: true },
    bureausAtCoordination: [String],
    coordinatedBy: { type: String, required: true },
    coordinatedByRole: String,
    coordinatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.OverlapRecord || mongoose.model('OverlapRecord', OverlapRecordSchema);
