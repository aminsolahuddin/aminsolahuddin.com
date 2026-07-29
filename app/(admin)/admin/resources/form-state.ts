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
}

export const EMPTY_STATE: FormState = { ok: false, errors: {}, warnings: [] };
