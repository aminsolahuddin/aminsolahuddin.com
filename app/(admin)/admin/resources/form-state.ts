/**
 * The shape a pack form action returns, kept out of actions.ts on purpose.
 *
 * Every export from a "use server" module has to be an async function — Next.js
 * treats them all as callable endpoints and publishes them as such. Exporting a
 * plain constant from there fails at module evaluation, before any request, with
 * a stack that points at the closing brace of the file and says nothing about
 * which export was wrong.
 *
 * Types are erased and would have been fine. The constant is what broke it, so
 * both live here and actions.ts imports them back.
 */
export interface FormState {
  ok: boolean;
  /** Keyed by field name so the form can put each message beside its input. */
  errors: Record<string, string>;
  /** Slug warnings, shown with the override checkbox rather than as errors. §5 */
  warnings: string[];
  /**
   * What was submitted, echoed back so a rejected save redisplays it.
   *
   * Without this the inputs fall back to their defaults on every failure, and
   * the §5 override becomes self-defeating: the warnings tell you the slug is
   * risky, and accepting them means retyping the slug you just lost. A warning
   * that costs the work it is warning about gets clicked past.
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
