"use client";

import { useFormStatus } from "react-dom";

import { acknowledgeChange } from "../repos/actions";

/**
 * "I have read this."
 *
 * The row is kept rather than deleted — "this was archived in March and I knew"
 * is the fact that makes a later reviewed_at mean anything. Marking it read only
 * takes it off this page.
 */
export function AcknowledgeButton({ changeId }: { changeId: string }) {
  return (
    <form action={acknowledgeChange.bind(null, changeId)} className="shrink-0">
      <Button />
    </form>
  );
}

function Button() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="border-hairline text-button-utility text-ink-muted-80 rounded-pill px-configurator-option-chip-x py-configurator-option-chip-y border disabled:opacity-60"
    >
      {pending ? "Marking" : "I have read this"}
    </button>
  );
}
