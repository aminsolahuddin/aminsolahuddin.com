import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { localeAlternates } from "@/lib/alternates";
import { FallbackNotice } from "@/components/fallback-notice";
import { StaticPage } from "@/components/static-page";

/**
 * BUILD_PLAN.md §10, PDPA (Malaysia).
 *
 * Written against what the site actually does today, which was checked rather
 * than assumed before a word of it went down: there is no analytics wired up,
 * nothing writes to the subscriber table, and the only cookies are the language
 * choice and my own admin session. A notice describing collection that does not
 * happen is not a cautious notice, it is an inaccurate one — and it trains a
 * reader to disbelieve the parts that are true.
 *
 * §10 asks for it in all three languages. English first, with the fallback
 * notice, because CLAUDE.md makes user-facing ms and zh-Hans copy a stop-and-ask
 * — and a privacy notice is the last thing that should be translated by anyone
 * who has not read it carefully.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The date this text last changed, kept by hand.
 *
 * Not `new Date()`, and not the deploy time. A privacy notice stamped with today
 * on every render tells a reader it was reviewed today, every day, which is the
 * opposite of what the date is for. It moves when the words move.
 */
const LAST_UPDATED = new Date("2026-08-01T00:00:00Z");

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "privacyPage" });

  return {
    title: t("title"),
    description: t("lead"),
    alternates: localeAlternates(locale, "/privacy"),
  };
}

export default async function PrivacyPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("privacyPage");
  const tf = await getTranslations("fallbackNotice");

  const translated = locale === routing.defaultLocale;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    LAST_UPDATED,
  );

  return (
    <>
      {!translated ? (
        <FallbackNotice
          body={tf("body")}
          action={tf("action")}
          href="/privacy"
        />
      ) : null}

      <StaticPage
        title={t("title")}
        lead={t("lead")}
        body={t("body")}
        meta={t("updated", { date })}
      />
    </>
  );
}
