import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __vendraSql: ReturnType<typeof postgres> | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// Reuse the connection across hot reloads / serverless invocations.
const sql =
  global.__vendraSql ??
  postgres(connectionString, {
    max: 5,
    ssl: connectionString.includes("sslmode=require") ? "require" : undefined,
    // Neon's pooled (-pooler) endpoint runs PgBouncer in transaction mode,
    // which does not support server-side prepared statements across
    // different underlying connections - leaving this on causes silent
    // per-query overhead (and can error) against that endpoint.
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  global.__vendraSql = sql;
}

export const db = drizzle(sql, { schema });
export { sql };
