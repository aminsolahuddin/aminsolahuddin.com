import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { getPost } from "@/lib/queries/post";
import { getSiteUrl } from "@/lib/env";
import { FallbackNotice } from "@/components/fallback-notice";
import { DisclosureBanner } from "@/components/disclosure-banner";
import { Prose } from "@/components/prose";
import { JsonLd, articleSchema } from "@/components/json-ld";
import { localeAlternates } from "@/lib/alternates";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, slug } = await props.params;
  if (!hasLocale(routing.locales, locale)) return {};

  const post = await getPost(slug, locale);
  if (!post) return {};

  const path = `/writing/${slug}`;

  return {
    title: post.title,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    alternates: localeAlternates(locale, path),
    openGraph: {
      type: "article",
      title: post.title,
      ...(post.excerpt ? { description: post.excerpt } : {}),
      ...(post.publishedAt
        ? { publishedTime: post.publishedAt.toISOString() }
        : {}),
      modifiedTime: post.updatedAt.toISOString(),
    },
  };
}

export default async function PostPage(props: Props) {
  const { locale, slug } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const post = await getPost(slug, locale);
  if (!post) notFound();

  const t = await getTranslations("writing");
  const tf = await getTranslations("fallbackNotice");
  const td = await getTranslations("disclosure");

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  return (
    <>
      {/* Rule 5: automatic, above the fold, before anything a link could be
          clicked from. A post has no item rows to infer from, so the column is
          the only signal — which is why the admin form asks for it directly. */}
      {post.hasAffiliate ? (
        <DisclosureBanner body={td("affiliate")} action={td("readPolicy")} />
      ) : null}

      {!post.translated ? (
        <FallbackNotice
          body={tf("body")}
          action={tf("action")}
          href={`/writing/${slug}`}
        />
      ) : null}

      <article className="mx-auto max-w-3xl px-lg py-xxl">
        <header>
          <h1 className="text-display-lg font-display text-balance">
            {post.title}
          </h1>

          {post.excerpt ? (
            <p className="text-lead-airy text-ink-muted-80 mt-md text-pretty">
              {post.excerpt}
            </p>
          ) : null}

          <p className="mt-lg flex flex-wrap items-baseline gap-x-lg gap-y-xxs">
            {post.publishedAt ? (
              <time
                dateTime={post.publishedAt.toISOString()}
                className="text-caption text-ink-muted-80 tabular-nums"
              >
                {t("published", { date: dateFormat.format(post.publishedAt) })}
              </time>
            ) : null}

            {/* Shown only when it says something the published date does not.
                "Updated" on the same day as publication is noise. */}
            {post.publishedAt &&
            post.updatedAt.getTime() - post.publishedAt.getTime() > 86_400_000 ? (
              <time
                dateTime={post.updatedAt.toISOString()}
                className="text-caption text-ink-muted-80 tabular-nums"
              >
                {t("updated", { date: dateFormat.format(post.updatedAt) })}
              </time>
            ) : null}
          </p>
        </header>

        <div className="border-hairline mt-xl border-t pt-xl">
          <Prose source={post.bodyMd} />
        </div>
      </article>

      {/* §9: Article on posts. */}
      <JsonLd
        schema={articleSchema({
          title: post.title,
          description: post.excerpt,
          url: `${getSiteUrl()}/${locale}/writing/${slug}`,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          locale,
        })}
      />
    </>
  );
}
