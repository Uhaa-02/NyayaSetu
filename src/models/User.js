import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['officer', 'bureau_head', 'chairman', 'regional'], required: true },
    bureau: { type: String, default: null }, // null for chairman and regional offices
    region: { type: String, default: null }, // set for regional offices
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, bureau: 1 });

export default mongoose.models.User || mongoose.model('User', UserSchema);
