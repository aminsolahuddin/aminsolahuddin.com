/**
 * BUILD_PLAN.md §3, `tool`. The counterpart to caveats.ts, for the one content
 * type whose whole claim is "I have actually used this".
 *
 * No zod import, for the reason caveats.ts gives: the editor runs these on every
 * keystroke, and pulling a validation library into the browser to print three
 * sentences is a poor trade.
 *
 * The two about empty prose refuse nothing, and that is a deliberate difference
 * from the repo warnings. A repo entry has a draft state to be unfinished in; a
 * tool row has none — §3 gives it no status column — so the row IS the published
 * thing and blocking the save would mean losing what was typed. The gate that
 * matters there is structural instead: a tool with no English `why_i_use_it`
 * never reaches /tools at all, because listTools() has nothing to render for it.
 * See lib/queries/tool.ts.
 *
 * The third is different. A paid link on a tool that has not been run is refused
 * by toolSchema, and this is that rule said early — while the box is being
 * unticked, rather than after a save that was going to fail.
 */

export interface ToolWarning {
  code: "no-reason" | "no-caveat" | "paid-and-unused";
  /** The form field this is about, so the message can sit beside its input. */
  field: "whyIUseIt" | "caveat" | "personallyUsed";
  message: string;
}

export interface ToolText {
  whyIUseIt?: string | undefined;
  caveat?: string | undefined;
}

export interface ToolFacts {
  personallyUsed: boolean;
  /** Empty string when there is none. */
  affiliateUrl: string;
}

/**
 * The warnings, on the English text.
 *
 * English only, same reasoning as caveatWarnings(): every other language falls
 * back to it, so an empty Malay tab is a translation gap and not a missing
 * caveat.
 */
export function toolWarnings(text: ToolText, facts: ToolFacts): ToolWarning[] {
  const warnings: ToolWarning[] = [];
  const filled = (value: string | undefined) => Boolean(value?.trim());

  if (!filled(text.whyIUseIt)) {
    warnings.push({
      code: "no-reason",
      field: "whyIUseIt",
      message:
        "Empty, so this tool does not appear on /tools at all. A name and a link is a directory entry, not a recommendation.",
    });
  }

  if (!filled(text.caveat)) {
    warnings.push({
      code: "no-caveat",
      field: "caveat",
      message:
        "Empty. The reason to use something is the half a reader can already get from its homepage.",
    });
  }

  /**
   * The one that is not advisory.
   *
   * toolSchema refuses this combination outright — see the note there — so this
   * is the same rule said early, while the box is being unticked, rather than
   * after a save that was going to fail. Either half alone is fine: plenty of
   * tools are worth naming without having been run, and plenty of affiliate
   * links point at things used daily.
   */
  if (filled(facts.affiliateUrl) && !facts.personallyUsed) {
    warnings.push({
      code: "paid-and-unused",
      field: "personallyUsed",
      message:
        "This link pays and this box is unticked, so the save will be refused. /tools promises the opposite at the top of the page.",
    });
  }

  return warnings;
}
