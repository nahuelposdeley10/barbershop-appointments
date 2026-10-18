import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

if (!MONGODB_URI) {
  throw new Error(
    "Falta la variable de entorno MONGODB_URI (configurá .env.local)"
  );
}

declare global {
  var mongooseCache:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

// Global cache to avoid reconnecting on hot-reload / serverless
globalThis.mongooseCache = globalThis.mongooseCache || {
  conn: null,
  promise: null,
};

export async function connectDB(): Promise<typeof mongoose> {
  if (globalThis.mongooseCache!.conn) {
    return globalThis.mongooseCache!.conn;
  }
  if (!globalThis.mongooseCache!.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    };
    globalThis.mongooseCache!.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((m) => m)
      .catch((err) => {
        globalThis.mongooseCache!.promise = null;
        throw err;
      });
  }
  globalThis.mongooseCache!.conn = await globalThis.mongooseCache!.promise;
  return globalThis.mongooseCache!.conn;
}
