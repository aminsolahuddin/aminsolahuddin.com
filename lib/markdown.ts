import "server-only";

import rehypeShiki from "@shikijs/rehype";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

/**
 * Markdown to HTML, server-side. BUILD_PLAN.md §12, Phase 3.
 *
 * Phase 1 rendered notes_md as plain paragraphs and said why: half-rendered
 * Markdown, with bold working and links not, reads as a bug rather than as a
 * limitation. This is the other half.
 *
 * Nothing here reaches the browser. The parser, the sanitizer and Shiki's
 * grammars all run on the server and the page ships the resulting HTML, so the
 * 150 KB client budget in CLAUDE.md is untouched by any of it.
 */

/**
 * The sanitizer runs before the highlighter, and the order is load-bearing.
 *
 * Shiki emits inline `style` on hundreds of spans. Sanitizing after it would
 * either strip every colour or force `style` onto the allowlist — and an
 * allowlist that permits arbitrary style attributes is one an author can use to
 * cover the page in a positioned overlay. Sanitizing first means the styles that
 * survive are the ones this code generated, never ones that came out of the
 * database.
 *
 * There is one admin account, so the threat is not a hostile author. It is a
 * stolen session: stored XSS in a post body would run on every reader's browser
 * and outlive the intrusion by however long nobody notices.
 */
const schema: Options = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    /**
     * `language-ts` and friends have to survive sanitizing, because that class is
     * how Shiki knows which grammar to use. Stripped, every fenced block would
     * render as plain text and the fix would look like a Shiki bug.
     */
    code: [...(defaultSchema.attributes?.["code"] ?? []), ["className", /^language-./]],
    pre: [...(defaultSchema.attributes?.["pre"] ?? []), ["className", /^language-./]],
    // Footnote and heading anchors, which remark generates.
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "id"],
  },
};

const processor = unified()
  .use(remarkParse)
  // Tables, strikethrough, task lists and bare-URL autolinks. Every one of them
  // is something a developer writing about tooling reaches for without thinking.
  .use(remarkGfm)
  /**
   * allowDangerousHtml is off, which is the default and is deliberate: raw HTML
   * in the source is dropped rather than passed through to the sanitizer. Two
   * layers saying no is the right number when the input is a text column.
   */
  .use(remarkRehype)
  .use(rehypeSanitize, schema)
  .use(rehypeShiki, {
    // The same two themes as lib/highlight.ts, for the same reason recorded
    // there: they are the lowest-chroma themes Shiki ships, which is what
    // survives next to DESIGN.md's single-accent discipline.
    themes: { light: "min-light", dark: "min-dark" },
    // An unknown or misspelled language degrades to plain text. A post must
    // never fail to render because of a typo in a fence.
    fallbackLanguage: "text",
  })
  .use(rehypeStringify);

/**
 * Render Markdown to sanitized, highlighted HTML.
 *
 * Returns an empty string for empty input rather than throwing, so a caller can
 * pass a nullable column straight through.
 */
export async function renderMarkdown(source: string | null): Promise<string> {
  if (!source?.trim()) return "";
  const file = await processor.process(source);
  return String(file);
}
