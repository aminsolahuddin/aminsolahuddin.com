import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { getPackBySlug } from "@/lib/queries/resource-pack";
import { platformLabel } from "@/lib/video-url";
import { isSupportedLang } from "@/lib/highlight";
import { CodeArtifact } from "@/components/code-artifact";
import { CopyButton } from "@/components/copy-button";
import { FallbackNotice } from "@/components/fallback-notice";
import {
  DisclosureBanner,
  shouldDisclose,
} from "@/components/disclosure-banner";
import { Prose } from "@/components/prose";
import { localeAlternates } from "@/lib/alternates";

/**
 * The page every short link lands on. BUILD_PLAN.md §12 makes "no dead ends" part
 * of the Phase 1 acceptance criterion, and this is the end of that chain.
 *
 * Rendered per request rather than at build time. A pack published from the admin
 * panel has to be visible the moment its URL is spoken aloud, and a statically
 * rendered page would serve the pre-publication 404 until the next deploy.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, slug } = await props.params;
  if (!hasLocale(routing.locales, locale)) return {};

  const pack = await getPackBySlug(slug, locale);
  if (!pack) return {};

  return {
    title: pack.title,
    description: pack.summary ?? undefined,
    alternates: localeAlternates(locale, `/resources/${slug}`),
  };
}

export default async function PackPage(props: Props) {
  const { locale, slug } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const pack = await getPackBySlug(slug, locale);
  if (!pack) notFound();

  const t = await getTranslations("resources");
  const tf = await getTranslations("fallbackNotice");
  const td = await getTranslations("disclosure");

  const code = pack.items.filter((i) => i.kind === "code");
  const commands = pack.items.filter((i) => i.kind === "command");
  const files = pack.items.filter((i) => i.kind === "file");
  const links = pack.items.filter((i) => i.kind === "link");

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  return (
    <>
      {/* Rule 5: above the fold, before anything a link could be clicked from. */}
      {shouldDisclose(pack.hasAffiliate, pack.items) ? (
        <DisclosureBanner body={td("affiliate")} action={td("readPolicy")} />
      ) : null}

      {!pack.translated ? (
        <FallbackNotice
          body={tf("body")}
          action={tf("action")}
          href={`/resources/${slug}`}
        />
      ) : null}

      <article className="mx-auto max-w-3xl px-lg py-xxl">
        <header>
          {pack.category ? (
            <p className="text-caption-strong text-ink-muted-80 mb-xs">
              {pack.category.name}
            </p>
          ) : null}

          <h1 className="text-display-lg font-display text-balance">
            {pack.title}
          </h1>

          {pack.summary ? (
            <p className="text-lead-airy text-ink-muted-80 mt-md text-pretty">
              {pack.summary}
            </p>
          ) : null}

          <div className="mt-lg flex flex-wrap items-center gap-x-lg gap-y-xs">
            {pack.video ? (
              <a
                href={pack.video.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body text-primary underline underline-offset-2"
              >
                {t("watchOn", { platform: platformLabel(pack.video.platform) })}
              </a>
            ) : null}

            {pack.repoUrl ? (
              <a
                href={pack.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body text-primary underline underline-offset-2"
              >
                {t("openRepo")}
              </a>
            ) : null}

            {pack.publishedAt ? (
              <time
                dateTime={pack.publishedAt.toISOString()}
                className="text-caption text-ink-muted-80"
              >
                {t("published", { date: dateFormat.format(pack.publishedAt) })}
              </time>
            ) : null}
          </div>
        </header>

        {code.length > 0 ? (
          <Section heading={t("codeHeading")}>
            {code.map((item) => (
              <figure key={item.id} className="mt-lg first:mt-0">
                <figcaption className="text-body-strong mb-xs">
                  {item.label}
                </figcaption>
                {item.note ? (
                  <p className="text-caption text-ink-muted-80 mb-sm">
                    {item.note}
                  </p>
                ) : null}
                {item.body ? (
                  <CodeArtifact
                    code={item.body}
                    lang={
                      item.lang && isSupportedLang(item.lang)
                        ? item.lang
                        : "text"
                    }
                    tone="light"
                  />
                ) : null}
              </figure>
            ))}
          </Section>
        ) : null}

        {commands.length > 0 ? (
          <Section heading={t("commandsHeading")}>
            {commands.map((item) => (
              <figure key={item.id} className="mt-lg first:mt-0">
                <figcaption className="mb-xs flex items-baseline justify-between gap-sm">
                  <span className="text-body-strong">{item.label}</span>
                  {item.body ? (
                    <CopyButton
                      value={item.body}
                      label={t("copyCommand")}
                      copiedLabel={t("copied")}
                    />
                  ) : null}
                </figcaption>
                {item.note ? (
                  <p className="text-caption text-ink-muted-80 mb-sm">
                    {item.note}
                  </p>
                ) : null}
                {item.body ? (
                  <CodeArtifact code={item.body} lang="bash" tone="light" />
                ) : null}
              </figure>
            ))}
          </Section>
        ) : null}

        {files.length > 0 ? (
          <Section heading={t("filesHeading")}>
            <ItemList items={files} />
          </Section>
        ) : null}

        {links.length > 0 ? (
          <Section heading={t("linksHeading")}>
            <ItemList items={links} />
          </Section>
        ) : null}

        {pack.notesMd ? (
          <Section heading={t("notesHeading")}>
            {/* Real Markdown now. Phase 1 rendered these as plain paragraphs and
                said why: half-rendering it, with bold working and links not,
                reads as a bug rather than as a limitation. Phase 3 brought the
                renderer, so the notes get it too — the column was always
                notes_md, and until now the "md" was a promise. */}
            <Prose source={pack.notesMd} />
          </Section>
        ) : null}
      </article>
    </>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-hairline mt-xxl border-t pt-xl">
      <h2 className="text-tagline font-display mb-lg">{heading}</h2>
      {children}
    </section>
  );
}

function ItemList({
  items,
}: {
  items: readonly {
    id: string;
    label: string;
    note: string | null;
    url: string | null;
    isAffiliate: boolean;
  }[];
}) {
  return (
    <ul className="divide-hairline border-hairline divide-y border-y">
      {items.map((item) => (
        <li key={item.id} className="py-sm">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              // Rule 5's companion: the disclosure explains the page, this marks
              // the individual link. Both are derived, neither is typed by hand.
              rel={
                item.isAffiliate
                  ? "sponsored noopener noreferrer"
                  : "noopener noreferrer"
              }
              className="text-body text-primary underline underline-offset-2"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-body">{item.label}</span>
          )}
          {item.note ? (
            <p className="text-caption text-ink-muted-80 mt-xxs">{item.note}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
