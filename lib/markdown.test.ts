import assert from "node:assert/strict";
import { test } from "node:test";

// Runs under --conditions react-server, which resolves the "server-only" import
// to its empty module. Without that flag the package throws on import by design.
import { renderMarkdown } from "./markdown.ts";

/**
 * These are the tests that matter most in this file, because the failure they
 * guard against is silent and permanent.
 *
 * There is one admin account, so the threat is not a hostile author — it is a
 * stolen session. Stored XSS in a post body runs on every reader's browser and
 * keeps running long after the intrusion itself is over.
 */
test("script tags are dropped, their text is not", async () => {
  const html = await renderMarkdown("Hello <script>alert(1)</script> world");
  assert.equal(html.includes("<script"), false);
  assert.match(html, /Hello/);
});

test("event handlers cannot ride in on an element", async () => {
  const html = await renderMarkdown(`<img src=x onerror="alert(1)">`);
  assert.equal(html.includes("onerror"), false);
});

test("javascript: URLs lose their href rather than the link losing its text", async () => {
  const html = await renderMarkdown("[click](javascript:alert(1))");
  assert.equal(html.includes("javascript:"), false);
  assert.match(html, /click/);
});

test("author-supplied style attributes are refused", async () => {
  // The reason the sanitizer runs before Shiki. An allowlist that permits
  // arbitrary style is one an author can use to cover the page with a
  // positioned overlay — and Shiki needs hundreds of style attributes of its own.
  const html = await renderMarkdown(`<p style="position:fixed;inset:0">x</p>`);
  assert.equal(html.includes("position:fixed"), false);
});

test("iframes do not survive", async () => {
  const html = await renderMarkdown(`<iframe src="https://evil.example"></iframe>`);
  assert.equal(html.includes("<iframe"), false);
});

test("ordinary links keep their href", async () => {
  const html = await renderMarkdown("[atuin](https://github.com/atuinsh/atuin)");
  assert.match(html, /href="https:\/\/github\.com\/atuinsh\/atuin"/);
});

test("GFM tables render, because developers write them without thinking", async () => {
  const html = await renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
  assert.match(html, /<table>/);
  assert.match(html, /<th>a<\/th>/);
});

test("fenced code is highlighted in both themes", async () => {
  const html = await renderMarkdown("```ts\nconst x: number = 1;\n```");
  // Shiki's dual-theme output carries the dark values as custom properties, so
  // one render serves both colour schemes with no client-side theme swap.
  assert.match(html, /shiki-themes/);
  assert.match(html, /--shiki-dark/);
});

test("an unknown language degrades to plain text instead of throwing", async () => {
  // A post must never fail to render because of a typo in a fence.
  const html = await renderMarkdown("```zzznotalang\nplain\n```");
  assert.match(html, /<pre/);
  assert.match(html, /plain/);
});

test("empty input is an empty string, not a throw", async () => {
  // So a caller can pass a nullable column straight through.
  assert.equal(await renderMarkdown(null), "");
  assert.equal(await renderMarkdown("   "), "");
});
