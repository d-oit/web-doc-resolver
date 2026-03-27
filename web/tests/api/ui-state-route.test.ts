import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "../../app/api/ui-state/route";

function extractCookieValue(setCookieHeader: string): string {
  const firstPart = setCookieHeader.split(";")[0] || "";
  return firstPart.split("=")[1] || "";
}

describe("/api/ui-state route", () => {
  it("stores and restores custom profile provider selection", async () => {
    const payload = {
      profile: "custom",
      selectedProviders: ["exa_mcp", "duckduckgo"],
      updatedAt: 123,
    };

    const postReq = new NextRequest("http://localhost/api/ui-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);

    const setCookie = postRes.headers.get("set-cookie");
    expect(setCookie).toContain("wdr-ui-state=");
    const cookieValue = extractCookieValue(setCookie || "");

    const getReq = new NextRequest("http://localhost/api/ui-state", {
      headers: { cookie: `wdr-ui-state=${cookieValue}` },
    });
    const getRes = await GET(getReq);
    const restored = await getRes.json();

    expect(restored.profile).toBe("custom");
    expect(restored.selectedProviders).toEqual(["exa_mcp", "duckduckgo"]);
    expect(restored.updatedAt).toBe(123);
  });

  it("rejects oversized ui-state payload", async () => {
    const oversized = {
      profile: "custom",
      selectedProviders: ["exa_mcp"],
      apiKeys: { mistral_api_key: "x".repeat(5000) },
    };

    const postReq = new NextRequest("http://localhost/api/ui-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(oversized),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(413);
  });
});
