import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/env";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { localeAlternates } from "@/lib/alternates";
import "../../tokens.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: { default: t("siteName"), template: `%s — ${t("siteName")}` },
    description: t("tagline"),
    metadataBase: new URL(getSiteUrl()),
    alternates: localeAlternates(locale, ""),
  };
}

export default async function LocaleLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required for static rendering of a [locale] segment.
  setRequestLocale(locale);

  const t = await getTranslations("nav");

  return (
    <html lang={locale}>
      {/**
       * §11's feed, announced as an element rather than through the metadata API.
       *
       * `alternates.types` in generateMetadata looks like the right home for it
       * and is not: Next replaces the whole `alternates` object when a page
       * defines its own, and every content page here defines one for canonical
       * and hreflang. So the feed link appeared on the homepage and silently
       * vanished from every other page — including the writing index, the one
       * place a reader would look for it.
       *
       * React hoists this into <head>, from the layout, where no page can
       * override it and no future page has to remember it.
       */}
      <body className="bg-canvas text-ink font-text antialiased">
        {/* §15 keyboard navigation. Visually hidden until focused. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-xs focus:left-xs focus:z-50 focus:rounded-sm focus:bg-ink focus:px-md focus:py-xs focus:text-on-dark"
        >
          {t("skipToContent")}
        </a>
        {/* The provider is required even though nothing here translates on the
            client: next-intl's usePathname and useRouter read the locale from
            this context, and the language switcher cannot work without them.
            What it does NOT do is ship messages. Left to inherit, it serialises
            the entire catalogue into every page; `messages={{}}` gives the
            navigation hooks their context and sends none of it. Client
            components take their strings as props instead — CLAUDE.md rule 6. */}
        <NextIntlClientProvider locale={locale} messages={{}}>
          <SiteHeader locale={locale} />
          <main id="main">{props.children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
