import assert from "node:assert/strict";
import { test } from "node:test";

import { caveatWarnings } from "./caveats.ts";

/** An entry with every §3 field written. The baseline the other cases deviate from. */
const complete = {
  oneLiner: "Replays your shell history across machines, encrypted",
  forWhom: "Anyone who works on more than one machine and keeps losing commands",
  notForYouIf: "You only ever use one laptop and never reinstall it",
  theCatch: "The sync server is another service to run, or you trust theirs",
};

test("a fully written entry warns about nothing", () => {
  assert.deepEqual(caveatWarnings(complete), []);
});

test("an empty entry reports all three §3 fields at once", () => {
  // Same reasoning as the slug warnings: one informed pass over the form beats
  // three rounds of save-and-discover.
  const warnings = caveatWarnings({});
  assert.deepEqual(
    new Set(warnings.map((w) => w.field)),
    new Set(["notForYouIf", "theCatch", "forWhom"]),
  );
});

test("an empty one-liner is left to the publish check", () => {
  // Deliberate, and the module says so: the field is already required to save,
  // so warning here would put two messages on one input and neither would tell
  // you what to type.
  assert.equal(
    caveatWarnings({}).some((w) => w.field === "oneLiner"),
    false,
  );
});

test("whitespace does not count as having written the caveat", () => {
  // The failure the warning exists to catch is an entry that reads as finished
  // in the list and says nothing on the page. A space in the box produces
  // exactly that, and is the cheapest way to make a nagging form go quiet.
  const warnings = caveatWarnings({
    ...complete,
    notForYouIf: "   ",
    theCatch: "\n\t ",
  });
  assert.deepEqual(
    new Set(warnings.map((w) => w.field)),
    new Set(["notForYouIf", "theCatch"]),
  );
});

test("a thin one-liner is measured at 25 characters", () => {
  // The boundary itself, from both sides. A threshold nothing pins down is one
  // that drifts the next time someone reads the constant and guesses.
  const under = "Encrypted shell history"; // 23
  const at = "Encrypted shell history !"; // 25

  assert.equal(under.length, 23);
  assert.equal(at.length, 25);

  assert.deepEqual(
    caveatWarnings({ ...complete, oneLiner: under }).map((w) => w.field),
    ["oneLiner"],
  );
  assert.deepEqual(caveatWarnings({ ...complete, oneLiner: at }), []);
});

test("the thin one-liner message quotes the length it measured", () => {
  // So the writer knows how much more is wanted rather than guessing at "longer".
  const warnings = caveatWarnings({ ...complete, oneLiner: "atuin" });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]?.message ?? "", /^5 characters\./);
});

test("length is measured after trimming, not before", () => {
  // Otherwise padding a short line with spaces silences the warning while the
  // rendered page still shows the same five words.
  const warnings = caveatWarnings({
    ...complete,
    oneLiner: "   atuin                          ",
  });
  assert.deepEqual(
    warnings.map((w) => w.field),
    ["oneLiner"],
  );
});

test("each field keeps the code the admin form styles it by", () => {
  // The form reads `code`, not `field`, so a code moving between fields is a
  // silent restyling rather than a visible break.
  const byField = new Map(caveatWarnings({}).map((w) => [w.field, w.code]));
  assert.equal(byField.get("notForYouIf"), "no-caveat");
  assert.equal(byField.get("forWhom"), "no-audience");
  assert.equal(byField.get("theCatch"), "restates-readme");
});
