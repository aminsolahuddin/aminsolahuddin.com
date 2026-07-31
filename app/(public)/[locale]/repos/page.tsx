import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { listRepoCategories, listRepos } from "@/lib/queries/repo-entry";
import { RepoStatusBadge, StarCount } from "@/components/repo-status";
import { FallbackNotice } from "@/components/fallback-notice";
import { localeAlternates } from "@/lib/alternates";
import {
  FilterEmpty,
  FilterForm,
  FilterInput,
  FilterItem,
  LiveFilter,
} from "@/components/live-filter";

/**
 * BUILD_PLAN.md §12: public index with filter and search.
 *
 * Category is a link and search is a text box, and they are deliberately not the
 * same mechanism. Category is navigation — a few known destinations, each worth a
 * URL someone can link to. Search is exploration, and it filters rows already on
 * the page rather than asking the database on every keystroke; see the note in
 * components/live-filter.tsx for why that matters under load.
 *
 * Both still end up in the URL, and both still work with JavaScript switched off.
 */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
};

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "repos" });

  return {
    title: t("indexTitle"),
    description: t("indexLead"),
    alternates: localeAlternates(locale, "/repos"),
  };
}

export default async function ReposIndex(props: Props) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { category: selected, q } = await props.searchParams;
  const t = await getTranslations("repos");
  const tf = await getTranslations("fallbackNotice");

  const categories = await listRepoCategories(locale);
  const active = categories.some((c) => c.key === selected) ? selected : undefined;
  const search = q?.trim() ?? "";

  /**
   * Every entry in the category, not just the ones matching ?q=.
   *
   * The search filters in the browser, so the rows it filters have to be here.
   * Passing `search` down would hand the client a list the server had already
   * narrowed, and clearing the box would then be unable to widen it again.
   */
  const repos = await listRepos(locale, active ? { categoryKey: active } : {});

  /**
   * What each row is searched against. Built once here so the server's no-JS
   * filtering and the client's live filtering compare the same strings — two
   * definitions of "matches" would eventually disagree about something.
   *
   * Owner, name and the one-liner. Deliberately not the caveats: those contain
   * words like "deprecated" and "slow", and a search for "slow" surfacing every
   * repo that warns about slowness would bury the one that is about it.
   */
  const haystackFor = (repo: (typeof repos)[number]) =>
    `${repo.owner}/${repo.name} ${repo.oneLiner}`.toLowerCase();

  const haystacks = repos.map(haystackFor);

  /**
   * One notice for the whole list, not one per row.
   *
   * CLAUDE.md's language rules require that a missing translation row renders the
   * English text *and says so* — otherwise a reader who does not read English
   * well cannot tell whether the page is untranslated or whether they have
   * misread it. The entry pages already do this. This page was not, which meant a
   * zh-Hans reader saw ten English one-liners with no explanation for any of them.
   *
   * Per row it would be ten identical notices interleaved with the content, which
   * is how a notice becomes furniture nobody reads. One at the top, when any row
   * is falling back.
   */
  const anyFallback = repos.some((repo) => !repo.translated);

  /**
   * There is no second filter for the no-JavaScript path, and that is the point
   * of seeding LiveFilter with ?q=. FilterItem is a client component, but it
   * still renders on the server, where it reads that seed and emits `hidden` on
   * the rows that do not match. So the HTML that leaves the server is already
   * filtered — before hydration, and whether or not hydration ever happens.
   */
  return (
    <>
      {anyFallback ? (
        <FallbackNotice
          body={tf("listBody")}
          action={tf("action")}
          href="/repos"
        />
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

        <LiveFilter initialQuery={search}>
          {/* Still a GET form. With JavaScript it never submits; without, it is
              the whole search. The category rides along as a hidden field, or
              searching would silently drop the filter just applied. */}
          <FilterForm className="mt-xl flex flex-wrap items-center gap-xs">
            {active ? <input type="hidden" name="category" value={active} /> : null}
            <FilterInput
              id="repo-search"
              name="q"
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              className="border-hairline bg-canvas text-body rounded-pill h-search-input-height min-w-0 flex-1 border px-search-input-x"
            />
            <button
              type="submit"
              className="bg-ink text-on-dark text-button-utility rounded-pill px-button-primary-x py-button-primary-y transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100"
            >
              {t("searchLabel")}
            </button>
          </FilterForm>

          {categories.length > 0 ? (
            <nav aria-label={t("indexTitle")} className="mt-md flex flex-wrap gap-xs">
              <Chip href={buildHref(undefined, search)} active={!active}>
                {t("allCategories")}
              </Chip>
              {categories.map((c) => (
                <Chip
                  key={c.key}
                  href={buildHref(c.key, search)}
                  active={active === c.key}
                >
                  {c.name} <span className="tabular-nums">({c.count})</span>
                </Chip>
              ))}
            </nav>
          ) : null}

          {repos.length === 0 ? (
            <p className="text-body text-ink-muted-80 mt-xl">{t("empty")}</p>
          ) : (
            <>
              {/* Empty because nothing was typed that matches, which is a
                  different sentence from "nothing published here yet". */}
              <FilterEmpty
                haystacks={haystacks}
                className="text-body text-ink-muted-80 mt-xl"
              >
                {t("noMatch")}
              </FilterEmpty>

              <ul className="divide-hairline border-hairline mt-xl divide-y border-t">
                {repos.map((repo) => {
                  const haystack = haystackFor(repo);

                  return (
                    <FilterItem
                      key={`${repo.owner}/${repo.name}`}
                      haystack={haystack}
                      className="py-lg"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xxs">
                        <Link
                          href={`/repos/${repo.owner}/${repo.name}`}
                          className="text-tagline font-display text-primary underline-offset-4 hover:underline"
                        >
                          {/* Never translated, and structurally cannot be: owner
                              and name do not exist on the i18n table. */}
                          {repo.owner}/{repo.name}
                        </Link>

                        {repo.status !== "maintained" ? (
                          <RepoStatusBadge
                            status={repo.status}
                            label={t(`status.${repo.status}`)}
                          />
                        ) : null}
                      </div>

                      <p className="text-body text-ink-muted-80 mt-xs text-pretty">
                        {repo.oneLiner}
                      </p>

                      <p className="mt-sm flex flex-wrap items-baseline gap-x-md gap-y-xxs">
                        <StarCount
                          stars={repo.stars}
                          // The raw number. `#` in an ICU plural is the count put
                          // through the locale's number format, so pre-formatting
                          // it hands ICU a string and `#` renders NaN.
                          starsLabel={
                            repo.stars === null
                              ? ""
                              : t("stars", { count: repo.stars })
                          }
                          notSyncedLabel={t("notSynced")}
                        />
                        {repo.licenseSpdx ? (
                          <span className="text-caption text-ink-muted-80">
                            {/* SPDX identifiers are never translated. CLAUDE.md. */}
                            {t("license", { spdx: repo.licenseSpdx })}
                          </span>
                        ) : null}
                      </p>
                    </FilterItem>
                  );
                })}
              </ul>
            </>
          )}
        </LiveFilter>
      </div>
    </>
  );
}

function buildHref(category: string | undefined, search: string): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (search) params.set("q", search);
  const query = params.toString();
  return query ? `/repos?${query}` : "/repos";
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`text-button-utility rounded-pill px-configurator-option-chip-x py-configurator-option-chip-y transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100 ${
        active ? "bg-ink text-on-dark" : "border-hairline text-ink-muted-80 border"
      }`}
    >
      {children}
    </Link>
  );
}
