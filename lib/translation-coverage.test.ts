import assert from "node:assert/strict";
import { test } from "node:test";

import { coverage } from "./translation-coverage.ts";

const EN = {
  nav: { home: "Home", tools: "Tools" },
  tools: { indexTitle: "Tools", empty: "Nothing listed here yet." },
  meta: { siteName: "Amin Solahuddin" },
};

test("a full translation is complete", () => {
  const result = coverage(EN, {
    nav: { home: "Laman utama", tools: "Alat" },
    tools: { indexTitle: "Alat", empty: "Belum ada apa-apa di sini." },
    meta: { siteName: "Amin Solahuddin" },
  });

  assert.equal(result.total, 5);
  assert.equal(result.translated, 5);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.untouchedNamespaces, []);
});

test("an empty file is zero, not one hundred", () => {
  const result = coverage(EN, {});

  assert.equal(result.total, 5);
  assert.equal(result.translated, 0);
  assert.equal(result.missing.length, 5);
  assert.deepEqual(result.untouchedNamespaces, ["nav", "tools", "meta"]);
});

/**
 * ms.json and zh-Hans.json each carry a `_note` explaining why they are empty.
 * A note about the absence of translations is not a translation.
 */
test("keys English does not have are not credit", () => {
  const result = coverage(EN, { _note: "Deliberately empty." });

  assert.equal(result.translated, 0);
  assert.equal(result.total, 5);
});

/**
 * i18n/request.ts treats "" as absent and merges English underneath, so an empty
 * string renders English. Counting it as done would report the opposite of what
 * a reader sees.
 */
test("an empty string renders English, so it is not translated", () => {
  const result = coverage(EN, {
    nav: { home: "", tools: "   " },
    tools: { indexTitle: "Alat", empty: "Belum ada." },
    meta: { siteName: "Amin Solahuddin" },
  });

  assert.equal(result.translated, 3);
  assert.deepEqual(result.missing, ["nav.home", "nav.tools"]);
  assert.deepEqual(result.untouchedNamespaces, ["nav"]);
});

test("a namespace nobody has started is named as one", () => {
  const result = coverage(EN, {
    nav: { home: "Laman utama", tools: "Alat" },
    meta: { siteName: "Amin Solahuddin" },
  });

  assert.deepEqual(result.untouchedNamespaces, ["tools"]);
  assert.deepEqual(result.missing, ["tools.indexTitle", "tools.empty"]);
});

test("a half-done namespace is a gap, not an untouched one", () => {
  const result = coverage(EN, {
    nav: { home: "Laman utama", tools: "Alat" },
    tools: { indexTitle: "Alat" },
    meta: { siteName: "Amin Solahuddin" },
  });

  assert.deepEqual(result.untouchedNamespaces, []);
  assert.deepEqual(result.missing, ["tools.empty"]);
});

test("missing paths keep the order English declares them in", () => {
  const result = coverage(EN, {});
  assert.deepEqual(result.missing, [
    "nav.home",
    "nav.tools",
    "tools.indexTitle",
    "tools.empty",
    "meta.siteName",
  ]);
});
