import type { NextRequest } from "next/server";

// CSRF check for writes: browsers always send Origin on POST, so it must be our own.
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  return !!origin && origin === new URL(process.env.APP_URL ?? req.nextUrl.origin).origin;
}
