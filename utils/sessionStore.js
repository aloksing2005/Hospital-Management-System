const session = require("express-session");
const MongoStore = require("connect-mongo").default;

/**
 * Session store: Mongo when URI is set, otherwise in-memory (dev-friendly).
 */
function createSessionStore() {
  const mongoUrl =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/hospital_db";

  if (
    process.env.USE_MEMORY_SESSION === "1" ||
    process.env.NODE_ENV !== "production"
  ) {
    console.warn("⚠️  Sessions: MemoryStore (reliable local login — set NODE_ENV=production + Mongo for prod)");
    return new session.MemoryStore();
  }

  try {
    return MongoStore.create({
      mongoUrl,
      ttl: 24 * 60 * 60,
      autoRemove: "native",
      touchAfter: 24 * 3600
    });
  } catch (err) {
    console.warn("⚠️  Sessions: MemoryStore fallback —", err.message);
    return new session.MemoryStore();
  }
}

module.exports = { createSessionStore };
