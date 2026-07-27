import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseEnv } from "@/lib/env";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

export const fullSchema = { ...schema, ...authSchema };

/**
 * One connection pool per server process, created on first use rather than at
 * import time — a module-level connection would make DATABASE_URL a build-time
 * requirement, and BUILD_PLAN.md §12 wants Phase 0 to build and deploy before the
 * database exists.
 *
 * `server-only` above is the guard that matters: it turns an accidental import
 * from a client component into a build error rather than a leaked connection
 * string.
 */
let client: ReturnType<typeof postgres> | null = null;
let instance: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;

export function getDb() {
  if (instance) return instance;

  const { DATABASE_URL } = getDatabaseEnv();
  client = postgres(DATABASE_URL, {
    // Serverless functions are short-lived and numerous; a large pool per
    // instance is how a Neon connection limit gets exhausted.
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  instance = drizzle(client, { schema: fullSchema });
  return instance;
}

export type Db = ReturnType<typeof getDb>;
export { schema, authSchema };
