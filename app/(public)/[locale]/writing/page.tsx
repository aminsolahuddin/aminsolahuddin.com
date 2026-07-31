import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { listPosts } from "@/lib/queries/post";
import { FallbackNotice } from "@/components/fallback-notice";
import { localeAlternates } from "@/lib/alternates";

/**
 * BUILD_PLAN.md §12, Phase 3. The nav has linked here since Phase 0, so until
 * now "Writing" was a 404 in the header of every page on the site.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "writing" });

  return {
    title: t("indexTitle"),
    description: t("indexLead"),
    alternates: localeAlternates(locale, "/writing"),
  };
}

export default async function WritingIndex(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("writing");
  const tf = await getTranslations("fallbackNotice");

  const posts = await listPosts(locale);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  // One notice for the list rather than one per row, same as the repo index.
  const anyFallback = posts.some((p) => !p.translated);

  return (
    <>
      {anyFallback ? (
        <FallbackNotice
          body={tf("listBody")}
          action={tf("action")}
          href="/writing"
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

        {posts.length === 0 ? (
          <p className="text-body text-ink-muted-80 mt-xxl">{t("empty")}</p>
        ) : (
          <ul className="divide-hairline border-hairline mt-xl divide-y border-t">
            {posts.map((post) => (
              <li key={post.slug} className="py-lg">
                <Link
                  href={`/writing/${post.slug}`}
                  className="text-tagline font-display text-primary underline-offset-4 hover:underline"
                >
                  {post.title}
                </Link>

                {post.excerpt ? (
                  <p className="text-body text-ink-muted-80 mt-xs text-pretty">
                    {post.excerpt}
                  </p>
                ) : null}

                {post.publishedAt ? (
                  <p className="mt-sm">
                    <time
                      dateTime={post.publishedAt.toISOString()}
                      className="text-caption text-ink-muted-80 tabular-nums"
                    >
                      {dateFormat.format(post.publishedAt)}
                    </time>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
