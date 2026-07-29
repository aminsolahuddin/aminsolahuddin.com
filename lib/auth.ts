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
        /**
         * `input: false` looks right here and is actively wrong. Better Auth
         * strips every `input: false` field out of the provider profile before
         * the user row is built — see parseAdditionalUserInputFromProviderProfile
         * in better-auth/dist/db/schema.mjs — so mapProfileToUser below would
         * populate this and it would be silently dropped on the way to the
         * database. The create hook would then compare `undefined` against the
         * allowlist and reject every sign-in, including the correct account,
         * with no error that names the cause.
         *
         * The property `input: false` was reaching for — that a client can never
         * set this field — is enforced by the update hook instead, which is the
         * only path that could otherwise reach it.
         */
        githubLogin: { type: "string", required: false },
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
              /**
               * The `code` is load-bearing. Better Auth's OAuth callback only
               * forwards an APIError's own code into the redirect; an error
               * without one is rethrown and surfaces as `?error=UNKNOWN`, which
               * is indistinguishable from a genuine internal fault. Naming it
               * costs nothing in disclosure — `access_denied` is ordinary OAuth
               * vocabulary and says nothing that reaching a login page did not
               * already say — and it is the difference between reading the
               * cause off the URL and going through the library source.
               */
              throw new APIError("FORBIDDEN", {
                code: "ACCESS_DENIED",
                message: "This GitHub account is not permitted to sign in.",
              });
            }
            return { data: candidate };
          },
        },
        update: {
          before: async (changes) => {
            /**
             * githubLogin is decided by GitHub and by nobody else. Better Auth's
             * update-user endpoint will happily write any additional field that
             * is not `input: false`, and this field cannot be `input: false`
             * without breaking sign-in entirely, so the door is closed here.
             *
             * Only the allowlisted account can hold a session at all, so this is
             * not blocking an outsider — it is stopping the one account that can
             * reach the endpoint from editing itself out of its own allowlist.
             */
            if ("githubLogin" in (changes as Record<string, unknown>)) {
              throw new APIError("FORBIDDEN", {
                code: "FIELD_NOT_EDITABLE",
                message: "githubLogin is set from the GitHub profile.",
              });
            }
            return { data: changes };
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
