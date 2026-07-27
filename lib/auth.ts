import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { getDb, fullSchema } from "@/db";
import { getAuthEnv } from "./env";

/**
 * BUILD_PLAN.md §6: one user, GitHub OAuth, no passwords, no reset flow, no user
 * table to breach.
 *
 * The allowlist is enforced in two places on purpose:
 *
 *   1. Here, at account creation, so a stranger's GitHub account never becomes a
 *      row in the first place.
 *   2. Again in requireAdmin(), on every single admin request.
 *
 * The second is the one that actually protects the panel. A check that runs only
 * at signup is a check that stops working the moment ADMIN_GITHUB_LOGIN changes,
 * or the moment a row is inserted by any other path.
 */

function createAuth() {
  const env = getAuthEnv();
  const allowedLogin = env.ADMIN_GITHUB_LOGIN.toLowerCase();

  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema: fullSchema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    user: {
      additionalFields: {
        githubLogin: { type: "string", required: false, input: false },
      },
    },

    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        mapProfileToUser: (profile) => ({ githubLogin: profile.login }),
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (candidate) => {
            const login = (
              candidate as { githubLogin?: string | null }
            ).githubLogin?.toLowerCase();

            if (login !== allowedLogin) {
              throw new APIError("FORBIDDEN", {
                message: "This GitHub account is not permitted to sign in.",
              });
            }
            return { data: candidate };
          },
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },

    advanced: {
      // The panel is not linked from anywhere public; cookies should not travel
      // to third-party contexts either.
      defaultCookieAttributes: { sameSite: "lax", secure: true },
    },
  });
}

/**
 * Built on first use, then reused. Deriving the type from createAuth rather than
 * annotating it keeps Better Auth's inferred shape — including the githubLogin
 * additional field — instead of widening to the generic Auth type, which is what
 * would erase that field at every call site.
 */
type AuthInstance = ReturnType<typeof createAuth>;

let cached: AuthInstance | null = null;

export function getAuth(): AuthInstance {
  cached ??= createAuth();
  return cached;
}
