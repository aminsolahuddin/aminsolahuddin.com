import { Link } from "@/i18n/navigation";

/**
 * CLAUDE.md rule 5: a page carrying affiliate links renders this automatically,
 * above the fold. It is never a thing an author remembers to add.
 *
 * The rule is written that way because the failure mode is silent. A disclosure
 * that depends on someone ticking a box is missing precisely on the page where
 * the box was forgotten, and nothing about that page looks wrong afterwards.
 *
 * So callers do not decide whether to render this — they pass the data, and
 * `shouldDisclose` below reads the answer off the items. See its comment for why
 * it does not simply trust the pack's own flag.
 */
export function DisclosureBanner({
  body,
  action,
}: {
  body: string;
  action: string;
}) {
  return (
    <aside className="border-hairline bg-canvas-parchment border-b">
      <div className="text-caption text-ink-muted-80 mx-auto flex max-w-3xl flex-wrap items-baseline gap-x-sm gap-y-xxs px-lg py-sm">
        <span>{body}</span>
        <Link
          href="/disclosure"
          className="text-primary underline underline-offset-2"
        >
          {action}
        </Link>
      </div>
    </aside>
  );
}

/**
 * True if anything on the page is an affiliate link.
 *
 * The pack's own `has_affiliate` column is treated as one input rather than the
 * answer. A flag and the rows it describes can disagree — an item gets marked
 * affiliate and the parent flag is not updated — and of the two possible
 * disagreements only one is harmful. An extra banner on a page with no affiliate
 * links is a wasted line. A missing banner on a page with one is undisclosed
 * paid placement. So either source is enough to trigger it.
 */
export function shouldDisclose(
  packFlag: boolean,
  items: readonly { isAffiliate: boolean }[],
): boolean {
  return packFlag || items.some((item) => item.isAffiliate);
}
