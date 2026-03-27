import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, clearRateLimits, getRateLimitStats, cleanupExpiredEntries } from "../lib/rate-limit";

describe("rate limiting", () => {
  beforeEach(() => {
    clearRateLimits();
  });

  describe("checkRateLimit", () => {
    it("allows first request", () => {
      const result = checkRateLimit("test-client");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(29);
    });

    it("increments count on subsequent requests", () => {
      checkRateLimit("test-client");
      checkRateLimit("test-client");
      const result = checkRateLimit("test-client");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(27);
    });

    it("blocks when limit exceeded", () => {
      const config = { windowMs: 60000, maxRequests: 3 };
      checkRateLimit("test-client", config);
      checkRateLimit("test-client", config);
      checkRateLimit("test-client", config);
      const result = checkRateLimit("test-client", config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("resets after window expires", () => {
      const config = { windowMs: 10, maxRequests: 1 }; // 10ms window
      checkRateLimit("test-client", config);

      // Wait for window to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = checkRateLimit("test-client", config);
          expect(result.allowed).toBe(true);
          resolve();
        }, 20);
      });
    });

    it("tracks different clients separately", () => {
      const result1 = checkRateLimit("client-1");
      const result2 = checkRateLimit("client-2");
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe("getRateLimitStats", () => {
    it("returns correct stats", () => {
      checkRateLimit("client-1");
      checkRateLimit("client-2");
      const stats = getRateLimitStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.activeEntries).toBe(2);
    });
  });

  describe("cleanupExpiredEntries", () => {
    it("removes expired entries", async () => {
      const config = { windowMs: 10, maxRequests: 1 };
      checkRateLimit("old-client", config);

      // Wait for expiry
      await new Promise<void>((resolve) => setTimeout(resolve, 20));

      const cleaned = cleanupExpiredEntries();
      expect(cleaned).toBe(1);

      const stats = getRateLimitStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});