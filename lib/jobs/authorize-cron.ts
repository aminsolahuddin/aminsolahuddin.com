import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * The gate on both cron routes. BUILD_PLAN.md §7 and §8, CLAUDE.md rule 8.
 *
 * These are public URLs that spend a GitHub rate-limit budget and fire a few
 * hundred outbound requests, so an unauthenticated one is a free way for anyone
 * to burn the token and get the origin IP throttled. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`.
 *
 * Returns null when the request may proceed, or the Response to send back.
 */
export function authorizeCron(request: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET;

  /**
   * No secret configured means the route is off, not open. 404 rather than 500:
   * the same reasoning as requireAdmin() — a 500 confirms the endpoint exists and
   * is worth returning to once it is switched on.
   */
  if (!secret) return new Response(null, { status: 404 });

  const header = request.headers.get("authorization") ?? "";
  const offered = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!constantTimeEqual(offered, secret)) {
    return new Response(null, { status: 401 });
  }

  return null;
}

/**
 * Compared in constant time. `===` on a secret leaks its length and its matching
 * prefix through timing, which is enough to recover one over many requests — and
 * these endpoints will happily take as many requests as anyone wants to send.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, which would itself be a timing
  // signal, so the lengths are compared first and the result is folded in.
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}
