import { describe, it, expect } from "vitest";
import {
  classifyError,
  formatErrorForDisplay,
  ErrorType,
} from "../lib/errors";

describe("classifyError", () => {
  it("detects rate limit by 429 status", () => {
    const result = classifyError("openai", new Error("Request failed"), 429);
    expect(result.type).toBe(ErrorType.RATE_LIMIT);
    expect(result.retryable).toBe(true);
    expect(result.provider).toBe("openai");
  });

  it("detects rate limit by message match", () => {
    const result = classifyError("anthropic", new Error("Rate limit exceeded"));
    expect(result.type).toBe(ErrorType.RATE_LIMIT);
    expect(result.retryable).toBe(true);
  });

  it("detects auth error by 401 status", () => {
    const result = classifyError("github", new Error("Forbidden"), 401);
    expect(result.type).toBe(ErrorType.AUTH_ERROR);
    expect(result.retryable).toBe(false);
  });

  it("detects auth error by 403 status", () => {
    const result = classifyError("github", new Error("Forbidden"), 403);
    expect(result.type).toBe(ErrorType.AUTH_ERROR);
    expect(result.retryable).toBe(false);
  });

  it("detects auth error by message match", () => {
    const result = classifyError(
      "openai",
      new Error("Unauthorized access attempt")
    );
    expect(result.type).toBe(ErrorType.AUTH_ERROR);
    expect(result.retryable).toBe(false);
  });

  it("detects quota exhausted by 402 status", () => {
    const result = classifyError("openai", new Error("Payment required"), 402);
    expect(result.type).toBe(ErrorType.QUOTA_EXHAUSTED);
    expect(result.retryable).toBe(false);
  });

  it("detects not found by 404 status", () => {
    const result = classifyError("web", new Error("Not found"), 404);
    expect(result.type).toBe(ErrorType.NOT_FOUND);
    expect(result.retryable).toBe(false);
  });

  it("detects timeout by message match", () => {
    const result = classifyError("openai", new Error("Request timeout"));
    expect(result.type).toBe(ErrorType.TIMEOUT);
    expect(result.retryable).toBe(true);
    expect(result.statusCode).toBeUndefined();
  });

  it("detects network error by message match", () => {
    const result = classifyError(
      "openai",
      new Error("ECONNREFUSED: Connection refused")
    );
    expect(result.type).toBe(ErrorType.NETWORK_ERROR);
    expect(result.retryable).toBe(true);
  });

  it("returns UNKNOWN for unmatched errors", () => {
    const result = classifyError("openai", new Error("Something weird"));
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(result.retryable).toBe(true);
    expect(result.userHint).toContain("Something weird");
  });

  it("handles non-Error inputs", () => {
    const result = classifyError("openai", "raw string error");
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(result.message).toBe("raw string error");
  });
});

describe("formatErrorForDisplay", () => {
  it("returns single hint for one error", () => {
    const errors = [
      classifyError("openai", new Error("Rate limit hit"), 429),
    ];
    const display = formatErrorForDisplay(errors);
    expect(display).toBe(errors[0]!.userHint);
    expect(display).not.toContain("Multiple providers");
  });

  it("returns bullet list for multiple errors", () => {
    const errors = [
      classifyError("openai", new Error("Rate limit hit"), 429),
      classifyError("anthropic", new Error("Server error"), 500),
    ];
    const display = formatErrorForDisplay(errors);
    expect(display).toContain("Multiple providers failed:");
    expect(display).toContain("•");
    expect(display).toContain(errors[0]!.userHint);
    expect(display).toContain(errors[1]!.userHint);
  });

  it("returns default message for empty array", () => {
    expect(formatErrorForDisplay([])).toBe("An unknown error occurred.");
  });
});
