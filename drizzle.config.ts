import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * `generate` diffs the schema files and never opens a connection, so it must
 * work with no DATABASE_URL — that is what lets the first migration be written
 * and reviewed before a database exists. `migrate` and `studio` do connect, and
 * they fail with drizzle-kit's own message naming the missing credential.
 */
const url = process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: ["./db/schema.ts", "./db/auth-schema.ts"],
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  // Migrations are reviewed and committed, never applied straight from a diff.
  verbose: true,
  strict: true,
});
