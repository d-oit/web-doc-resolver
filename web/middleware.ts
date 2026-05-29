import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 30 };

function nowMs(): number {
  return globalThis.performance.timeOrigin + performance.now();
}

export function middleware(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.next();
  }

  if (!request.nextUrl.pathname.startsWith("/api/resolve")) {
    return NextResponse.next();
  }

  const identifier = getClientIdentifier(request);
  const { allowed, remaining, resetAt } = checkRateLimit(identifier, RATE_LIMIT_CONFIG);

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - nowMs()) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
