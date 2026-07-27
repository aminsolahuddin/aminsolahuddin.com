import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// getAuth() is called per request rather than at module scope so that a missing
// GITHUB_CLIENT_ID fails this one route with a clear message, instead of failing
// the whole build.
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
