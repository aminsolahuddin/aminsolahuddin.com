import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAuth } from "./auth";

export interface AdminSession {
  userId: string;
  githubLogin: string;
  name: string;
}

/**
 * The real gate. Middleware only sniffs for a session cookie — it cannot reach
 * Postgres from the edge — so this is where the session is actually verified and
 * the GitHub login is actually matched.
 *
 * It calls notFound(), never a 403 and never a redirect to a login page from a
 * protected route. BUILD_PLAN.md §6 asks for 404 so the panel is not
 * discoverable: a 403 confirms that /admin/resources exists and is worth
 * attacking, and a redirect confirms it just as loudly.
 *
 * Every admin page and every admin server action must call this. There is no
 * inherited protection in the App Router that would make it optional.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const allowedLogin = process.env.ADMIN_GITHUB_LOGIN?.toLowerCase();
  if (!allowedLogin) notFound();

  const session = await getAuth().api.getSession({
    headers: await headers(),
  });

  const user = session?.user;
  if (!user) notFound();

  const githubLogin = (
    user as { githubLogin?: string | null }
  ).githubLogin?.toLowerCase();

  // Re-checked here, not trusted from signup. If ADMIN_GITHUB_LOGIN is rotated,
  // the previous owner loses access on their very next request.
  if (!githubLogin || githubLogin !== allowedLogin) notFound();

  return {
    userId: user.id,
    githubLogin,
    name: user.name,
  };
}
