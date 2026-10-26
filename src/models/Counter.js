import mongoose from 'mongoose';

// Atomic sequence generator used for human-friendly complaint IDs (NS-2026-000123).
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export default mongoose.models.Counter || mongoose.model('Counter', CounterSchema);
