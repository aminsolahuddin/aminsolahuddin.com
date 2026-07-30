import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveStatus } from "./derive-status.ts";

const NOW = new Date("2026-07-30T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

test("the archived flag wins over everything GitHub says about commits", () => {
  assert.equal(
    deriveStatus("maintained", { archived: true, pushedAt: daysAgo(1) }, NOW),
    "archived",
  );
});

test("no commit in twelve months is slowing, eleven is not", () => {
  assert.equal(
    deriveStatus("maintained", { archived: false, pushedAt: daysAgo(400) }, NOW),
    "slowing",
  );
  assert.equal(
    deriveStatus("maintained", { archived: false, pushedAt: daysAgo(330) }, NOW),
    "maintained",
  );
});

test("superseded is never derived away from", () => {
  // §7 says the job may not promote into superseded. The reverse matters just as
  // much: a replaced project has usually also stopped getting commits, so the
  // twelve-month rule would demote a human's judgement to "slowing" and lose the
  // only fact in the row a person put there.
  for (const facts of [
    { archived: true, pushedAt: daysAgo(1) },
    { archived: false, pushedAt: daysAgo(900) },
    { archived: false, pushedAt: daysAgo(1) },
    { archived: false, pushedAt: null },
  ]) {
    assert.equal(deriveStatus("superseded", facts, NOW), "superseded");
  }
});

test("the job never derives into superseded", () => {
  for (const facts of [
    { archived: true, pushedAt: daysAgo(900) },
    { archived: false, pushedAt: daysAgo(900) },
    { archived: false, pushedAt: daysAgo(1) },
  ]) {
    assert.notEqual(deriveStatus("maintained", facts, NOW), "superseded");
  }
});

test("fresh commits do come back out of archived", () => {
  // Rare but real, and a commit last week is positive evidence rather than the
  // absence of a flag. Leaving the badge on a project that has restarted is the
  // same failure as leaving it off one that has stopped.
  assert.equal(
    deriveStatus("archived", { archived: false, pushedAt: daysAgo(5) }, NOW),
    "maintained",
  );
});

test("an unflagged dead repo keeps the status a human gave it", () => {
  /**
   * The case that running this against real data exposed.
   *
   * facebook/create-react-app is deprecated in its own README and has had no
   * commit since February 2025, but GitHub's archived flag is false — plenty of
   * dead projects never get it flipped. Returning "maintained" whenever the flag
   * is false downgraded a considered "archived" to "slowing" on the first Sunday,
   * and would have done it again every Sunday after the correction.
   */
  assert.equal(
    deriveStatus("archived", { archived: false, pushedAt: daysAgo(500) }, NOW),
    "archived",
  );

  // And it still raises doubt from below, which is the direction it has evidence
  // for: nobody said this one was fine, the clock did.
  assert.equal(
    deriveStatus("maintained", { archived: false, pushedAt: daysAgo(500) }, NOW),
    "slowing",
  );
});

test("a repo with no pushed_at moves nowhere", () => {
  // An empty repository reports null. Neither direction has evidence, so a
  // missing date must not be read as either life or death.
  assert.equal(
    deriveStatus("maintained", { archived: false, pushedAt: null }, NOW),
    "maintained",
  );
  assert.equal(
    deriveStatus("archived", { archived: false, pushedAt: null }, NOW),
    "archived",
  );
});
