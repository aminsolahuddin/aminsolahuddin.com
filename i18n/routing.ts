import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/locales";

/**
 * BUILD_PLAN.md §4. English is the base; ms and zh-Hans fall back to it rather
 * than to a machine translation or a broken page.
 *
 * The list itself lives in lib/locales.ts so that validation schemas can read it
 * without importing next-intl. See the comment there.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,

  // Every route is prefixed (/en/..., /ms/..., /zh-Hans/...) per CLAUDE.md.
  localePrefix: "always",

  // Cookie first, then Accept-Language, then `en`. next-intl writes the cookie
  // when a reader picks manually, which is what stops a header guess from
  // overriding a deliberate choice on the next request.
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

/**
 * Segments that can never be a locale or a content slug. BUILD_PLAN.md §2 requires
 * these reserved so no slug can ever collide with a system route.
 */
export const RESERVED_SEGMENTS = ["r", "admin", "api", "_next", "_vercel"] as const;

export function isReservedSegment(segment: string): boolean {
  return (RESERVED_SEGMENTS as readonly string[]).includes(segment);
}
