import { db } from "@/db";

// Drizzle's transaction callback parameter type, extracted so it can be
// shared across workflow modules without re-deriving it everywhere.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
