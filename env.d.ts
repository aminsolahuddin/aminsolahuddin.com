/**
 * Typing process.env explicitly is what lets the rest of the codebase use dot
 * access under `noPropertyAccessFromIndexSignature`, and it keeps Next's
 * NEXT_PUBLIC_* inlining working — that inlining only fires on a literal member
 * expression, so bracket access would be the wrong workaround here.
 *
 * Every key below must also appear in .env.example with a comment.
 * BUILD_PLAN.md §14: nothing hardcoded.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: "development" | "production" | "test";

    // Database
    readonly DATABASE_URL?: string;

    // Auth
    readonly BETTER_AUTH_SECRET?: string;
    readonly BETTER_AUTH_URL?: string;
    readonly GITHUB_CLIENT_ID?: string;
    readonly GITHUB_CLIENT_SECRET?: string;
    /** The single GitHub login allowed into /admin. Everything else is rejected. */
    readonly ADMIN_GITHUB_LOGIN?: string;

    // Jobs
    readonly GITHUB_SYNC_TOKEN?: string;
    readonly CRON_SECRET?: string;

    // Media
    readonly R2_ACCOUNT_ID?: string;
    readonly R2_ACCESS_KEY_ID?: string;
    readonly R2_SECRET_ACCESS_KEY?: string;
    readonly R2_BUCKET?: string;
    readonly R2_PUBLIC_URL?: string;

    // Email — Phase 3, unused until then
    readonly RESEND_API_KEY?: string;

    // Public
    readonly NEXT_PUBLIC_SITE_URL?: string;
    readonly NEXT_PUBLIC_ANALYTICS_URL?: string;

    // Injected by Vercel, not set by hand. Used only as a fallback origin so
    // branch previews still emit correct canonical and OG URLs.
    readonly VERCEL_PROJECT_PRODUCTION_URL?: string;
  }
}
