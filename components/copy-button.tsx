"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One of the few genuinely interactive things on a content page, so one of the
 * few places CLAUDE.md rule 6 allows "use client".
 *
 * Strings arrive as props rather than through a translation hook. The locale
 * layout mounts NextIntlClientProvider with `messages={{}}` on purpose — reading
 * a message here would mean shipping the whole catalogue to every page that has
 * one command on it.
 */
export function CopyButton({
  value,
  label,
  copiedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Without this, copying and then navigating away leaves a timer holding a
  // setState on an unmounted component.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be refused — an insecure context, or a permission
      // policy. The command is already on screen and selectable, so the copy is
      // a convenience and its failure is not worth an error state.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-button-utility text-ink-muted-80 border-hairline rounded-xs border px-xs py-xxs transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100"
    >
      <span aria-hidden={copied}>{copied ? copiedLabel : label}</span>
      {/* The visible label swap is not announced by every screen reader, so the
          confirmation is also published to a live region. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </button>
  );
}
