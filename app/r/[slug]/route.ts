import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { resourcePack, slugRedirect, shortLinkHit } from "@/db/schema";
import { routing } from "@/i18n/routing";
import { hasLocale } from "next-intl";

export const dynamic = "force-dynamic";

const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * The single most important route on the site. BUILD_PLAN.md §5.
 *
 * Amin says "/r/docker-fix" out loud in a video. Two years later that video is
 * still being watched, so this must still resolve — which is why a rename never
 * replaces a slug, it inserts a slug_redirect row and both keep working.
 *
 * 307, not 308: the target locale depends on the reader's cookie and headers, so
 * the redirect is genuinely temporary and must not be cached by the browser as
 * permanent. A 308 here would pin the first visitor's language onto everyone
 * sharing that cache.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  let pack: { slug: string; status: string } | undefined;
  try {
    const db = getDb();

    pack = await db.query.resourcePack.findFirst({
      where: eq(resourcePack.slug, slug),
      columns: { slug: true, status: true },
    });

    if (!pack) {
      const moved = await db.query.slugRedirect.findFirst({
        where: eq(slugRedirect.oldSlug, slug),
        with: { pack: { columns: { slug: true, status: true } } },
      });
      pack = moved?.pack;
    }
  } catch (error) {
    /**
     * The database being unreachable is not the same thing as the slug not
     * existing, and this route in particular must not confuse them. A 404 here
     * would tell a viewer who just heard this URL in a video that the resource
     * was never real — and it would tell a crawler to drop the URL. 503 says
     * "come back", which is the truth.
     */
    console.error(`short link ${slug}: database unreachable`, error);
    return new NextResponse(null, {
      status: 503,
      headers: { "Retry-After": "60" },
    });
  }

  if (!pack || pack.status !== "published") {
    return new NextResponse(null, { status: 404 });
  }

  const locale = preferredLocale(request);

  // Attribution comes free: one slug per video means this row already says which
  // video sent the traffic, with no UTM tag for Amin to remember mid-recording.
  // Logging must never be what stops a reader reaching a promised resource, so a
  // failure here is swallowed rather than surfaced.
  try {
    // getDb() is memoised, so this is the same pool the lookup above used.
    await getDb().insert(shortLinkHit).values({
      slug,
      referrer: request.headers.get("referer"),
      locale,
    });
  } catch {
    // Intentionally ignored. CLAUDE.md rule 2.
  }

  return NextResponse.redirect(
    new URL(`/${locale}/resources/${pack.slug}`, request.url),
    307,
  );
}

function preferredLocale(request: NextRequest): string {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (fromCookie && hasLocale(routing.locales, fromCookie)) return fromCookie;

  const header = request.headers.get("accept-language");
  if (header) {
    for (const part of header.split(",")) {
      const tag = part.split(";")[0]?.trim();
      if (tag && hasLocale(routing.locales, tag)) return tag;
      // "zh-CN" and "zh" both mean the Simplified stack for our purposes.
      const base = tag?.split("-")[0];
      if (base === "zh") return "zh-Hans";
      if (base && hasLocale(routing.locales, base)) return base;
    }
  }

  return routing.defaultLocale;
}
