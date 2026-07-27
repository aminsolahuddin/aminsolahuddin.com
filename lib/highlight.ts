import { createHighlighter, type Highlighter } from "shiki";

/**
 * Server-only syntax highlighting. This runs in a React Server Component and the
 * highlighter never reaches the browser, so the 150 KB client JS budget in
 * CLAUDE.md is untouched by it.
 *
 * Themes are `min-light` and `min-dark` on purpose. They are the lowest-chroma
 * themes Shiki ships, which is the only kind that survives next to DESIGN.md's
 * single-accent discipline — a rainbow theme would put six competing colours on a
 * page whose whole argument is that there is exactly one.
 */

const LANGS = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "bash",
  "shell",
  "json",
  "sql",
  "css",
  "html",
  "python",
  "yaml",
  "markdown",
  "dockerfile",
  "diff",
] as const;

export type SupportedLang = (typeof LANGS)[number];

const THEMES = { light: "min-light", dark: "min-dark" } as const;

export type Tone = keyof typeof THEMES;

// Loading the grammars is expensive, so the highlighter is created once per
// server process and reused. Concurrent callers share the same promise rather
// than each triggering their own load.
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [THEMES.light, THEMES.dark],
    langs: [...LANGS],
  });
  return highlighterPromise;
}

export function isSupportedLang(lang: string): lang is SupportedLang {
  return (LANGS as readonly string[]).includes(lang);
}

/**
 * Returns highlighted HTML. An unknown language degrades to plain text rather
 * than throwing — a pack must never fail to render because of a typo in a
 * language tag.
 */
export async function highlight(
  code: string,
  lang: string,
  tone: Tone = "light",
): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code.trimEnd(), {
    lang: isSupportedLang(lang) ? lang : "text",
    theme: THEMES[tone],
  });
}
