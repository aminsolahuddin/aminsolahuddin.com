import { NextResponse, type NextRequest } from "next/server";

import { authorizeCron } from "@/lib/jobs/authorize-cron";
import { checkLinks } from "@/lib/jobs/link-health";

export const dynamic = "force-dynamic";

/** §8. Sequential with a pause between requests, so it needs the room. */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const rejected = authorizeCron(request);
  if (rejected) return rejected;

  const report = await checkLinks();

  return NextResponse.json(report);
}
