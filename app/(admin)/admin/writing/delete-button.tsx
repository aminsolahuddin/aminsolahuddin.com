"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deletePost } from "./actions";

/**
 * Deleting a draft post, behind one deliberate step. Same two-stage reveal as
 * the other two editors, and the same reason: window.confirm() is suppressible,
 * cannot name what is about to go, and gets dismissed by reflex once it has said
 * the same thing three times.
 */
export function DeletePostButton({
  postId,
  slug,
}: {
  postId: string;
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
    <form action={deletePost.bind(null, postId)}>
      <p className="text-caption">
        Delete <span className="font-mono">/writing/{slug}</span> and its
        translations? It has never been published, so nothing links to it.
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
