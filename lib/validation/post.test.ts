import assert from "node:assert/strict";
import { test } from "node:test";

import { postSchema, postSlugShape } from "./post.ts";
import { slugWarnings } from "./pack.ts";

const BODY = "Some words that make up an actual post body.";

test("a draft may be as incomplete as it likes", () => {
  const result = postSchema.safeParse({
    slug: "a-post",
    status: "draft",
    translations: [],
  });
  assert.equal(result.success, true);
});

test("publishing needs an English title and an English body", () => {
  const titleOnly = postSchema.safeParse({
    slug: "a-post",
    status: "published",
    translations: [{ locale: "en", title: "A post" }],
  });
  assert.equal(titleOnly.success, false);
  assert.match(
    titleOnly.error?.issues.map((i) => i.message).join(" ") ?? "",
    /no English body/,
  );

  const complete = postSchema.safeParse({
    slug: "a-post",
    status: "published",
    translations: [{ locale: "en", title: "A post", bodyMd: BODY }],
  });
  assert.equal(complete.success, true);
});

test("a Malay post cannot be published without the English it falls back to", () => {
  const result = postSchema.safeParse({
    slug: "a-post",
    status: "published",
    translations: [{ locale: "ms", title: "Satu pos", bodyMd: BODY }],
  });
  assert.equal(result.success, false);
  assert.match(
    result.error?.issues.map((i) => i.message).join(" ") ?? "",
    /English title is required/,
  );
});

test("post slugs may be long and descriptive, unlike pack slugs", () => {
  /**
   * The distinction this file exists to draw. §5's slug rules — two words, no
   * loose numbers, short enough to say once — are about a slug being spoken
   * aloud in a video. A post slug is read, linked and searched instead.
   */
  const slug = "why-the-sync-job-writes-facts-but-not-prose";

  assert.equal(postSlugShape.safeParse(slug).success, true);
  // The same slug would collect warnings under the pack rules, which is exactly
  // why posts do not inherit them.
  assert.ok(slugWarnings(slug).length > 0);
});

test("shapes that could never resolve are still refused", () => {
  // Permanence is the part posts do keep from rule 3: a published post URL gets
  // linked from elsewhere, so it still has to be a URL.
  for (const slug of ["A-Post", "a post", "a--post", "-post", "post-", "1post", ""]) {
    assert.equal(postSlugShape.safeParse(slug).success, false, slug);
  }
});
