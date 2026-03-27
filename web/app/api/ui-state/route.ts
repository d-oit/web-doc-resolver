import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "wdr-ui-state";
const MAX_COOKIE_BYTES = 3800;

function decodeState(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function encodeState(state: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export async function GET(request: NextRequest) {
  const state = decodeState(request.cookies.get(STATE_COOKIE)?.value);
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid state payload" }, { status: 400 });
    }

    const encoded = encodeState(body as Record<string, unknown>);
    if (encoded.length > MAX_COOKIE_BYTES) {
      return NextResponse.json({ error: "State payload too large" }, { status: 413 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(STATE_COOKIE, encoded, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
