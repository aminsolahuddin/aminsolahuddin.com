import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { getRepo } from "@/lib/queries/repo-entry";
import { FallbackNotice } from "@/components/fallback-notice";
import { RepoStatusBadge } from "@/components/repo-status";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; owner: string; name: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, owner, name } = await props.params;
  if (!hasLocale(routing.locales, locale)) return {};

  const repo = await getRepo(owner, name, locale);
  if (!repo) return {};

  const path = `/repos/${owner}/${name}`;

  return {
    // The repo name is the title, untranslated in every locale.
    title: `${repo.owner}/${repo.name}`,
    description: repo.oneLiner,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}${path}`])),
        "x-default": `/${routing.defaultLocale}${path}`,
      },
    },
  };
}

export default async function RepoPage(props: Props) {
  const { locale, owner, name } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const repo = await getRepo(owner, name, locale);
  if (!repo) notFound();

  const t = await getTranslations("repos");
  const tf = await getTranslations("fallbackNotice");
  const th = await getTranslations("linkHealth");

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

  /**
   * The four fields §3 calls the whole value of this section. Rendered in this
   * order on purpose: what it is for, then who should walk away, then what it
   * replaces, then what it costs you. A reader deciding against something should
   * reach that conclusion before the enthusiasm, not after it.
   */
  const sections = [
    { key: "forWhom", value: repo.forWhom },
    { key: "notForYouIf", value: repo.notForYouIf },
    { key: "replaces", value: repo.replaces },
    { key: "theCatch", value: repo.theCatch },
  ] as const;

  return (
    <>
      {!repo.translated ? (
        <FallbackNotice
          body={tf("body")}
          action={tf("action")}
          href={`/repos/${owner}/${name}`}
        />
      ) : null}

      <article className="mx-auto max-w-3xl px-lg py-xxl">
        <header>
          <div className="flex flex-wrap items-baseline gap-md">
            <h1 className="text-display-lg font-display">
              {repo.owner}/{repo.name}
            </h1>
            {repo.status !== "maintained" ? (
              <RepoStatusBadge
                status={repo.status}
                label={t(`status.${repo.status}`)}
              />
            ) : null}
          </div>

          <p className="text-lead-airy text-ink-muted-80 mt-md text-pretty">
            {repo.oneLiner}
          </p>
        </header>

        {/* CLAUDE.md rule 4: a dead entry is marked and pointed somewhere, never
            deleted. An entry saying "this is over, use X" is often worth more
            than the original recommendation was. */}
        {repo.status !== "maintained" ? (
          <aside className="border-hairline bg-canvas-parchment rounded-sm mt-lg border p-md">
            <p className="text-body">{t(`statusNote.${repo.status}`)}</p>
            {repo.supersededByUrl ? (
              <a
                href={repo.supersededByUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body text-primary mt-xs inline-block underline underline-offset-2"
              >
                {t("replacedBy")}
              </a>
            ) : null}
          </aside>
        ) : null}

        <p className="mt-lg flex flex-wrap items-baseline gap-x-lg gap-y-xs">
          <a
            href={repo.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body text-primary underline underline-offset-2"
          >
            {t("openOnGitHub")}
          </a>

          <span className="text-caption text-ink-muted-80 tabular-nums">
            {/* The raw number, not a formatted string. `#` inside an ICU plural
                is the count rendered through the locale's number format, so
                pre-formatting it hands ICU "8,682" where it expects 8682 — the
                plural arm still resolves but `#` prints NaN. Passing the number
                also satisfies CLAUDE.md's Intl.NumberFormat rule, because that
                is what ICU uses to render it. */}
            {repo.stars === null
              ? t("notSynced")
              : t("stars", { count: repo.stars })}
          </span>

          {repo.licenseSpdx ? (
            <span className="text-caption text-ink-muted-80">
              {t("license", { spdx: repo.licenseSpdx })}
            </span>
          ) : null}

          {repo.lastCommitAt ? (
            <time
              dateTime={repo.lastCommitAt.toISOString()}
              className="text-caption text-ink-muted-80"
            >
              {t("lastCommit", { date: dateFormat.format(repo.lastCommitAt) })}
            </time>
          ) : null}
        </p>

        {/* §8: a suspect link is marked, not hidden. The reader can still try it
            — the marker just means they will not be surprised. */}
        {repo.linkSuspect ? (
          <p className="text-caption text-ink-muted-80 mt-sm">
            {th("warning", {
              date: repo.syncedAt ? dateFormat.format(repo.syncedAt) : "—",
            })}
          </p>
        ) : null}

        {sections.map(({ key, value }) =>
          value ? (
            <section
              key={key}
              className="border-hairline mt-xl border-t pt-lg"
            >
              <h2 className="text-caption-strong text-ink-muted-80">{t(key)}</h2>
              <p className="text-body mt-xs text-pretty">{value}</p>
            </section>
          ) : null,
        )}

        {repo.reviewedAt ? (
          <p className="text-caption text-ink-muted-80 mt-xxl">
            {/* Rule 4: every entry carries when a human last looked at it. */}
            {t("reviewed", { date: dateFormat.format(repo.reviewedAt) })}
          </p>
        ) : null}
      </article>
    </>
  );
}
