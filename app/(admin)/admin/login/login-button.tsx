"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";

export function LoginButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      await signIn.social({ provider: "github", callbackURL: "/admin" });
    } catch {
      // The allowlist rejection also lands here. The message stays vague on
      // purpose — a precise one would confirm to a stranger that they found a
      // real admin panel and simply used the wrong account.
      setError("Sign-in failed.");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="bg-ink text-on-dark text-button-utility rounded-sm px-button-dark-utility-x py-button-dark-utility-y transition-transform duration-150 active:scale-95 disabled:text-ink-muted-48 motion-reduce:active:scale-100"
      >
        {pending ? "Redirecting" : "Continue with GitHub"}
      </button>
      {error ? (
        <p role="alert" className="text-caption text-ink-muted-80 mt-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
