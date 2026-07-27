/**
 * Generates app/tokens.css from the YAML frontmatter of DESIGN.md.
 *
 * CLAUDE.md rule 1: DESIGN.md is the sole authority on visual values, and nothing
 * may hardcode a hex, px, or font-family. This script is what makes that mechanical
 * rather than aspirational — the tokens cannot drift from DESIGN.md because they are
 * derived from it on every `pnpm tokens` run.
 *
 * Output is Tailwind v4 `@theme`, not `tailwind.config.ts`. CLAUDE.md names the
 * config file, but Tailwind v4 is CSS-first and has no such file. The rule's intent
 * (one generated source of truth) is preserved; only the filename changed.
 *
 * Unit policy, applied deliberately:
 *   font-size      px -> rem   so the page respects a reader's browser font setting
 *   letter-spacing px -> em    so tracking scales with whatever size it lands on
 *   spacing        px -> rem   so layout scales with the same setting
 *   radius         px stays px corners should not grow when text does
 *   line-height    unitless    already unitless in DESIGN.md
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESIGN_MD = resolve(HERE, "../../DESIGN.md");
const OUT = resolve(HERE, "../app/tokens.css");

const ROOT_FONT_PX = 16;

type Scalar = string | number;

interface TypeStyle {
  fontFamily?: string;
  fontSize?: Scalar;
  fontWeight?: Scalar;
  lineHeight?: Scalar;
  letterSpacing?: Scalar;
}

interface ComponentSpec {
  padding?: string;
  height?: Scalar;
  size?: Scalar;
  [key: string]: unknown;
}

interface Design {
  colors: Record<string, string>;
  typography: Record<string, TypeStyle>;
  rounded: Record<string, Scalar>;
  spacing: Record<string, Scalar>;
  components?: Record<string, ComponentSpec>;
}

function readFrontmatter(path: string): Design {
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = match?.[1];
  if (frontmatter === undefined) {
    throw new Error(`No YAML frontmatter found in ${path}`);
  }
  const parsed = parse(frontmatter) as Partial<Design>;
  for (const key of ["colors", "typography", "rounded", "spacing"] as const) {
    if (!parsed[key]) throw new Error(`DESIGN.md frontmatter is missing "${key}"`);
  }
  return parsed as Design;
}

/** "56px" -> 3.5, 0 -> 0. Returns null for values that are not px. */
function px(value: Scalar | undefined): number | null {
  if (value === undefined) return null;
  if (typeof value === "number") return value;
  const magnitude = value.trim().match(/^(-?[\d.]+)px$/)?.[1];
  return magnitude === undefined ? null : Number(magnitude);
}

function toRem(value: Scalar | undefined): string | null {
  const n = px(value);
  if (n === null) return null;
  if (n === 0) return "0";
  return `${round(n / ROOT_FONT_PX)}rem`;
}

/** letter-spacing is expressed relative to the size it sits on, so px -> em. */
function toEm(value: Scalar | undefined, fontSize: Scalar | undefined): string | null {
  const n = px(value);
  if (n === null) return null;
  if (n === 0) return "0em";
  const base = px(fontSize);
  if (base === null || base === 0) return null;
  return `${round(n / base, 4)}em`;
}

function round(n: number, dp = 5): number {
  return Number(n.toFixed(dp));
}

/** The only font stacks in the system. DESIGN.md gives them per type style; they
 *  collapse to two, so we emit two families and let every style reference one. */
function fontFamilies(typography: Record<string, TypeStyle>): Map<string, string> {
  const seen = new Map<string, string>();
  for (const style of Object.values(typography)) {
    if (!style.fontFamily) continue;
    const stack = style.fontFamily;
    const first = stack.split(",")[0]?.trim() ?? "";
    // "SF Pro Display" -> display, "SF Pro Text" -> text
    const name = first.toLowerCase().includes("display") ? "display" : "text";
    if (!seen.has(name)) seen.set(name, stack);
  }
  return seen;
}

function quoteStack(stack: string): string {
  return stack
    .split(",")
    .map((part) => {
      const t = part.trim();
      return /\s/.test(t) && !t.startsWith('"') ? `"${t}"` : t;
    })
    .join(", ");
}

