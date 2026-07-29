/**
 * The locale list, with no dependencies on purpose.
 *
 * It used to live only in i18n/routing.ts, which is the natural home for it
 * right up until something outside next-intl needs it. Validation schemas do —
 * and importing routing.ts into a schema drags next-intl into the unit tests,
 * where Node's test runner resolves specifiers literally and the whole chain
 * falls over for no useful reason.
 *
 * So the values sit here, importable by anything, and routing.ts consumes them
 * rather than declaring them. There is still exactly one place to add a fourth
 * language.
 */
export const LOCALES = ["en", "ms", "zh-Hans"] as const;

export type Locale = (typeof LOCALES)[number];

/** The language every other one falls back to. BUILD_PLAN.md §4. */
export const DEFAULT_LOCALE: Locale = "en";
