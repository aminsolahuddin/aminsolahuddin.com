/**
 * BUILD_PLAN.md §3: "A summary that only restates the README is not worth
 * publishing — the admin form should warn if not_for_you_if or the_catch is
 * empty."
 *
 * Its own module, with no zod import, so the editor can run it on every
 * keystroke without pulling a validation library into the browser. "The form
 * should warn" means while you are writing, not after you have already pressed
 * save — a warning that costs a round trip is one you learn to pre-empt by
 * typing a space into the box.
 */

export interface FieldWarning {
  code: "no-caveat" | "no-audience" | "restates-readme";
  /** The form field this is about, so the message can sit next to it. */
  field: "oneLiner" | "forWhom" | "notForYouIf" | "theCatch";
  message: string;
}

export interface CaveatText {
  oneLiner?: string | undefined;
  forWhom?: string | undefined;
  notForYouIf?: string | undefined;
  theCatch?: string | undefined;
}

/**
 * How short a one-liner has to be before it is doing no work.
 *
 * Not a quality measure — nothing here can tell good prose from bad. It catches
 * the one case that is mechanically detectable: an entry saved with a couple of
 * words in it, which reads as finished in the list and says nothing on the page.
 */
const THIN_ONE_LINER = 25;

/**
 * The §3 warnings, on the English text.
 *
 * English only, deliberately. It is the language every other one falls back to
 * under §6, so an empty ms tab is a translation gap — already reported as one —
 * and not a missing caveat. Warning per language would mean an entry cannot be
 * published until all three are written, which is the opposite of what the
 * fallback rule exists to allow.
 */
export function caveatWarnings(text: CaveatText): FieldWarning[] {
  const warnings: FieldWarning[] = [];
  const filled = (value: string | undefined) => Boolean(value?.trim());

  if (!filled(text.notForYouIf)) {
    warnings.push({
      code: "no-caveat",
      field: "notForYouIf",
      message:
        'Empty. An entry that only says who should use something is an advert for it.',
    });
  }

  if (!filled(text.theCatch)) {
    warnings.push({
      code: "restates-readme",
      field: "theCatch",
      message:
        "Empty. Every tool has one, and it is the sentence a reader cannot get from the README.",
    });
  }

  if (!filled(text.forWhom)) {
    warnings.push({
      code: "no-audience",
      field: "forWhom",
      message: "Empty. Without it the caveats have nobody to be relevant to.",
    });
  }

  const oneLiner = text.oneLiner?.trim() ?? "";
  // Empty is the publish check's problem, not this one's. Reporting both would
  // put two messages on one field and neither would say what to do about it.
  if (oneLiner.length > 0 && oneLiner.length < THIN_ONE_LINER) {
    warnings.push({
      code: "restates-readme",
      field: "oneLiner",
      message: `${oneLiner.length} characters. Say what it does, not what it is called.`,
    });
  }

  return warnings;
}
