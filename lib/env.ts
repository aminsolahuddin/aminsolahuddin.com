import { z } from "zod";

/**
 * CLAUDE.md rule 7 and 8: validate at the edge, nothing hardcoded.
 *
 * Validation is lazy and per-group rather than one eager check of every variable.
 * An eager module-level parse would mean a missing RESEND_API_KEY — a Phase 3
 * concern — breaks a Phase 0 build, and the phases in BUILD_PLAN.md §12 are
 * explicitly meant to ship one at a time. So each group is only checked at the
 * moment something actually needs it, and the error names the variable.
 */

function fail(group: string, error: z.ZodError): never {
  const missing = error.issues
    .map((issue) => issue.path.join("."))
    .filter(Boolean)
    .join(", ");
  throw new Error(
    `Missing or invalid ${group} environment variables: ${missing}. ` +
      `See .env.example.`,
  );
}

const databaseSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

const authSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  ADMIN_GITHUB_LOGIN: z.string().min(1),
});

let databaseEnv: z.infer<typeof databaseSchema> | null = null;
let authEnv: z.infer<typeof authSchema> | null = null;

export function getDatabaseEnv() {
  if (databaseEnv) return databaseEnv;
  const parsed = databaseSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
  });
  if (!parsed.success) fail("database", parsed.error);
  databaseEnv = parsed.data;
  return databaseEnv;
}

export function getAuthEnv() {
  if (authEnv) return authEnv;
  const parsed = authSchema.safeParse({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    ADMIN_GITHUB_LOGIN: process.env.ADMIN_GITHUB_LOGIN,
  });
  if (!parsed.success) fail("auth", parsed.error);
  authEnv = parsed.data;
  return authEnv;
}

/**
 * Public origin. Falls back to the Vercel-provided URL on preview deploys so a
 * branch preview still produces correct canonical and OG URLs, then to localhost
 * so `pnpm dev` works with no .env at all.
 */
export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ??
    "http://localhost:3000"
  );
}
