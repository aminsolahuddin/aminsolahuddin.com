import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import {
  listTranslationGaps,
  TRANSLATABLE_LOCALES,
} from "@/lib/queries/translations";
import { coverage, type Messages } from "@/lib/translation-coverage";
import en from "@/messages/en.json";
import ms from "@/messages/ms.json";
import zhHans from "@/messages/zh-Hans.json";

export const dynamic = "force-dynamic";

/**
 * BUILD_PLAN.md §4: "The admin dashboard shows, per content type, how many
 * entries are missing ms and zh-Hans. Without this the backlog becomes invisible
 * and the feature quietly dies."
 *
 * Two backlogs, and the order matters. UI chrome comes first because it is on
 * every page — a reader in Malay meets the navigation, the buttons and the empty
 * states before they meet any content, and no amount of translated prose fixes a
 * page whose furniture is still English. Content comes second, per type, with
 * every entry named and linked.
 *
 * Nothing here is a number on its own, for the reason the rot dashboard gives:
 * a count with no route to action is a count that gets read once and ignored.
 */
const MESSAGES: Record<string, Messages> = {
  ms: ms as Messages,
  "zh-Hans": zhHans as Messages,
};

export default async function TranslationsPage() {
  await requireAdmin();

  const gaps = await listTranslationGaps();
  const number = new Intl.NumberFormat("en");

  const chrome = TRANSLATABLE_LOCALES.map((locale) => ({
    locale,
    ...coverage(en as Messages, MESSAGES[locale] ?? {}),
  }));

  const contentTotals = TRANSLATABLE_LOCALES.map((locale) => ({
    locale,
    missing: gaps.reduce((sum, gap) => sum + (gap.missingCount[locale] ?? 0), 0),
    total: gaps.reduce((sum, gap) => sum + gap.total, 0),
  }));

  const nothingLeft =
    chrome.every((c) => c.missing.length === 0) &&
    contentTotals.every((c) => c.missing === 0);

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <p className="text-caption text-ink-muted-80">
        <Link href="/admin" className="text-primary underline underline-offset-2">
          Admin
        </Link>
      </p>
      <h1 className="text-display-md font-display mt-xxs">Translations</h1>
      <p className="text-body text-ink-muted-80 mt-xs text-pretty">
        What is still English. Anything missing falls back to English with a
        notice on the page, so nothing here is broken — it is unwritten.
      </p>

      {nothingLeft ? (
        <p role="status" className="text-body mt-xl">
          Nothing missing in {TRANSLATABLE_LOCALES.join(" or ")}.
        </p>
      ) : null}

      <section className="mt-xxl">
        <h2 className="text-tagline font-display">Interface</h2>
        <p className="text-caption text-ink-muted-80 mt-xxs text-pretty">
          Navigation, buttons, form labels, empty states, error messages. On every
          page, in front of everything else.
        </p>

        <ul className="divide-hairline border-hairline mt-md divide-y border-y">
          {chrome.map((row) => (
            <li key={row.locale} className="py-md">
              <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xxs">
                <span className="text-body-strong">{row.locale}</span>
                <span className="text-body tabular-nums">
                  {number.format(row.translated)} / {number.format(row.total)}
                </span>
              </div>

              {row.missing.length === 0 ? (
                <p className="text-caption text-ink-muted-80 mt-xxs">Complete.</p>
              ) : (
                <p className="text-caption text-ink-muted-80 mt-xxs text-pretty">
                  {number.format(row.missing.length)} keys to write in{" "}
                  <span className="font-mono">messages/{row.locale}.json</span>.
                  {row.untouchedNamespaces.length > 0 ? (
                    <>
                      {" "}
                      Untouched:{" "}
                      <span className="font-mono">
                        {row.untouchedNamespaces.join(", ")}
                      </span>
                      .
                    </>
                  ) : null}
                </p>
              )}
            </li>
          ))}
        </ul>

        <p className="text-caption text-ink-muted-80 mt-sm text-pretty">
          CLAUDE.md makes user-facing {TRANSLATABLE_LOCALES.join(" and ")} copy a
          stop-and-ask, so these files stay empty until Amin writes them. Nothing
          here is machine translated, and nothing here should be.
        </p>
      </section>

      <section className="mt-xxl">
        <h2 className="text-tagline font-display">Content</h2>
        <p className="text-caption text-ink-muted-80 mt-xxs text-pretty">
          Entries whose prose has no row in a language, or a row missing the one
          field a reader cannot do without. English is the base and never counts
          as missing.
        </p>

        <ul className="divide-hairline border-hairline mt-md divide-y border-y">
          {gaps.map((gap) => (
            <li key={gap.key} className="py-md">
              <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xxs">
                <span className="text-body-strong">{gap.label}</span>
                <span className="text-caption text-ink-muted-80 tabular-nums">
                  {gap.total === 0
                    ? "nothing to translate yet"
                    : TRANSLATABLE_LOCALES.map(
                        (locale) =>
                          `${locale} ${number.format(gap.missingCount[locale] ?? 0)}/${number.format(gap.total)}`,
                      ).join(" · ")}
                </span>
              </div>

              <p className="text-caption text-ink-muted-80 mt-xxs">
                Counted as translated once <em>{gap.gatedOn}</em> is written.
              </p>

              {gap.rows.length > 0 ? (
                <ul className="mt-xs">
                  {gap.rows.map((row) => (
                    <li
                      key={row.id}
                      className="text-caption text-ink-muted-80 flex flex-wrap items-baseline gap-x-sm gap-y-xxs"
                    >
                      {row.adminHref ? (
                        <Link
                          href={row.adminHref}
                          className="text-primary font-mono underline underline-offset-2"
                        >
                          {row.label}
                        </Link>
                      ) : (
                        <span className="font-mono">{row.label}</span>
                      )}
                      <span>needs {row.missing.join(", ")}</span>
                      {/* §6 lists categories and media under CRUD and neither
                          exists yet. Saying so beats a dead-looking row. */}
                      {row.adminHref ? null : <span>— no editor for these yet</span>}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
