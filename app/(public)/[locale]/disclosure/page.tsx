import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { localeAlternates } from "@/lib/alternates";
import { FallbackNotice } from "@/components/fallback-notice";
import { StaticPage } from "@/components/static-page";

/**
 * BUILD_PLAN.md §10 and CLAUDE.md rule 5.
 *
 * This page is what the automatic disclosure banner points at. Until it existed,
 * rule 5 was working exactly half way: the banner rendered on every affiliate
 * page, above the fold, without anyone remembering to add it — and its "read the
 * full policy" link returned a 404. A disclosure that promises a policy and does
 * not have one is worse than no banner, because it looks answered.
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

  const t = await getTranslations({ locale, namespace: "disclosurePage" });

  return {
    title: t("title"),
    description: t("lead"),
    alternates: localeAlternates(locale, "/disclosure"),
  };
}

export default async function DisclosurePage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("disclosurePage");
  const tf = await getTranslations("fallbackNotice");

  /**
   * ms.json and zh-Hans.json carry no copy for this page, so the merge in
   * i18n/request.ts serves the English underneath. Saying so matters more here
   * than on a repo entry: this is the page that explains when a link pays me,
   * and a reader who cannot read it well needs to know that is why.
   */
  const translated = locale === routing.defaultLocale;

  return (
    <>
      {!translated ? (
        <FallbackNotice
          body={tf("body")}
          action={tf("action")}
          href="/disclosure"
        />
      ) : null}

      <StaticPage title={t("title")} lead={t("lead")} body={t("body")} />
    </>
  );
}
