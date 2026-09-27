import "dotenv/config";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import path from "node:path";

// Runs drizzle/manual-constraints.sql against DATABASE_URL. Idempotent - see
// that file for why these constraints can't be expressed via drizzle-kit push.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const sql = postgres(connectionString, {
    max: 1,
    ssl: connectionString.includes("sslmode=require") ? "require" : undefined,
  });

  const filePath = path.join(process.cwd(), "drizzle", "manual-constraints.sql");
  const script = readFileSync(filePath, "utf-8");

  console.log("Applying manual structural constraints...");
  await sql.unsafe(script);
  console.log("Done.");

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
