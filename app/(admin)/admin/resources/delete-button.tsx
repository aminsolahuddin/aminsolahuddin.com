"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deletePack } from "./actions";

/**
 * Deleting a draft pack. Same two-step reveal as the repo one, and the same
 * reason: window.confirm() is suppressible, cannot name what is about to go, and
 * gets dismissed by reflex once it has said the same thing three times.
 *
 * Rule 3 is why only drafts reach this. A published slug may already have been
 * said out loud in a video, and deleting it breaks that URL for good.
 */
export function DeletePackButton({
  packId,
  slug,
}: {
  packId: string;
  slug: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-caption text-ink-muted-80 underline underline-offset-2"
      >
        Delete this draft
      </button>
    );
  }

  return (
    <form action={deletePack.bind(null, packId)}>
      <p className="text-caption">
        Delete <span className="font-mono">/r/{slug}</span> with its items and
        translations? It has never been published, so no video says this slug.
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
