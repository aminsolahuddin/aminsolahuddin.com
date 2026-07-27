/**
 * BUILD_PLAN.md §5a. Amin pastes a social URL into one field and the platform is
 * derived from it — he never picks from a dropdown first.
 *
 * Two properties matter more than breadth of coverage:
 *
 *   1. It never throws and never rejects. An unrecognised URL saves as `other`
 *      and renders as a plain link. Publishing a resource must not be blocked by
 *      a platform this function has not met yet.
 *   2. It is pure. No network, no DOM, no clock — so it is fully testable, and so
 *      it can run in a server action, a migration, or a seed script alike.
 */

export const VIDEO_PLATFORMS = [
  "youtube",
  "tiktok",
  "instagram",
  "other",
] as const;

export type VideoPlatform = (typeof VIDEO_PLATFORMS)[number];

export interface ParsedVideoUrl {
  platform: VideoPlatform;
  /** Platform-native id, when one can be read from the URL alone. */
  videoId: string | null;
  /** The URL normalised — tracking params stripped, scheme forced to https. */
  canonicalUrl: string;
}

/**
 * Query params that carry no meaning for the video itself. Stripped so the same
 * video shared from two places does not produce two different stored URLs.
 */
const TRACKING_PARAMS = new Set([
  "si",
  "feature",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "igsh",
  "igshid",
  "is_from_webapp",
  "sender_device",
  "web_id",
  "_r",
  "_t",
  "pp",
]);

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const YOUTUBE_SHORT_HOSTS = new Set(["youtu.be"]);

const TIKTOK_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

const INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
]);

/** A YouTube id is exactly 11 chars of the URL-safe alphabet. */
const YOUTUBE_ID = /^[\w-]{11}$/;
/** TikTok and Instagram ids are digit runs and shortcodes respectively. */
const TIKTOK_ID = /^\d{6,25}$/;
const INSTAGRAM_ID = /^[\w-]{5,20}$/;

export function parseVideoUrl(input: string): ParsedVideoUrl | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  let url: URL;
  try {
    // A bare "youtube.com/watch?v=x" is a reasonable thing to paste.
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.protocol = "https:";
  url.hash = "";
  for (const param of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(param)) url.searchParams.delete(param);
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    return finish(url, "youtube", youtubeId(url, segments));
  }
  if (YOUTUBE_SHORT_HOSTS.has(host)) {
    return finish(url, "youtube", match(segments[0], YOUTUBE_ID));
  }
  if (TIKTOK_HOSTS.has(host)) {
    return finish(url, "tiktok", tiktokId(segments));
  }
  if (INSTAGRAM_HOSTS.has(host)) {
    return finish(url, "instagram", instagramId(segments));
  }

  return finish(url, "other", null);
}

function finish(
  url: URL,
  platform: VideoPlatform,
  videoId: string | null,
): ParsedVideoUrl {
  return { platform, videoId, canonicalUrl: url.toString() };
}

function match(segment: string | undefined, pattern: RegExp): string | null {
  return segment !== undefined && pattern.test(segment) ? segment : null;
}

function youtubeId(url: URL, segments: string[]): string | null {
  // /watch?v=ID
  const fromQuery = url.searchParams.get("v");
  if (fromQuery !== null && YOUTUBE_ID.test(fromQuery)) return fromQuery;

  // /shorts/ID, /embed/ID, /live/ID, /v/ID
  const [first, second] = segments;
  if (
    first !== undefined &&
    ["shorts", "embed", "live", "v"].includes(first) &&
    second !== undefined
  ) {
    return match(second, YOUTUBE_ID);
  }
  return null;
}

function tiktokId(segments: string[]): string | null {
  // /@handle/video/ID — the id is the segment after "video".
  const index = segments.indexOf("video");
  if (index !== -1) return match(segments[index + 1], TIKTOK_ID);

  // vm.tiktok.com/SHORTCODE resolves only by following a redirect, which this
  // function deliberately will not do. The URL still saves; the id stays null.
  return null;
}

function instagramId(segments: string[]): string | null {
  const [first, second] = segments;
  if (
    first !== undefined &&
    ["reel", "reels", "p", "tv"].includes(first) &&
    second !== undefined
  ) {
    return match(second, INSTAGRAM_ID);
  }
  return null;
}

/**
 * Label for the "Watch on X" button. Not translated — these are brand names, and
 * CLAUDE.md's language rules put brand names on the never-translated list.
 */
export function platformLabel(platform: VideoPlatform): string {
  switch (platform) {
    case "youtube":
      return "YouTube";
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    case "other":
      return "the original post";
  }
}

/**
 * Static thumbnail for the click-to-load facade. Only YouTube exposes one at a
 * predictable URL without an API call, which is exactly why YouTube is the only
 * platform that gets a facade and the rest get a plain link card.
 */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}
