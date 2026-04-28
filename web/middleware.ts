import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export function middleware(request: NextRequest): NextResponse {
  // Only rate limit /api/resolve
  if (request.nextUrl.pathname === "/api/resolve") {
    const identifier = getClientIdentifier(request);
    const result = checkRateLimit(identifier);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/resolve",
};