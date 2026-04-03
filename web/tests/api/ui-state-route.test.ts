import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "../../app/api/ui-state/route";

describe("/api/ui-state route", () => {
  it("stores and restores custom profile provider selection", async () => {
    const payload = {
      activeProfile: "custom",
      selectedProviders: ["exa_mcp", "duckduckgo"],
      lastUpdated: 123,
    };

    const postReq = new NextRequest("http://localhost/api/ui-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);

    const postData = await postRes.json();
    expect(postData.ok).toBe(true);
    expect(postData.lastUpdated).toBeDefined();

    // GET with same headers should return the stored state
    const getReq = new NextRequest("http://localhost/api/ui-state", {
      headers: { 
        "content-type": "application/json",
      },
    });
    const getRes = await GET(getReq);
    const restored = await getRes.json();

    expect(restored.activeProfile).toBe("custom");
    expect(restored.selectedProviders).toEqual(["exa_mcp", "duckduckgo"]);
    expect(restored.lastUpdated).toBe(123);
  });

  it("rejects invalid payload", async () => {
    const postReq = new NextRequest("http://localhost/api/ui-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "invalid json",
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(400);
    const data = await postRes.json();
    expect(data.error).toBe("Invalid JSON");
  });

  it("rejects non-object payload", async () => {
    const postReq = new NextRequest("http://localhost/api/ui-state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(["array", "not", "object"]),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(400);
    const data = await postRes.json();
    expect(data.error).toBe("Invalid state payload");
  });

  it("returns empty object for new session", async () => {
    // Use unique headers to simulate different session
    const getReq = new NextRequest("http://localhost/api/ui-state", {
      headers: { 
        "user-agent": "unique-agent-" + Date.now(),
        "x-forwarded-for": "192.168.1." + Math.floor(Math.random() * 255),
      },
    });
    const getRes = await GET(getReq);
    const data = await getRes.json();

    expect(data).toEqual({});
  });

  it("isolates state between different sessions", async () => {
    // First session
    const payload1 = {
      activeProfile: "session1",
      lastUpdated: 100,
    };

    const postReq1 = new NextRequest("http://localhost/api/ui-state", {
      method: "POST",
      headers: { 
        "content-type": "application/json",
        "user-agent": "agent-1",
        "x-forwarded-for": "192.168.1.1",
      },
      body: JSON.stringify(payload1),
    });
    await POST(postReq1);

    // Second session
    const payload2 = {
      activeProfile: "session2",
      lastUpdated: 200,
    };

    const postReq2 = new NextRequest("http://localhost/api/ui-state", {
      method: "POST",
      headers: { 
        "content-type": "application/json",
        "user-agent": "agent-2",
        "x-forwarded-for": "192.168.1.2",
      },
      body: JSON.stringify(payload2),
    });
    await POST(postReq2);

    // Verify first session still has its own state
    const getReq1 = new NextRequest("http://localhost/api/ui-state", {
      headers: { 
        "user-agent": "agent-1",
        "x-forwarded-for": "192.168.1.1",
      },
    });
    const getRes1 = await GET(getReq1);
    const data1 = await getRes1.json();
    expect(data1.activeProfile).toBe("session1");

    // Verify second session still has its own state
    const getReq2 = new NextRequest("http://localhost/api/ui-state", {
      headers: { 
        "user-agent": "agent-2",
        "x-forwarded-for": "192.168.1.2",
      },
    });
    const getRes2 = await GET(getReq2);
    const data2 = await getRes2.json();
    expect(data2.activeProfile).toBe("session2");
  });
});
