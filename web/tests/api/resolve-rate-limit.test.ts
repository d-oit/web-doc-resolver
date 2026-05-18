import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/resolve/route";
import * as rateLimit from "../../lib/rate-limit";

// Mock the rate limit module
vi.mock("../../lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
}));

// Mock cache and records to avoid external dependencies or side effects
vi.mock("../../lib/cache", () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/records", () => ({
  save: vi.fn(),
}));

describe("POST /api/resolve rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    // Setup mock to return blocked
    vi.mocked(rateLimit.getClientIdentifier).mockReturnValue("test-ip");
    vi.mocked(rateLimit.checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });

    const request = new NextRequest("http://localhost/api/resolve", {
      method: "POST",
      body: JSON.stringify({ query: "test" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toBe("Too many requests");

    // Ensure checkRateLimit was called with correct identifier
    expect(rateLimit.getClientIdentifier).toHaveBeenCalledWith(request);
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("test-ip");
  });

  it("proceeds normally when rate limit is not exceeded", async () => {
    // Setup mock to return allowed
    vi.mocked(rateLimit.getClientIdentifier).mockReturnValue("test-ip");
    vi.mocked(rateLimit.checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 29,
      resetAt: Date.now() + 60000,
    });

    // We don't need to mock the entire resolve cascade, just verify it gets past the rate limit check.
    // Since we didn't mock queryProviders/urlProviders, it will likely fail later with "No search results found"
    // which is fine as long as it's not a 429.

    const request = new NextRequest("http://localhost/api/resolve", {
      method: "POST",
      body: JSON.stringify({ query: "test" }),
    });

    const response = await POST(request);

    // It should NOT be 429
    expect(response.status).not.toBe(429);

    // Verify rate limit was checked
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith("test-ip");
  });
});
