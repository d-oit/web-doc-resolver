import { NextRequest, NextResponse } from "next/server";
import { save, list, clear, search } from "@/lib/records";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const q = searchParams.get("q");

  const records = q ? search(q, limit) : list(limit);
  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.query && !body.url) {
      return NextResponse.json(
        { error: "query or url required" },
        { status: 400 }
      );
    }
    const record = save({
      query: body.query || body.url,
      url: body.url ?? null,
      content: body.content || "",
      source: body.source || "manual",
      score: body.score ?? 0,
    });
    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

export async function DELETE() {
  const count = clear();
  return NextResponse.json({ deleted: count });
}
