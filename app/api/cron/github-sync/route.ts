import { NextResponse, type NextRequest } from "next/server";

import { authorizeCron } from "@/lib/jobs/authorize-cron";
import { syncRepos } from "@/lib/jobs/github-sync";

export const dynamic = "force-dynamic";

/**
 * BUILD_PLAN.md §7. Weekly, from the schedule in vercel.json.
 *
 * 300 seconds because the job is deliberately sequential — one GitHub request at
 * a time, so a fine-grained PAT does not start answering 403 — and a library of a
 * few hundred entries needs more than the default 10.
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const rejected = authorizeCron(request);
  if (rejected) return rejected;

  const token = process.env.GITHUB_SYNC_TOKEN;
  if (!token) {
    /**
     * 503, not 500. The job is correct and the configuration is not, so the
     * honest answer is "not available yet" — and Vercel's cron log will show a
     * retriable status rather than a bug to hunt.
     */
    return NextResponse.json(
      { error: "GITHUB_SYNC_TOKEN is not set. See .env.example." },
      { status: 503 },
    );
  }

  const report = await syncRepos(token);

  /**
   * The report is the log. Vercel keeps a cron invocation's response, so this is
   * what you read on a Monday to find out what happened on Sunday — which is why
   * it names the entries rather than only counting them.
   */
  return NextResponse.json(report);
}
