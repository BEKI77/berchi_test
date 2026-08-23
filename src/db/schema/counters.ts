import { pgTable, varchar, integer } from "drizzle-orm/pg-core";

// Atomic sequence allocation for human-facing document numbers.
// One row per counter key, e.g. "order:20260823" or "invoice:20260823".
// Incremented via INSERT .. ON CONFLICT DO UPDATE .. RETURNING, which is a
// single statement and therefore safe under concurrency. The same construct
// works in SQLite 3.35+, so this survives the move to the local database.
export const documentCounters = pgTable("document_counters", {
  key: varchar("key", { length: 64 }).primaryKey(),
  lastSeq: integer("last_seq").default(0).notNull(),
});
