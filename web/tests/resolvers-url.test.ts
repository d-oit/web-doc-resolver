import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockValidateUrlForFetchAsync } = vi.hoisted(() => ({
  mockValidateUrlForFetchAsync: vi.fn(),
}));

vi.mock("@/lib/validation", () => ({
  validateUrlForFetchAsync: mockValidateUrlForFetchAsync,
}));

import { extractViaJina } from "../lib/resolvers/url";
import { Logger } from "../lib/log";

describe("extractViaJina", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("blocks private target URLs before calling the Jina proxy", async () => {
    mockValidateUrlForFetchAsync.mockResolvedValueOnce({
      valid: false,
      error: "Private/internal URLs are not allowed",
    });

    const result = await extractViaJina("http://127.0.0.1/private", new Logger("error"));

    expect(result).toBeNull();
    expect(mockValidateUrlForFetchAsync).toHaveBeenCalledWith("http://127.0.0.1/private");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches through Jina after validating both the target and proxy URL", async () => {
    mockValidateUrlForFetchAsync
      .mockResolvedValueOnce({ valid: true })
      .mockResolvedValueOnce({ valid: true });
    vi.mocked(global.fetch).mockResolvedValue(
      new Response("x".repeat(250), {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    );

    const result = await extractViaJina("https://example.com/docs", new Logger("error"));

    expect(result).toBe("x".repeat(250));
    expect(mockValidateUrlForFetchAsync).toHaveBeenNthCalledWith(1, "https://example.com/docs");
    expect(mockValidateUrlForFetchAsync).toHaveBeenNthCalledWith(2, "https://r.jina.ai/https://example.com/docs");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
