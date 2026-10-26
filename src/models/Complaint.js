import mongoose from 'mongoose';
import {
  BUREAUS,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  SOURCES,
} from '../lib/constants.js';

// One entry per action. "public" entries are visible on the citizen tracking page,
// "internal" entries (notes, AI triage, duplicate flags) are only visible to staff.
const TimelineSchema = new mongoose.Schema(
  {
    action: { type: String, required: true }, // created | classified | assigned | status | note | escalated | priority | duplicate | bureau | overlap | link | document | next_action | coordination
    message: { type: String, required: true },
    from: String,
    to: String,
    by: { type: String, default: 'System' },
    byRole: { type: String, default: 'system' },
    at: { type: Date, default: Date.now },
    visibility: { type: String, enum: ['public', 'internal'], default: 'internal' },
  },
  { _id: false }
);

const TransferSchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    by: String,
    reason: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const DocumentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    addedBy: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ComplaintSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, unique: true, index: true },

    // complainant
    complainantName: { type: String, required: true, trim: true },
    complainantEmail: { type: String, required: true, lowercase: true, trim: true },
    complainantPhone: { type: String, trim: true, default: '' },

    // institution (matched to the registry; institutionId is the AICTE Permanent ID)
    institution: { type: String, required: true, trim: true },
    institutionId: { type: String, default: null, index: true },
    institutionAsEntered: { type: String, default: '' }, // what the complainant typed, if different
    institutionKey: { type: String, required: true, index: true }, // lower-case, for repeat/dup detection
    state: { type: String, required: true },
    region: { type: String, required: true },

    // content
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    // AI triage
    category: { type: String, enum: CATEGORIES, required: true },
    priority: { type: String, enum: PRIORITIES, required: true },
    priorityRank: { type: Number, required: true }, // 4..1 for sorting
    priorityScore: { type: Number, default: 0 },
    aiTags: [String],
    aiSummary: String,
    aiConfidence: Number,
    classifiedBy: { type: String, enum: ['rules', 'llm'], default: 'rules' },

    // workflow
    status: { type: String, enum: STATUSES, default: 'New', index: true },
    bureau: { type: String, enum: BUREAUS, required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedToName: { type: String, default: '' },
    source: { type: String, enum: SOURCES, default: 'Web Form' },

    // case tracking: what was done last and what must happen next
    lastAction: { type: String, default: '' },
    lastActionAt: Date,
    lastActionBy: { type: String, default: '' },
    nextAction: { type: String, default: '' },
    nextActionDue: Date,

    // movement between bureaus / cells, and manual links to related cases
    transferCount: { type: Number, default: 0 },
    transfers: [TransferSchema],
    linkedCases: [String], // complaintIds of related cases (mapped by officers)
    documents: [DocumentSchema], // supporting documents (links)

    // SLA
    slaHours: Number,
    originalDeadline: Date,
    slaDeadline: { type: Date, index: true },
    escalationLevel: { type: Number, default: 0, min: 0, max: 2 },
    escalatedAt: Date,
    remindedAt: Date, // last time an email reminder digest included this case

    // duplicate linkage
    duplicateOf: { type: String, default: null }, // complaintId of the earlier similar complaint
    duplicateScore: { type: Number, default: 0 },

    resolvedAt: Date,
    closedAt: Date,

    timeline: [TimelineSchema],
  },
  { timestamps: true }
);

ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ bureau: 1, status: 1 });
ComplaintSchema.index({ institutionId: 1, status: 1 });
ComplaintSchema.index({ region: 1 });

export default mongoose.models.Complaint || mongoose.model('Complaint', ComplaintSchema);
