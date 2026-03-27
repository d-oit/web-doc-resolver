import { describe, expect, it } from "vitest";
import { planProviderOrder } from "../lib/routing";

describe("planProviderOrder with mistral key", () => {
  it("excludes duckduckgo when mistral key is set", () => {
    const order = planProviderOrder({
      isUrl: false,
      keys: { MISTRAL_API_KEY: "test-key" },
    });

    expect(order).not.toContain("duckduckgo");
  });

  it("puts mistral_websearch before other query providers", () => {
    const order = planProviderOrder({
      isUrl: false,
      keys: { MISTRAL_API_KEY: "test-key" },
    });

    expect(order[0]).toBe("mistral_websearch");
  });

  it("includes exa_mcp alongside mistral_websearch", () => {
    const order = planProviderOrder({
      isUrl: false,
      keys: { MISTRAL_API_KEY: "test-key" },
    });

    expect(order).toContain("exa_mcp");
    expect(order).toContain("mistral_websearch");
  });

  it("keeps duckduckgo when no mistral key exists", () => {
    const order = planProviderOrder({ isUrl: false });
    expect(order).toContain("duckduckgo");
  });
});
