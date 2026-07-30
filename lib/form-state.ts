/**
 * The shape every admin form action returns.
 *
 * Deliberately not inside any "use server" module. Every export from one has to
 * be an async function — Next.js treats them all as callable endpoints and
 * publishes them as such — so exporting a plain constant from there fails at
 * module evaluation, before any request, with a stack that points at the closing
 * brace of the file and never names the export that was wrong.
 *
 * Types are erased and would have been fine. EMPTY_STATE is what broke it, so
 * both live here and the action modules import them back.
 */
export interface FormState {
  ok: boolean;
  /** Keyed by field name so the form can put each message beside its input. */
  errors: Record<string, string>;
  /**
   * Things worth confirming rather than refusing — a slug that will not survive
   * being said aloud, an entry with no caveats. Shown with an override checkbox.
   */
  warnings: string[];
  /**
   * What was submitted, echoed back so a rejected save redisplays it.
   *
   * Without this the inputs fall back to their defaults on every failure, and an
   * override becomes self-defeating: the warning tells you the value is risky,
   * and accepting it means retyping the value you just lost. A warning that
   * costs the work it is warning about gets clicked past.
   *
   * Keyed by form field name — "slug", "title.ms" — so the form can read it back
   * without a second shape to keep in sync.
   */
  values: Record<string, string> | null;
}

export const EMPTY_STATE: FormState = {
  ok: false,
  errors: {},
  warnings: [],
  values: null,
};

/** Zod issues collapsed to one message per field, first wins. */
export function flattenIssues(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
