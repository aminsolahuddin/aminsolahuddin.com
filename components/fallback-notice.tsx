import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Shown when a record has no row in the requested locale and the English one is
 * being rendered instead. BUILD_PLAN.md §4.
 *
 * It is deliberately small and deliberately present. The alternative that keeps
 * getting proposed — quietly serving English — is worse in the one case that
 * matters: a reader who does not read English well cannot tell whether the page
 * is untranslated or whether they have misunderstood it. Saying so costs one
 * line and removes that doubt.
 *
 * Never a machine translation. CLAUDE.md is explicit, and a wrong translation of
 * a security caveat is worse than a sentence the reader has to work through.
 */
export function FallbackNotice({
  body,
  action,
  href,
}: {
  body: string;
  action: string;
  href: string;
}) {
  return (
    <aside className="border-hairline bg-surface-pearl border-b">
      <div className="text-caption text-ink-muted-80 mx-auto flex max-w-3xl flex-wrap items-baseline gap-x-sm gap-y-xxs px-lg py-sm">
        <span>{body}</span>
        <Link
          href={href}
          locale={routing.defaultLocale}
          className="text-primary underline underline-offset-2"
        >
          {action}
        </Link>
      </div>
    </aside>
  );
}
