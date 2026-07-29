import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LocaleSwitcher } from "./locale-switcher";

/**
 * DESIGN.md's two-row nav: a slim true-black global bar, then a frosted parchment
 * sub-nav below it.
 *
 * The global bar is the only place pure black appears on most pages, and the
 * 44px height is the system's minimum touch target — both are from DESIGN.md and
 * neither is arbitrary.
 */
export async function SiteHeader({ locale }: { locale: string }) {
  const t = await getTranslations("nav");
  const meta = await getTranslations("meta");
  const switcher = await getTranslations("localeSwitcher");

  const links = [
    { href: "/resources", label: t("resources") },
    { href: "/repos", label: t("repos") },
    { href: "/writing", label: t("writing") },
    { href: "/tools", label: t("tools") },
    { href: "/about", label: t("about") },
  ] as const;

  return (
    <header>
      <nav
        aria-label={meta("siteName")}
        className="bg-surface-black text-on-dark h-global-nav-height flex items-center px-lg"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-lg">
          <Link href="/" className="text-nav-link font-display">
            {meta("siteName")}
          </Link>

          <ul className="flex items-center gap-lg">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-nav-link">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <LocaleSwitcher
            locale={locale}
            label={switcher("label")}
            names={Object.fromEntries(
              routing.locales.map((code) => [code, switcher(code)]),
            )}
          />
        </div>
      </nav>

      {/* Frosted sub-nav. backdrop-blur is functional here, not decorative — it is
          what lets the bar float over a full-bleed tile without a border. */}
      <div className="bg-canvas-parchment/80 h-sub-nav-frosted-height sticky top-0 z-40 flex items-center px-lg backdrop-blur-lg backdrop-saturate-150">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <Link href="/" className="text-tagline font-display">
            {meta("siteName")}
          </Link>
          {/* Hidden below the phone breakpoint: the tagline is the first thing
              that should go when the bar gets tight, and the site name is not. */}
          <p className="text-caption text-ink-muted-80 hidden phone:block">
            {meta("tagline")}
          </p>
        </div>
      </div>
    </header>
  );
}
