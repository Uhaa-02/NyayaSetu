import mongoose from 'mongoose';
import { withDnsFallback } from './dnsFix.js';

// Cache the connection on globalThis so Next.js hot-reload and serverless invocations
// re-use one connection instead of opening a new one per request.
const g = globalThis;
const cached = g.__nyayasetuMongoose || (g.__nyayasetuMongoose = { conn: null, promise: null });

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy .env.example to .env.local and paste your MongoDB Atlas connection string.'
    );
  }
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

  if (!cached.promise) {
    cached.promise = withDnsFallback(() =>
      mongoose.connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 10,
      })
    ).then((m) => m);
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}
