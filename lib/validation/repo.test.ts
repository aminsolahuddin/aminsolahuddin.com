import assert from "node:assert/strict";
import { test } from "node:test";

import {
  caveatWarnings,
  githubUrlFor,
  ownerShape,
  repoNameShape,
  repoSchema,
} from "./repo.ts";

const FULL = {
  oneLiner: "A Postgres client for Node that does not pretend to be an ORM.",
  forWhom: "People who already write SQL and want it back.",
  notForYouIf: "You want migrations and a schema DSL in the same package.",
  theCatch: "No connection pooling story for serverless without extra work.",
};

test("a complete entry produces no warnings", () => {
  assert.deepEqual(caveatWarnings(FULL), []);
});

test("the two fields §3 names are each their own warning", () => {
  assert.deepEqual(
    caveatWarnings({ ...FULL, notForYouIf: "" }).map((w) => w.code),
    ["no-caveat"],
  );
  assert.deepEqual(
    caveatWarnings({ ...FULL, theCatch: "   " }).map((w) => w.code),
    ["restates-readme"],
  );
});

test("warnings arrive together, not one save at a time", () => {
  const codes = caveatWarnings({ oneLiner: FULL.oneLiner }).map((w) => w.code);
  assert.deepEqual(new Set(codes), new Set(["no-caveat", "restates-readme", "no-audience"]));
});

test("a one-liner too short to say anything is flagged", () => {
  assert.deepEqual(
    caveatWarnings({ ...FULL, oneLiner: "A Postgres client." }).map((w) => w.code),
    ["restates-readme"],
  );

  // Empty is the publish check's problem, not this one's. Reporting both would
  // put two messages on one field and neither would say what to do.
  assert.deepEqual(caveatWarnings({ ...FULL, oneLiner: "" }), []);
});

test("a draft may be as incomplete as it likes", () => {
  // The whole point of a draft. Refusing to save one until the caveats exist is
  // how you end up with a space typed into every box.
  const result = repoSchema.safeParse({
    owner: "porsager",
    name: "postgres",
    contentStatus: "draft",
    translations: [{ locale: "en", oneLiner: "" }],
  });

  assert.equal(result.success, true);
});

test("publishing an entry that restates the README needs the override", () => {
  const base = {
    owner: "porsager",
    name: "postgres",
    contentStatus: "published" as const,
    translations: [{ locale: "en", oneLiner: FULL.oneLiner }],
  };

  assert.equal(repoSchema.safeParse(base).success, false);
  assert.equal(repoSchema.safeParse({ ...base, caveatOverride: true }).success, true);
});

test("publishing without an English one-liner is refused", () => {
  const result = repoSchema.safeParse({
    owner: "porsager",
    name: "postgres",
    contentStatus: "published",
    caveatOverride: true,
    translations: [{ locale: "ms", oneLiner: "Klien Postgres untuk Node." }],
  });

  assert.equal(result.success, false);
  assert.match(
    result.error?.issues.map((i) => i.message).join(" ") ?? "",
    /English one-liner is required/,
  );
});

test("superseded without a replacement is refused, override or not", () => {
  const result = repoSchema.safeParse({
    owner: "facebook",
    name: "create-react-app",
    status: "superseded",
    contentStatus: "published",
    caveatOverride: true,
    translations: [{ locale: "en", ...FULL }],
  });

  assert.equal(result.success, false);
  assert.match(
    result.error?.issues.map((i) => i.message).join(" ") ?? "",
    /Superseded by what/,
  );
});

test("owner and name follow GitHub's rules, not ours", () => {
  for (const owner of ["facebook", "drizzle-team", "a", "0xProject"]) {
    assert.equal(ownerShape.safeParse(owner).success, true, owner);
  }
  for (const owner of ["-facebook", "facebook-", "face book", "face--book", ""]) {
    assert.equal(ownerShape.safeParse(owner).success, false, owner);
  }

  // Dots and underscores are legal in a name and not in an owner, which is how
  // next.js exists. A single rule for both would reject it.
  for (const name of ["next.js", "create-react-app", "some_lib", "postgres"]) {
    assert.equal(repoNameShape.safeParse(name).success, true, name);
  }
  for (const name of ["next js", "owner/name", ".", "..", ""]) {
    assert.equal(repoNameShape.safeParse(name).success, false, name);
  }
});

test("the GitHub URL is derived, so it cannot disagree with the name", () => {
  assert.equal(githubUrlFor("vercel", "next.js"), "https://github.com/vercel/next.js");
});
