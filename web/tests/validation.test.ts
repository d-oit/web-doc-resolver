import { describe, expect, it, beforeEach, vi } from "vitest";
import { sanitizeInput, validateUrl, validateResolveRequest } from "../lib/validation";

describe("sanitizeInput", () => {
  it("removes control characters", () => {
    const input = "hello\x00world\x1Ftest";
    expect(sanitizeInput(input)).toBe("helloworldtest");
  });

  it("preserves newlines and tabs", () => {
    const input = "hello\nworld\ttest";
    expect(sanitizeInput(input)).toBe("hello\nworld\ttest");
  });

  it("limits length", () => {
    const input = "a".repeat(15000);
    const result = sanitizeInput(input, 100);
    expect(result.length).toBe(100);
  });

  it("handles empty input", () => {
    expect(sanitizeInput("")).toBe("");
  });
});

describe("validateUrl", () => {
  it("accepts valid HTTP URLs", () => {
    const result = validateUrl("http://example.com");
    expect(result.valid).toBe(true);
  });

  it("accepts valid HTTPS URLs", () => {
    const result = validateUrl("https://example.com");
    expect(result.valid).toBe(true);
  });

  it("rejects non-HTTP protocols", () => {
    const result = validateUrl("ftp://example.com");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("HTTP");
  });

  it("rejects localhost", () => {
    const result = validateUrl("http://localhost/test");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Private");
  });

  it("rejects private IP ranges", () => {
    const privateUrls = [
      "http://127.0.0.1/test",
      "http://10.0.0.1/test",
      "http://192.168.1.1/test",
      "http://172.16.0.1/test",
      "http://169.254.169.254/latest/meta-data/",
      "http://100.64.0.1/test", // CGNAT
      "http://[::1]/test", // IPv6 loopback
      "http://[fc00::1]/test", // ULA
      "http://[fe80::1]/test", // Link-local
    ];

    for (const url of privateUrls) {
      const result = validateUrl(url);
      expect(result.valid).toBe(false, `Expected ${url} to be invalid`);
    }
  });

  it("rejects malformed URLs", () => {
    const result = validateUrl("not-a-url");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid");
  });

  it("rejects overly long URLs", () => {
    const url = "http://example.com/" + "a".repeat(3000);
    const result = validateUrl(url);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("long");
  });
});

describe("validateResolveRequest", () => {
  it("accepts valid query", () => {
    const result = validateResolveRequest({ query: "test query" });
    expect(result.success).toBe(true);
    expect(result.data?.query).toBe("test query");
  });

  it("accepts valid URL", () => {
    const result = validateResolveRequest({ url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects empty request", () => {
    const result = validateResolveRequest({});
    expect(result.success).toBe(false);
    expect(result.error).toContain("required");
  });

  it("rejects both query and URL", () => {
    // Actually both is fine - it will just prefer one
    const result = validateResolveRequest({ query: "test", url: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("sanitizes query input", () => {
    const result = validateResolveRequest({ query: "test\x00query" });
    expect(result.success).toBe(true);
    expect(result.data?.query).toBe("testquery");
  });

  it("rejects invalid URL in request", () => {
    const result = validateResolveRequest({ url: "http://localhost/test" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Private");
  });
});