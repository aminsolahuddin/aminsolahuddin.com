import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * DESIGN.md's footer is the one place the site is allowed to go dense — the
 * relaxed 2.41 line-height on `dense-link` is what keeps the columns scannable
 * at that density. It is not a mistake in the spec.
 *
 * Fine print uses `text-fine-print` rather than `ink-muted-48`. ANTI_SLOP.md §5:
 * #7a7a7a on parchment measures 3.9:1 and fails the WCAG AA requirement that
 * BUILD_PLAN.md §15 sets for this project.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");
  const year = new Date().getFullYear();

  const sections = [
    { href: "/resources", label: nav("resources") },
    { href: "/repos", label: nav("repos") },
    { href: "/writing", label: nav("writing") },
    { href: "/tools", label: nav("tools") },
  ] as const;

  const legal = [
    { href: "/disclosure", label: t("disclosure") },
    { href: "/privacy", label: t("privacy") },
  ] as const;

  return (
    <footer className="bg-canvas-parchment text-ink-muted-80 px-lg pt-xxl pb-xl">
      {/* `phone:`, not `sm:`. Tailwind's default breakpoints are cleared in
          tokens.css because none of them is a DESIGN.md value — the names here
          come from its Responsive Behavior table. */}
      <div className="mx-auto grid max-w-6xl gap-xl phone:grid-cols-3">
        <div>
          <h2 className="text-caption-strong text-ink">{t("sections")}</h2>
          <ul className="text-dense-link">
            {sections.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-caption-strong text-ink">{t("legal")}</h2>
          <ul className="text-dense-link">
            {legal.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-caption-strong text-ink">{t("rss")}</h2>
          <ul className="text-dense-link">
            <li>
              <a href="/rss.xml">{t("rss")}</a>
            </li>
          </ul>
        </div>
      </div>

      <p className="text-fine-print mx-auto mt-xl max-w-6xl">
        {t("copyright", { year })}
      </p>
    </footer>
  );
}
