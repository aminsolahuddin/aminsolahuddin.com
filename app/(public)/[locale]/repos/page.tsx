import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { listRepoCategories, listRepos } from "@/lib/queries/repo-entry";
import { RepoStatusBadge, StarCount } from "@/components/repo-status";

/**
 * BUILD_PLAN.md §12: public index with filter and search.
 *
 * Both are URL state, submitted by a plain form. That keeps a filtered search
 * linkable and working before JavaScript, and it means the page ships no
 * page-specific JS at all.
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
    alternates: {
      canonical: `/${locale}/repos`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}/repos`])),
        "x-default": `/${routing.defaultLocale}/repos`,
      },
    },
  };
}

export default async function ReposIndex(props: Props) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { category: selected, q } = await props.searchParams;
  const t = await getTranslations("repos");

  const categories = await listRepoCategories(locale);
  const active = categories.some((c) => c.key === selected) ? selected : undefined;
  const search = q?.trim() ?? "";

  const repos = await listRepos(locale, {
    ...(active ? { categoryKey: active } : {}),
    ...(search ? { search } : {}),
  });

  const number = new Intl.NumberFormat(locale);

  return (
    <div className="mx-auto max-w-3xl px-lg py-xxl">
      <header>
        <h1 className="text-display-lg font-display text-balance">
          {t("indexTitle")}
        </h1>
        <p className="text-lead-airy text-ink-muted-80 mt-md text-pretty">
          {t("indexLead")}
        </p>
      </header>

      {/* A GET form, so the query lands in the URL and the result can be sent
          to someone. The category rides along as a hidden field, or searching
          would silently drop the filter the reader just applied. */}
      <form method="get" className="mt-xl flex flex-wrap items-center gap-xs">
        {active ? <input type="hidden" name="category" value={active} /> : null}
        <label className="sr-only" htmlFor="repo-search">
          {t("searchLabel")}
        </label>
        <input
          id="repo-search"
          type="search"
          name="q"
          defaultValue={search}
          placeholder={t("searchPlaceholder")}
          className="border-hairline bg-canvas text-body rounded-pill h-search-input-height min-w-0 flex-1 border px-search-input-x"
        />
        <button
          type="submit"
          className="bg-ink text-on-dark text-button-utility rounded-pill px-button-primary-x py-button-primary-y transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100"
        >
          {t("searchLabel")}
        </button>
      </form>

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
        <p className="text-body text-ink-muted-80 mt-xl">
          {search ? t("noMatch") : t("empty")}
        </p>
      ) : (
        <ul className="divide-hairline border-hairline mt-xl divide-y border-t">
          {repos.map((repo) => (
            <li key={`${repo.owner}/${repo.name}`} className="py-lg">
              <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xxs">
                <Link
                  href={`/repos/${repo.owner}/${repo.name}`}
                  className="text-tagline font-display text-primary underline-offset-4 hover:underline"
                >
                  {/* Never translated, and structurally cannot be: owner and
                      name do not exist on the i18n table. */}
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
                  starsLabel={
                    repo.stars === null
                      ? ""
                      : t("stars", { count: number.format(repo.stars) })
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
            </li>
          ))}
        </ul>
      )}
    </div>
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
