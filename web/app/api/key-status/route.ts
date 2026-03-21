import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    serper: !!process.env.SERPER_API_KEY,
    tavily: !!process.env.TAVILY_API_KEY,
    exa: !!process.env.EXA_API_KEY,
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    mistral: !!process.env.MISTRAL_API_KEY,
  });
}
