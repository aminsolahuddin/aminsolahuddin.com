import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * BUILD_PLAN.md §6: /admin returns 404, not 403, so the panel is not
   * discoverable. This is the cheap edge check — it only reads the session
   * cookie, because middleware cannot reach Postgres.
   *
   * It is NOT the security boundary. The real check runs in the admin layout,
   * where the session is verified against the database and the GitHub login is
   * matched to ADMIN_GITHUB_LOGIN. A forged cookie gets past this line and
   * straight into a 404 from the layout.
   */
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const hasSession = getSessionCookie(request);
    if (!hasSession && !pathname.startsWith("/admin/login")) {
      // A bare 404 rather than a rendered error page. Anything styled would
      // still tell a stranger that this deployment has an admin panel.
      return new NextResponse(null, { status: 404 });
    }
    // The panel is English-only, so it never goes through locale routing.
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    /**
     * Everything except:
     *   api/       route handlers, including Better Auth
     *   r/         short links — resolved against the database in a route handler,
     *              never locale-prefixed, because the slug is spoken aloud in a video
     *   _next/     framework internals
     *   _vercel/   platform internals
     *   anything with a file extension (favicon.ico, og images, robots.txt)
     */
    "/((?!api|r/|_next|_vercel|.*\\..*).*)",
  ],
};
