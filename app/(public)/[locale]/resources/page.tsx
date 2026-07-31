import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { listCategories, listPacks } from "@/lib/queries/resource-pack";
import { localeAlternates } from "@/lib/alternates";

/**
 * BUILD_PLAN.md §2 and §12: the index of packs, filterable by category.
 *
 * The filter is a set of links, not a control. That is deliberate — it works
 * before JavaScript loads, it can be sent to someone, and the back button
 * behaves the way a reader expects. CLAUDE.md rule 6 asks for a client component
 * only where there is real interactivity, and choosing between four links is not
 * that.
 */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
};

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "resources" });

  return {
    title: t("indexTitle"),
    description: t("indexLead"),
    alternates: localeAlternates(locale, "/resources"),
  };
}

export default async function ResourcesIndex(props: Props) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { category: selected } = await props.searchParams;
  const t = await getTranslations("resources");

  const [categories, packs] = await Promise.all([
    listCategories(locale),
    listPacks(locale, selected),
  ]);

  /**
   * An unknown ?category= is treated as no filter rather than as an error. The
   * value comes from a URL someone may have edited or a category that has since
   * been emptied, and showing the full list is a better answer to both than a
   * 404 on a page that plainly exists.
   */
  const active = categories.some((c) => c.key === selected) ? selected : undefined;

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

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

      {categories.length > 0 ? (
        <nav aria-label={t("indexTitle")} className="mt-xl flex flex-wrap gap-xs">
          <FilterChip href="/resources" active={!active}>
            {t("allCategories")}
          </FilterChip>
          {categories.map((c) => (
            <FilterChip
              key={c.key}
              href={`/resources?category=${encodeURIComponent(c.key)}`}
              active={active === c.key}
            >
              {c.name} <span className="tabular-nums">({c.count})</span>
            </FilterChip>
          ))}
        </nav>
      ) : null}

      {packs.length === 0 ? (
        <p className="text-body text-ink-muted-80 mt-xl">
          {active ? t("emptyInCategory") : t("empty")}
        </p>
      ) : (
        <ul className="divide-hairline border-hairline mt-xl divide-y border-t">
          {packs.map((pack) => (
            <li key={pack.slug}>
              <Link
                href={`/resources/${pack.slug}`}
                className="group block py-lg"
              >
                <h2 className="text-tagline font-display text-primary underline-offset-4 group-hover:underline">
                  {pack.title}
                </h2>

                {pack.summary ? (
                  <p className="text-body text-ink-muted-80 mt-xs text-pretty">
                    {pack.summary}
                  </p>
                ) : null}

                <p className="text-caption text-ink-muted-80 mt-sm flex flex-wrap items-baseline gap-x-md gap-y-xxs">
                  <span className="tabular-nums">
                    {t("itemCount", { count: pack.itemCount })}
                  </span>
                  {pack.publishedAt ? (
                    <time
                      dateTime={pack.publishedAt.toISOString()}
                      className="tabular-nums"
                    >
                      {dateFormat.format(pack.publishedAt)}
                    </time>
                  ) : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  /**
   * aria-current is what tells a screen reader which filter is applied. Without
   * it the selected state is carried by colour alone, which §15 does not accept
   * as the only signal.
   */
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`text-button-utility rounded-pill px-configurator-option-chip-x py-configurator-option-chip-y transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100 ${
        active
          ? "bg-ink text-on-dark"
          : "border-hairline text-ink-muted-80 border"
      }`}
    >
      {children}
    </Link>
  );
}