function build(design: Design): string {
  const lines: string[] = [];
  const out = (s = "") => lines.push(s);

  out("/* GENERATED FILE — do not edit by hand.");
  out(" * Source: DESIGN.md frontmatter. Regenerate with `pnpm tokens`.");
  out(" * Editing this file directly will be overwritten and breaks CLAUDE.md rule 1.");
  out(" */");
  out();
  out('@import "tailwindcss";');
  out();
  out("@theme {");

  // ---- fonts ----------------------------------------------------------------
  out("  /* Font stacks. system-ui/-apple-system leads so Apple hardware gets real");
  out("   * SF Pro and never loads a webfont. Inter is the documented fallback.");
  out("   * See ANTI_SLOP.md §6 for why Inter here is not the Inter slop tell. */");
  for (const [name, stack] of fontFamilies(design.typography)) {
    out(`  --font-${name}: ${quoteStack(stack)};`);
  }
  out("  --font-mono: ui-monospace, \"SF Mono\", \"JetBrains Mono\", Menlo, monospace;");
  out(
    "  --font-cjk: \"Noto Sans SC\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif;",
  );
  out();

  // ---- colors ---------------------------------------------------------------
  out("  /* Colors. One accent only: --color-primary. No second accent exists,");
  out("   * and no gradient token exists. Both are load-bearing. */");
  for (const [name, value] of Object.entries(design.colors)) {
    out(`  --color-${name}: ${value};`);
  }
  out();
  out("  /* Contrast correction, ANTI_SLOP.md §5. ink-muted-48 on parchment measures");
  out("   * 3.9:1 and fails WCAG AA, but DESIGN.md assigns it to legal fine-print.");
  out("   * Fine-print uses this alias instead; ink-muted-48 is now disabled-only. */");
  out("  --color-fine-print: var(--color-ink-muted-80);");
  out();

  // ---- typography -----------------------------------------------------------
  out("  /* Type scale. Each style emits size + its bound line-height, tracking and");
  out("   * weight, so `text-body` carries all four and they cannot drift apart. */");
  for (const [name, style] of Object.entries(design.typography)) {
    const size = toRem(style.fontSize);
    if (!size) continue;
    out(`  --text-${name}: ${size};`);
    if (style.lineHeight !== undefined) {
      out(`  --text-${name}--line-height: ${style.lineHeight};`);
    }
    const tracking = toEm(style.letterSpacing, style.fontSize);
    if (tracking) out(`  --text-${name}--letter-spacing: ${tracking};`);
    if (style.fontWeight !== undefined) {
      out(`  --text-${name}--font-weight: ${style.fontWeight};`);
    }
  }
  out();

  // ---- spacing --------------------------------------------------------------
  out("  /* Spacing. The 17 and the 80 are the two values that mark this scale as");
  out("   * chosen by a person rather than averaged by a model. Do not round them. */");
  for (const [name, value] of Object.entries(design.spacing)) {
    const rem = toRem(value);
    if (rem) out(`  --spacing-${name}: ${rem};`);
  }
  out();

  // ---- radius ---------------------------------------------------------------
  out("  /* Radius. Six distinct values with assigned jobs — uniform radius across");
  out("   * every element is a slop tell. Never invent a seventh. */");
  for (const [name, value] of Object.entries(design.rounded)) {
    const n = px(value);
    if (n === null) continue;
    out(`  --radius-${name}: ${n >= 9999 ? "9999px" : `${n}px`};`);
  }
  out();

  // ---- component metrics ----------------------------------------------------
  // DESIGN.md gives per-component padding and heights that deliberately fall off
  // the spacing scale — the primary pill is 11px x 22px, the nav is 44px tall.
  // Without these as tokens every component would hardcode a px value and
  // CLAUDE.md rule 1 would be dead on arrival. So they are emitted too.
  const components = design.components ?? {};
  const metricLines: string[] = [];
  for (const [name, spec] of Object.entries(components)) {
    if (typeof spec.padding === "string") {
      // "11px 22px" -> y, x. A single value applies to both axes, as in CSS.
      const parts = spec.padding.trim().split(/\s+/);
      const y = toRem(parts[0] ?? "");
      const x = toRem(parts[1] ?? parts[0] ?? "");
      if (y) metricLines.push(`  --spacing-${name}-y: ${y};`);
      if (x) metricLines.push(`  --spacing-${name}-x: ${x};`);
    }
    for (const key of ["height", "size"] as const) {
      const rem = toRem(spec[key]);
      if (rem) metricLines.push(`  --spacing-${name}-${key}: ${rem};`);
    }
  }
  if (metricLines.length > 0) {
    out("  /* Per-component metrics from the `components:` block. These exist so that");
    out("   * no component file has to write a px value of its own. */");
    for (const line of metricLines) out(line);
    out();
  }

  // ---- shadow ---------------------------------------------------------------
  out("  /* The only shadow in the system. DESIGN.md is explicit that it belongs to");
  out("   * product imagery resting on a surface — never a card, button, or text.");
  out("   * Here the artefact is code, per ANTI_SLOP.md §1. */");
  out("  --shadow-artifact: 3px 5px 30px 0 rgb(0 0 0 / 0.22);");
  out("}");
  out();

  // ---- base -----------------------------------------------------------------
  out("@layer base {");
  out("  html {");
  out("    font-family: var(--font-text);");
  out("    color: var(--color-ink);");
  out("    background-color: var(--color-canvas);");
  out("    -webkit-font-smoothing: antialiased;");
  out("  }");
  out();
  out("  /* CJK has no SF Pro glyphs. Looser leading, and tracking reset to zero —");
  out("   * negative tracking on Han characters collides them. CLAUDE.md language rules. */");
  out("  :lang(zh-Hans) {");
  out("    font-family: var(--font-cjk);");
  out("    line-height: 1.8;");
  out("    letter-spacing: 0;");
  out("  }");
  out();
  out("  /* BUILD_PLAN.md §15 requires this. */");
  out("  @media (prefers-reduced-motion: reduce) {");
  out("    *,");
  out("    *::before,");
  out("    *::after {");
  out("      animation-duration: 0.01ms !important;");
  out("      animation-iteration-count: 1 !important;");
  out("      transition-duration: 0.01ms !important;");
  out("      scroll-behavior: auto !important;");
  out("    }");
  out("  }");
  out();
  out("  /* Focus ring, DESIGN.md: 2px solid primary-focus. Visible on every");
  out("   * interactive element — §15 keyboard navigation requirement. */");
  out("  :focus-visible {");
  out("    outline: 2px solid var(--color-primary-focus);");
  out("    outline-offset: 2px;");
  out("  }");
  out("}");
  out();

  return lines.join("\n");
}

const design = readFrontmatter(DESIGN_MD);
const css = build(design);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, css, "utf8");

const counts = {
  colors: Object.keys(design.colors).length,
  type: Object.keys(design.typography).length,
  spacing: Object.keys(design.spacing).length,
  radius: Object.keys(design.rounded).length,
  components: Object.keys(design.components ?? {}).length,
};
console.log(
  `tokens.css written — ${counts.colors} colors, ${counts.type} type styles, ` +
    `${counts.spacing} spacing steps, ${counts.radius} radii, ` +
    `${counts.components} component specs`,
);
