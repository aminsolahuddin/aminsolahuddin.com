import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVideoUrl, platformLabel } from "./video-url.ts";

function parse(input: string) {
  const result = parseVideoUrl(input);
  assert.ok(result !== null, `expected ${input} to parse`);
  return result;
}

test("youtube: watch, short, shorts, embed", () => {
  assert.equal(parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");
  assert.equal(parse("https://youtu.be/dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");
  assert.equal(parse("https://youtube.com/shorts/dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");
  assert.equal(parse("https://www.youtube.com/embed/dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ");

  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
  ]) {
    assert.equal(parse(url).platform, "youtube");
  }
});

test("tiktok: full video URL yields the numeric id", () => {
  const result = parse("https://www.tiktok.com/@aminsolahuddin/video/7234567890123456789");
  assert.equal(result.platform, "tiktok");
  assert.equal(result.videoId, "7234567890123456789");
});

test("tiktok: vm short link saves, but the id stays null", () => {
  // Resolving it would need a network round trip. §5a says the function is pure,
  // so the URL is kept and the id is simply unknown.
  const result = parse("https://vm.tiktok.com/ZMhqABCDE/");
  assert.equal(result.platform, "tiktok");
  assert.equal(result.videoId, null);
});

test("instagram: reel and post shortcodes", () => {
  assert.equal(parse("https://www.instagram.com/reel/C1a2B3c4D5e/").videoId, "C1a2B3c4D5e");
  assert.equal(parse("https://instagram.com/p/C1a2B3c4D5e/").videoId, "C1a2B3c4D5e");
  assert.equal(parse("https://www.instagram.com/reel/C1a2B3c4D5e/").platform, "instagram");
});

test("tracking parameters are stripped", () => {
  const result = parse("https://youtu.be/dQw4w9WgXcQ?si=AbCdEf&utm_source=x&t=42");
  // ?t= is a real timestamp and must survive; si and utm_* must not.
  assert.ok(!result.canonicalUrl.includes("si="));
  assert.ok(!result.canonicalUrl.includes("utm_source"));
  assert.ok(result.canonicalUrl.includes("t=42"));
});

test("unknown hosts save as `other` rather than failing", () => {
  const result = parse("https://vimeo.com/123456789");
  assert.equal(result.platform, "other");
  assert.equal(result.videoId, null);
  assert.equal(result.canonicalUrl, "https://vimeo.com/123456789");
});

test("a bare host with no scheme still parses", () => {
  const result = parse("youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(result.platform, "youtube");
  assert.equal(result.videoId, "dQw4w9WgXcQ");
  assert.ok(result.canonicalUrl.startsWith("https://"));
});

test("http is upgraded to https", () => {
  assert.ok(parse("http://youtu.be/dQw4w9WgXcQ").canonicalUrl.startsWith("https://"));
});

test("junk input returns null instead of throwing", () => {
  assert.equal(parseVideoUrl(""), null);
  assert.equal(parseVideoUrl("   "), null);
  assert.equal(parseVideoUrl("not a url at all"), null);
  assert.equal(parseVideoUrl("javascript:alert(1)"), null);
});

test("a malformed youtube id is not mistaken for one", () => {
  // Right host, wrong id shape. Better to store no id than a wrong one.
  assert.equal(parse("https://www.youtube.com/watch?v=tooshort").videoId, null);
  assert.equal(parse("https://www.youtube.com/watch?v=waaaaaaaaaaaaytoolong").videoId, null);
});

test("platform labels are brand names, never translated", () => {
  assert.equal(platformLabel("youtube"), "YouTube");
  assert.equal(platformLabel("tiktok"), "TikTok");
  assert.equal(platformLabel("instagram"), "Instagram");
});
