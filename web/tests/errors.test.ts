import { describe, expect, it } from "vitest";
import { classifyError, formatErrorForDisplay, ErrorType } from "../lib/errors";

describe("classifyError", () => {
  describe("RATE_LIMIT", () => {
    it("classifies 429 status code", () => {
      const err = classifyError("exa", "Too many requests", 429);
      expect(err.type).toBe(ErrorType.RATE_LIMIT);
      expect(err.retryable).toBe(true);
      expect(err.statusCode).toBe(429);
    });

    it("classifies rate limit message without status code", () => {
      const err = classifyError("tavily", "Rate limit exceeded", undefined);
      expect(err.type).toBe(ErrorType.RATE_LIMIT);
      expect(err.retryable).toBe(true);
    });
  });

  describe("AUTH_ERROR", () => {
    it("classifies 401 status code", () => {
      const err = classifyError("exa", "Unauthorized", 401);
      expect(err.type).toBe(ErrorType.AUTH_ERROR);
      expect(err.retryable).toBe(false);
    });

    it("classifies 403 status code", () => {
      const err = classifyError("serper", "Forbidden", 403);
      expect(err.type).toBe(ErrorType.AUTH_ERROR);
      expect(err.retryable).toBe(false);
    });

    it("classifies invalid key message", () => {
      // Regex is /unauthorized|forbidden|invalid.?key/i - needs "invalid-key" or "invalid key" (single char gap)
      const err = classifyError("mistral", "Invalid key", undefined);
      expect(err.type).toBe(ErrorType.AUTH_ERROR);
    });
  });

  describe("QUOTA_EXHAUSTED", () => {
    it("classifies 402 status code", () => {
      const err = classifyError("exa", "Payment required", 402);
      expect(err.type).toBe(ErrorType.QUOTA_EXHAUSTED);
      expect(err.retryable).toBe(false);
    });

    it("classifies quota message", () => {
      const err = classifyError("tavily", "Quota exhausted", undefined);
      expect(err.type).toBe(ErrorType.QUOTA_EXHAUSTED);
    });
  });

  describe("NOT_FOUND", () => {
    it("classifies 404 status code", () => {
      const err = classifyError("exa", "Not found", 404);
      expect(err.type).toBe(ErrorType.NOT_FOUND);
      expect(err.retryable).toBe(false);
    });

    it("classifies not found message", () => {
      const err = classifyError("tavily", "Document not found", undefined);
      expect(err.type).toBe(ErrorType.NOT_FOUND);
    });
  });

  describe("TIMEOUT", () => {
    it("classifies timeout message", () => {
      const err = classifyError("exa", "Request timeout", undefined);
      expect(err.type).toBe(ErrorType.TIMEOUT);
      expect(err.retryable).toBe(true);
    });

    it("classifies abort message", () => {
      const err = classifyError("tavily", "Request aborted", undefined);
      expect(err.type).toBe(ErrorType.TIMEOUT);
    });
  });

  describe("NETWORK_ERROR", () => {
    it("classifies network message", () => {
      const err = classifyError("exa", "Network error", undefined);
      expect(err.type).toBe(ErrorType.NETWORK_ERROR);
      expect(err.retryable).toBe(true);
    });

    it("classifies ECONNREFUSED", () => {
      const err = classifyError("tavily", "ECONNREFUSED", undefined);
      expect(err.type).toBe(ErrorType.NETWORK_ERROR);
    });

    it("classifies ETIMEDOUT", () => {
      const err = classifyError("serper", "ETIMEDOUT", undefined);
      expect(err.type).toBe(ErrorType.NETWORK_ERROR);
    });
  });

  describe("UNKNOWN", () => {
    it("classifies unknown errors", () => {
      const err = classifyError("exa", "Something weird happened", 500);
      expect(err.type).toBe(ErrorType.UNKNOWN);
      expect(err.retryable).toBe(true);
      expect(err.statusCode).toBe(500);
    });

    it("handles null error", () => {
      const err = classifyError("exa", null, undefined);
      expect(err.type).toBe(ErrorType.UNKNOWN);
      expect(err.message).toBe("Unknown error");
    });
  });

  describe("userHint", () => {
    it("includes provider name in hint", () => {
      const err = classifyError("exa", "Rate limited", 429);
      expect(err.userHint).toContain("exa");
    });
  });
});

describe("formatErrorForDisplay", () => {
  it("returns default message for empty array", () => {
    expect(formatErrorForDisplay([])).toBe("An unknown error occurred.");
  });

  it("returns single hint for one error", () => {
    const err = classifyError("exa", "Rate limited", 429);
    expect(formatErrorForDisplay([err])).toBe(err.userHint);
  });

  it("formats multiple errors", () => {
    const err1 = classifyError("exa", "Rate limited", 429);
    const err2 = classifyError("tavily", "Timeout", undefined);
    const result = formatErrorForDisplay([err1, err2]);
    expect(result).toContain("Multiple providers failed");
    expect(result).toContain(err1.userHint);
    expect(result).toContain(err2.userHint);
  });
});