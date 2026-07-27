"use client";

import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * BUILD_PLAN.md §4: switching language must keep the reader on the same entity.
 * /en/repos/atuin goes to /ms/repos/atuin, never to the homepage — which is what
 * the pathname + params round-trip below preserves.
 *
 * Labels arrive as props rather than through useTranslations on purpose. Reading
 * them from the hook would require a NextIntlClientProvider around the tree,
 * which serialises the whole message catalogue into the client bundle so that one
 * <select> can read six words from it. Content pages have a 150 KB budget and
 * roughly 17 KB of headroom, so that trade is not available.
 */
type Props = {
  locale: string;
  label: string;
  names: Record<string, string>;
};

export function LocaleSwitcher({ locale, label, names }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function onChange(next: string) {
    startTransition(() => {
      router.replace(
        // @ts-expect-error — pathname and params are correlated at runtime but
        // next-intl cannot express that pairing in its types.
        { pathname, params },
        { locale: next as Locale },
      );
    });
  }

  return (
    <label className="inline-flex items-center gap-xxs">
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) => onChange(event.target.value)}
        className="text-nav-link rounded-sm bg-transparent text-on-dark disabled:text-ink-muted-48"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code} className="text-ink">
            {names[code] ?? code}
          </option>
        ))}
      </select>
    </label>
  );
}
