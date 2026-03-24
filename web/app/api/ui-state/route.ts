import { NextRequest, NextResponse } from "next/server";

// In-memory store keyed by session ID
const store = new Map<string, Record<string, unknown>>();

// Generate a session ID from cookies or create one
function getSessionId(request: NextRequest): string {
  const existing = request.cookies.get("ui-session")?.value;
  if (existing) return existing;
  // Generate a random session ID
  return crypto.randomUUID();
}

export async function GET(request: NextRequest) {
  const sessionId = getSessionId(request);
  const state = store.get(sessionId) || {};
  const response = NextResponse.json(state);
  // Set cookie if new session
  if (!request.cookies.get("ui-session")?.value) {
    response.cookies.set("ui-session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }
  return response;
}

export async function POST(request: NextRequest) {
  const sessionId = getSessionId(request);
  try {
    const body = await request.json();
    store.set(sessionId, body);
    const response = NextResponse.json({ ok: true });
    if (!request.cookies.get("ui-session")?.value) {
      response.cookies.set("ui-session", sessionId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
