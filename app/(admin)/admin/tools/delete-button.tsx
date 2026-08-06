"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteTool } from "./actions";

/**
 * Deleting a tool, behind one deliberate step.
 *
 * Not window.confirm(): it is suppressible, it cannot say which row is about to
 * go, and a dialog that always says the same thing gets dismissed by reflex.
 * Revealing a second button costs one click and states the name being deleted,
 * which is the part that makes the click mean something.
 */
export function DeleteToolButton({
  toolId,
  label,
}: {
  toolId: string;
  label: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-caption text-ink-muted-80 underline underline-offset-2"
      >
        Delete this tool
      </button>
    );
  }

  return (
    <form action={deleteTool.bind(null, toolId)}>
      <p className="text-caption">
        Delete {label}, its translations and its link-check history? Nothing links
        to it directly — a tool has no page of its own — so this leaves no dead
        URL behind. It does mean the reason and the caveat are gone.
      </p>
      <div className="mt-xs flex flex-wrap items-center gap-md">
        <ConfirmButton />
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-caption text-ink-muted-80 underline underline-offset-2"
        >
          Keep it
        </button>
      </div>
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-ink text-on-dark text-button-utility rounded-pill px-button-primary-x py-button-primary-y disabled:opacity-60"
    >
      {pending ? "Deleting" : "Delete"}
    </button>
  );
}
