import assert from "node:assert/strict";
import { test } from "node:test";

import { toolSchema, toolWarnings } from "./tool.ts";

const FULL = {
  name: "Neon",
  vendor: "Neon Inc.",
  canonicalUrl: "https://neon.com",
  affiliateUrl: null,
  personallyUsed: true,
  categoryId: null,
  sortOrder: 10,
  translations: [
    {
      locale: "en" as const,
      whyIUseIt: "Postgres that scales to zero, so an idle site costs nothing.",
      caveat: "Cold starts are real. The first query after an idle period is slow.",
    },
  ],
};

const TEXT = {
  whyIUseIt: FULL.translations[0]!.whyIUseIt,
  caveat: FULL.translations[0]!.caveat,
};

const USED = { personallyUsed: true, affiliateUrl: "" };

// ---------------------------------------------------------------------------
// warnings
// ---------------------------------------------------------------------------

test("a complete tool produces no warnings", () => {
  assert.deepEqual(toolWarnings(TEXT, USED), []);
});

test("each empty prose field is its own warning", () => {
  assert.deepEqual(
    toolWarnings({ ...TEXT, whyIUseIt: "" }, USED).map((w) => w.code),
    ["no-reason"],
  );
  assert.deepEqual(
    toolWarnings({ ...TEXT, caveat: "   " }, USED).map((w) => w.code),
    ["no-caveat"],
  );
});

test("a paid link on a tool nobody has run is warned about early", () => {
  assert.deepEqual(
    toolWarnings(TEXT, {
      personallyUsed: false,
      affiliateUrl: "https://example.com/?ref=amin",
    }).map((w) => w.code),
    ["paid-and-unused"],
  );
});

test("either half of that alone is fine", () => {
  assert.deepEqual(
    toolWarnings(TEXT, { personallyUsed: false, affiliateUrl: "" }),
    [],
  );
  assert.deepEqual(
    toolWarnings(TEXT, {
      personallyUsed: true,
      affiliateUrl: "https://example.com/?ref=amin",
    }),
    [],
  );
});

test("warnings arrive together rather than one save at a time", () => {
  const codes = toolWarnings(
    {},
    { personallyUsed: false, affiliateUrl: "https://example.com/?ref=amin" },
  ).map((w) => w.code);

  assert.deepEqual(
    new Set(codes),
    new Set(["no-reason", "no-caveat", "paid-and-unused"]),
  );
});

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

test("a complete tool parses", () => {
  const parsed = toolSchema.safeParse(FULL);
  assert.equal(parsed.success, true);
});

test("empty prose still saves — a tool has no draft to be unfinished in", () => {
  const parsed = toolSchema.safeParse({
    ...FULL,
    translations: [{ locale: "en", whyIUseIt: "", caveat: "" }],
  });
  assert.equal(parsed.success, true);
});

test("a name is required", () => {
  const parsed = toolSchema.safeParse({ ...FULL, name: "   " });
  assert.equal(parsed.success, false);
});

/**
 * The check that matters most here. Both URL columns are rendered into an href
 * on a public page, and `javascript:` is a URL the constructor is perfectly
 * happy with.
 */
test("a URL a browser would execute is not a URL", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,x", "ftp://a.com"]) {
    assert.equal(
      toolSchema.safeParse({ ...FULL, canonicalUrl: url }).success,
      false,
      url,
    );
    assert.equal(
      toolSchema.safeParse({ ...FULL, affiliateUrl: url }).success,
      false,
      url,
    );
  }
});

test("an affiliate URL that is the canonical URL is not an affiliate link", () => {
  const parsed = toolSchema.safeParse({
    ...FULL,
    affiliateUrl: FULL.canonicalUrl,
  });

  assert.equal(parsed.success, false);
  assert.equal(
    parsed.success ? "" : parsed.error.issues[0]?.path.join("."),
    "affiliateUrl",
  );
});

test("no affiliate URL is the ordinary case", () => {
  const parsed = toolSchema.safeParse({ ...FULL, affiliateUrl: null });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success ? parsed.data.affiliateUrl : "x", null);
});

/**
 * Settled 6 August 2026: no commission on a tool that has not been run.
 *
 * The banner on /tools says "I only link tools I have used" and §3's marker says
 * "not used personally". Both appear on one screen the moment this combination
 * saves, and a disclosure a reader can catch contradicting itself is worth less
 * than none.
 */
test("a paid link on a tool nobody has run is refused, not warned", () => {
  const parsed = toolSchema.safeParse({
    ...FULL,
    personallyUsed: false,
    affiliateUrl: "https://example.com/?ref=amin",
  });

  assert.equal(parsed.success, false);
  assert.equal(
    parsed.success ? "" : parsed.error.issues[0]?.path.join("."),
    "affiliateUrl",
  );
});

test("either half alone still saves", () => {
  assert.equal(
    toolSchema.safeParse({ ...FULL, personallyUsed: false, affiliateUrl: null })
      .success,
    true,
  );
  assert.equal(
    toolSchema.safeParse({
      ...FULL,
      personallyUsed: true,
      affiliateUrl: "https://example.com/?ref=amin",
    }).success,
    true,
  );
});
