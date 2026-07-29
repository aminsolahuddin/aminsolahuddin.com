import assert from "node:assert/strict";
import { test } from "node:test";

import { packSchema, slugShape, slugWarnings } from "./pack.ts";

test("a good slug produces no warnings", () => {
  for (const slug of ["docker-fix", "react-auth", "next-i18n", "atuin"]) {
    assert.deepEqual(slugWarnings(slug), [], slug);
  }
});

test("warnings are reported together, not one at a time", () => {
  // Long, has a digit, and three words. §5 asks for one informed override
  // rather than three rounds of trial and error.
  const codes = slugWarnings("nextjs-15-authentication-guide").map((w) => w.code);
  assert.deepEqual(new Set(codes), new Set(["too-long", "has-digits", "too-many-words"]));
});

test("a loose number is a warning, not a rejection", () => {
  // `nextjs-15` dates the URL and is easy to mishear, but it is sayable and a
  // person may still mean it. §5 says confirm, not refuse.
  const warnings = slugWarnings("nextjs-15");
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.code, "has-digits");
  assert.equal(slugShape.safeParse("nextjs-15").success, true);
});

test("numeronyms are not loose numbers", () => {
  // §5 lists next-i18n as a good slug. A flat /\d/ check flags it, which is how
  // this rule was wrong the first time: digits enclosed by letters are read as
  // one word, digits standing alone are a version number.
  for (const slug of ["next-i18n", "a11y-audit", "k8s-logs", "l10n"]) {
    assert.deepEqual(slugWarnings(slug), [], slug);
  }

  for (const slug of ["react-19", "vue-3", "nextjs-15"]) {
    assert.deepEqual(
      slugWarnings(slug).map((w) => w.code),
      ["has-digits"],
      slug,
    );
  }
});

test("shapes that could never resolve are rejected outright", () => {
  for (const slug of [
    "Docker-Fix", // uppercase
    "docker fix", // space
    "docker--fix", // doubled hyphen
    "-docker", // leading hyphen
    "docker-", // trailing hyphen
    "1docker", // leading digit
    "docker/fix", // path separator
    "",
  ]) {
    assert.equal(slugShape.safeParse(slug).success, false, slug);
  }
});

test("publishing without an English title is refused", () => {
  const result = packSchema.safeParse({
    slug: "docker-fix",
    status: "published",
    translations: [{ locale: "ms", title: "Pembaikan Docker" }],
  });

  assert.equal(result.success, false);
  assert.match(
    result.error?.issues.map((i) => i.message).join(" ") ?? "",
    /English title is required/,
  );
});

test("a draft may be as incomplete as it likes", () => {
  const result = packSchema.safeParse({
    slug: "docker-fix",
    status: "draft",
    translations: [],
  });

  assert.equal(result.success, true);
});

test("a warned slug needs the override, and the override is enough", () => {
  const base = {
    slug: "nextjs-15-authentication-guide",
    status: "draft" as const,
    translations: [],
  };

  assert.equal(packSchema.safeParse(base).success, false);
  assert.equal(
    packSchema.safeParse({ ...base, slugOverride: true }).success,
    true,
  );
});
