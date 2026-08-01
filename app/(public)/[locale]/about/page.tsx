import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/env";
import { localeAlternates } from "@/lib/alternates";
import { FallbackNotice } from "@/components/fallback-notice";
import { StaticPage } from "@/components/static-page";
import { JsonLd, personSchema } from "@/components/json-ld";

/**
 * BUILD_PLAN.md §2 and §9: "JSON-LD: Person on /about".
 *
 * personSchema was written with the rest of the structured data and had no
 * caller, because this page did not exist — the same shape as
 * getPublishedRepoPaths sitting unused for two phases. This is where it goes.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "aboutPage" });

  return {
    title: t("title"),
    description: t("lead"),
    alternates: localeAlternates(locale, "/about"),
  };
}

export default async function AboutPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("aboutPage");
  const tf = await getTranslations("fallbackNotice");

  const translated = locale === routing.defaultLocale;

  return (
    <>
      {!translated ? (
        <FallbackNotice body={tf("body")} action={tf("action")} href="/about" />
      ) : null}

      <StaticPage title={t("title")} lead={t("lead")} body={t("body")} />

      <JsonLd
        schema={personSchema({
          url: `${getSiteUrl()}/${locale}/about`,
          description: t("lead"),
          // Only profiles that are actually his. sameAs is how a search engine
          // decides two accounts are one person, so a wrong entry here merges
          // someone else's identity into his.
          sameAs: ["https://github.com/aminsolahuddin"],
        })}
      />
    </>
  );
}
