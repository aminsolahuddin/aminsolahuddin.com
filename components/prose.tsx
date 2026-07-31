import { renderMarkdown } from "@/lib/markdown";

/**
 * Rendered Markdown, styled from DESIGN.md tokens.
 *
 * dangerouslySetInnerHTML is the only way to mount HTML that a parser produced,
 * and the name is doing its job — it is dangerous when the HTML is untrusted.
 * This one is not: renderMarkdown sanitizes with an allowlist before Shiki adds
 * anything, and lib/markdown.test.ts holds the cases that prove it — script
 * tags, event handlers, javascript: URLs, style attributes, iframes.
 *
 * Every rule below goes through Tailwind tokens. CLAUDE.md rule 1: no raw hex,
 * no raw px, no font-family, anywhere.
 */
export async function Prose({ source }: { source: string | null }) {
  const html = await renderMarkdown(source);
  if (!html) return null;

  return (
    <div
      className={[
        // Body copy and vertical rhythm.
        "text-body [&>p]:mt-md [&>p:first-child]:mt-0",

        // Headings. A post body starts at h2 — the page title is the h1, and a
        // second h1 inside it would flatten the outline for a screen reader.
        "[&>h2]:text-tagline [&>h2]:font-display [&>h2]:mt-xl",
        "[&>h3]:text-body-strong [&>h3]:mt-lg",

        // Lists.
        "[&>ul]:mt-md [&>ul]:list-disc [&>ul]:pl-lg",
        "[&>ol]:mt-md [&>ol]:list-decimal [&>ol]:pl-lg",
        "[&_li]:mt-xxs",

        // Links. Underlined rather than colour-only: §15 does not accept colour
        // as the sole carrier of meaning, and a link is meaning.
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",

        // Inline code, distinct from a highlighted block.
        "[&_:not(pre)>code]:bg-surface-pearl [&_:not(pre)>code]:rounded-xs",
        "[&_:not(pre)>code]:px-xxs [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-caption",

        // Code blocks. overflow-x-auto so a long line scrolls inside the block
        // instead of making the whole page scroll sideways on a phone.
        "[&>pre]:mt-md [&>pre]:rounded-sm [&>pre]:p-md [&>pre]:overflow-x-auto",
        "[&>pre]:border-hairline [&>pre]:border [&>pre]:text-caption",

        /**
         * Quotes, set by indentation and muted ink rather than a left rule.
         *
         * ANTI_SLOP.md rule 11 bans the coloured left-border card, and the check
         * flagged this — correctly. A quote is not a card, but the shape is the
         * same one the rule exists to keep off the site, and arguing the
         * distinction is how a rule stops meaning anything. Indent plus a
         * lighter ink is what a well-set book does anyway.
         */
        "[&>blockquote]:mt-md [&>blockquote]:pl-lg [&>blockquote]:text-ink-muted-80",

        // Tables scroll in their own container, same reason as code blocks.
        "[&>table]:mt-md [&>table]:block [&>table]:overflow-x-auto [&>table]:text-caption",
        "[&_th]:border-hairline [&_th]:border-b [&_th]:py-xxs [&_th]:pr-md [&_th]:text-left",
        "[&_td]:border-hairline [&_td]:border-b [&_td]:py-xxs [&_td]:pr-md",

        "[&>hr]:border-hairline [&>hr]:mt-xl",
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
