import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { listTools } from "@/lib/queries/tool";
import { ExternalButtonLink } from "@/components/button";
import { DisclosureBanner, shouldDisclose } from "@/components/disclosure-banner";
import { FallbackNotice } from "@/components/fallback-notice";
import { localeAlternates } from "@/lib/alternates";

/**
 * BUILD_PLAN.md §12, Phase 4: "/tools page, tool model, automatic disclosure
 * banner, rel='sponsored'".
 *
 * The header and footer have linked here since Phase 0, so until this file
 * existed every page on the site carried two links to a 404.
 *
 * Neither the banner nor the rel attribute is decided here. `shouldDisclose`
 * reads the answer off the rows and `ExternalButtonLink` sets the attribute from
 * the same flag — CLAUDE.md rule 5 is written that way because a disclosure that
 * depends on remembering is missing exactly where it was forgotten.
 *
 * No search box and no category filter, unlike /repos. This is a page you read
 * top to bottom: a dozen entries, grouped, ordered by hand. A filter over twelve
 * rows is furniture.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "tools" });

  return {
    title: t("indexTitle"),
    description: t("indexLead"),
    alternates: localeAlternates(locale, "/tools"),
  };
}

export default async function ToolsIndex(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("tools");
  const td = await getTranslations("disclosure");
  const tf = await getTranslations("fallbackNotice");
  const th = await getTranslations("linkHealth");

  const groups = await listTools(locale);
  const tools = groups.flatMap((group) => group.tools);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <>
      {/* Rule 5, above the fold and above anything clickable. The first argument
          is false because a tool page has no flag of its own to trust — the rows
          are the whole answer. */}
      {shouldDisclose(false, tools) ? (
        <DisclosureBanner body={td("affiliate")} action={td("readPolicy")} />
      ) : null}

      {tools.some((tool) => !tool.translated) ? (
        <FallbackNotice body={tf("listBody")} action={tf("action")} href="/tools" />
      ) : null}

      <div className="mx-auto max-w-3xl px-lg py-xxl">
        <header>
          <h1 className="text-display-lg font-display text-balance">
            {t("indexTitle")}
          </h1>
          <p className="text-lead-airy text-ink-muted-80 mt-md text-pretty">
            {t("indexLead")}
          </p>
        </header>

        {tools.length === 0 ? (
          <p className="text-body text-ink-muted-80 mt-xl">{t("empty")}</p>
        ) : (
          groups.map((group) => (
            <section key={group.key ?? "uncategorised"} className="mt-xxl">
              {/* Uncategorised tools trail the page with no heading. An "Other"
                  label would be a word nobody chose and no translator has seen. */}
              {group.name ? (
                <h2 className="text-caption-strong text-ink-muted-80">
                  {group.name}
                </h2>
              ) : null}

              <ul className="divide-hairline border-hairline mt-sm divide-y border-t">
                {group.tools.map((tool) => (
                  <li key={tool.id} className="py-lg">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xxs">
                      <h3 className="text-tagline font-display">
                        {/* Product and vendor names are never translated, and
                            structurally cannot be: neither column is on the
                            i18n table. */}
                        {tool.name}
                        {tool.vendor ? (
                          <span className="text-caption text-ink-muted-80 ml-xs">
                            {t("vendor", { vendor: tool.vendor })}
                          </span>
                        ) : null}
                      </h3>

                      {/* §3: personally_used = false must render a visible
                          marker. Not a footnote — beside the name, where it is
                          read before the reasons to click. */}
                      {!tool.personallyUsed ? (
                        <span className="border-hairline text-caption text-ink-muted-80 rounded-pill border px-xs py-xxs">
                          {t("notUsed")}
                        </span>
                      ) : null}
                    </div>

                    <section className="mt-sm">
                      <h4 className="text-caption-strong text-ink-muted-80">
                        {t("why")}
                      </h4>
                      <p className="text-body mt-xxs text-pretty">
                        {tool.whyIUseIt}
                      </p>
                    </section>

                    {tool.caveat ? (
                      <section className="mt-sm">
                        <h4 className="text-caption-strong text-ink-muted-80">
                          {t("caveat")}
                        </h4>
                        <p className="text-body mt-xxs text-pretty">
                          {tool.caveat}
                        </p>
                      </section>
                    ) : null}

                    {!tool.personallyUsed ? (
                      <p className="text-caption text-ink-muted-80 mt-sm">
                        {t("notUsedNote")}
                      </p>
                    ) : null}

                    {/* §8: a suspect link is marked, not hidden. */}
                    {tool.linkSuspect ? (
                      <p className="text-caption text-ink-muted-80 mt-sm">
                        {th("warning", {
                          date: tool.lastCheckedAt
                            ? dateFormat.format(tool.lastCheckedAt)
                            : "—",
                        })}
                      </p>
                    ) : null}

                    <p className="mt-md">
                      <ExternalButtonLink
                        variant="ghost"
                        href={tool.href}
                        isAffiliate={tool.isAffiliate}
                      >
                        {t("open", { name: tool.name })}
                      </ExternalButtonLink>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {tools.some((tool) => tool.isAffiliate) ? (
          <p className="text-caption text-ink-muted-80 border-hairline mt-xxl border-t pt-lg">
            {t("affiliateNote")}
          </p>
        ) : null}
      </div>
    </>
  );
}
