import { NextResponse } from "next/server";
import { stats, clear } from "@/lib/cache";

export async function GET() {
  return NextResponse.json(stats());
}

export async function DELETE() {
  clear();
  return NextResponse.json({ ok: true });
}
