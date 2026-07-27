/**
 * ANTI_SLOP.md §7 as a build gate.
 *
 * Anti-slop only survives contact with a deadline if a machine enforces it. The
 * study behind ANTI_SLOP.md measured 1,590 sites with deterministic DOM and CSS
 * checks and no model judgement, and that is the standard here: every rule below
 * either fails on a literal pattern or is not in this file.
 *
 * Rules a machine cannot check honestly — "is this card differentiated by real
 * data", "does this read in Amin's voice" — stay in the human checklist in
 * BUILD_PLAN.md §15 rather than being faked with a regex.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Violation {
  file: string;
  line: number;
  rule: string;
  detail: string;
}

const violations: Violation[] = [];

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, exts));
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function report(file: string, line: number, rule: string, detail: string) {
  violations.push({ file: relative(ROOT, file).split(sep).join("/"), line, rule, detail });
}

/**
 * Returns the file's lines with all comment bodies blanked out, line numbering
 * preserved. This matters more than it looks: the comments in this codebase
 * quote the very values they forbid — site-footer.tsx explains why #7a7a7a was
 * rejected — and a checker that flags its own rationale is a checker people
 * start passing with `// eslint-disable`-style workarounds.
 */
function codeLines(source: string): string[] {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
    // Keep the newlines so every later line keeps its real number.
    block.replace(/[^\n]/g, " "),
  );
  return withoutBlocks.split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, ""));
}

// ---------------------------------------------------------------------------
// 1. No hardcoded design values in components.
//    CLAUDE.md rule 1: everything goes through tokens derived from DESIGN.md.
// ---------------------------------------------------------------------------

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const ARBITRARY = /\[(?:-?\d*\.?\d+(?:px|rem|em)|#[0-9a-fA-F]{3,8})\]/;
const FONT_FAMILY = /font-family\s*:/;
const RAW_PX = /:\s*-?\d*\.?\d+px\b/;

for (const file of walk(join(ROOT, "components"), [".tsx", ".ts"])) {
  codeLines(readFileSync(file, "utf8")).forEach((code, index) => {
    const at = index + 1;
    if (HEX.test(code)) report(file, at, "hardcoded-hex", code.trim());
    if (ARBITRARY.test(code)) report(file, at, "arbitrary-value", code.trim());
    if (FONT_FAMILY.test(code)) {
      report(file, at, "hardcoded-font-family", code.trim());
    }
    if (RAW_PX.test(code)) report(file, at, "hardcoded-px", code.trim());
  });
}

// ---------------------------------------------------------------------------
// 2. No gradients anywhere.
//    DESIGN.md defines zero gradient tokens. Slop pattern #7 is gradients on
//    backgrounds, borders and text at once; the defence is that the system has
//    no gradient to reach for in the first place.
// ---------------------------------------------------------------------------

const GRADIENT = /(linear-gradient|radial-gradient|conic-gradient|bg-gradient-to-|from-\[|via-\[)/;

for (const file of [
  ...walk(join(ROOT, "components"), [".tsx", ".ts"]),
  ...walk(join(ROOT, "app"), [".tsx", ".ts", ".css"]),
]) {
  codeLines(readFileSync(file, "utf8")).forEach((code, index) => {
    if (GRADIENT.test(code)) report(file, index + 1, "gradient", code.trim());
  });
}

// ---------------------------------------------------------------------------
// 3. No emoji in UI strings or category icons.
//    Slop pattern #15. Emoji as iconography also breaks the CJK font stack,
//    which matters more here than on a monolingual site.
// ---------------------------------------------------------------------------

/**
 * Emoji-presentation characters, plus text characters forced into emoji form
 * with VS16. Not bare Extended_Pictographic — that property also covers ©, ® and
 * ™, which are typography rather than iconography and belong in a footer.
 */
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/u;

for (const file of [
  ...walk(join(ROOT, "messages"), [".json"]),
  ...walk(join(ROOT, "components"), [".tsx"]),
  ...walk(join(ROOT, "app"), [".tsx"]),
]) {
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((text, index) => {
      if (EMOJI.test(text)) report(file, index + 1, "emoji-in-ui", text.trim());
    });
}

// ---------------------------------------------------------------------------
// 4. Banned layout patterns.
//    Slop patterns #10 (badge above H1) and #11 (coloured left-border card).
// ---------------------------------------------------------------------------

const BORDER_LEFT_ACCENT = /border-l-\d|border-l-\[/;

for (const file of [
  ...walk(join(ROOT, "components"), [".tsx"]),
  ...walk(join(ROOT, "app"), [".tsx"]),
]) {
  codeLines(readFileSync(file, "utf8")).forEach((code, index) => {
    if (BORDER_LEFT_ACCENT.test(code)) {
      report(file, index + 1, "left-border-card", code.trim());
    }
  });
}

// ---------------------------------------------------------------------------
// 5. tokens.css must be generated, not hand-edited.
// ---------------------------------------------------------------------------

const tokensPath = join(ROOT, "app", "tokens.css");
try {
  const header = readFileSync(tokensPath, "utf8").slice(0, 200);
  if (!header.includes("GENERATED FILE")) {
    report(tokensPath, 1, "tokens-not-generated", "run `pnpm tokens`");
  }
} catch {
  report(tokensPath, 1, "tokens-missing", "run `pnpm tokens`");
}

// ---------------------------------------------------------------------------

if (violations.length === 0) {
  console.log("check:slop — clean");
  process.exit(0);
}

console.error(`check:slop — ${violations.length} violation(s)\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.rule}]`);
  console.error(`    ${v.detail.slice(0, 120)}`);
}
console.error("\nSee ANTI_SLOP.md for why each of these is a rule.");
process.exit(1);
