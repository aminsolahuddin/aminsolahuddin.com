import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import en from "../messages/en.json";

type Messages = Record<string, unknown>;

/**
 * BUILD_PLAN.md §4: a missing translation falls back to English, never to a broken
 * page and never to a machine translation. Merging English underneath the active
 * locale means a half-translated file degrades key by key instead of collapsing the
 * whole page — which is what makes it safe to ship `ms` and `zh-Hans` before they
 * are complete.
 */
function mergeFallback(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = mergeFallback(existing, value);
    } else if (value !== undefined && value !== "") {
      out[key] = value;
    }
  }
  return out;
}

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages =
    locale === routing.defaultLocale
      ? (en as Messages)
      : mergeFallback(
          en as Messages,
          ((await import(`../messages/${locale}.json`)).default ?? {}) as Messages,
        );

  return {
    locale,
    messages,
    // BUILD_PLAN.md §4: number, date and list formatting via Intl, never hand-rolled.
    timeZone: "Asia/Kuala_Lumpur",
    formats: {
      dateTime: {
        long: { year: "numeric", month: "long", day: "numeric" },
        short: { year: "numeric", month: "short", day: "numeric" },
      },
      number: {
        compact: { notation: "compact", maximumFractionDigits: 1 },
      },
    },
  };
});
