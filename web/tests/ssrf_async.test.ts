import { describe, expect, it, vi, beforeEach } from "vitest";
import { validateUrlForFetchAsync } from "../lib/validation";
import dns from "node:dns/promises";

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
}));

describe("Async SSRF Validation (DNS-aware)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects domains resolving to private IPs", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

    const result = await validateUrlForFetchAsync("http://malicious.com");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("resolves to private/internal IP");
  });

  it("rejects domains resolving to any private IP in a multi-record set", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]);

    const result = await validateUrlForFetchAsync("http://mixed-records.com");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("resolves to private/internal IP: 10.0.0.1");
  });

  it("accepts domains resolving to public IPs", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);

    const result = await validateUrlForFetchAsync("http://example.com");
    expect(result.valid).toBe(true);
  });

  it("still rejects literal private IPs via sync check (short circuit)", async () => {
    const result = await validateUrlForFetchAsync("http://127.0.0.1");
    expect(result.valid).toBe(false);
    expect(dns.lookup).not.toHaveBeenCalled();
  });

  it("rejects if DNS resolution fails", async () => {
    vi.mocked(dns.lookup).mockRejectedValue(new Error("DNS Error"));

    const result = await validateUrlForFetchAsync("http://nonexistent.invalid");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("DNS resolution failed or invalid URL");
  });
});
