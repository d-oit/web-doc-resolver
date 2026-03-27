import { describe, expect, it } from "vitest";
import { getAllQueryProviders, getMistralActiveProviders } from "../lib/providers";

describe("getMistralActiveProviders", () => {
  it("returns null without a mistral key", () => {
    expect(getMistralActiveProviders({})).toBeNull();
  });

  it("returns exa_mcp and mistral_websearch when mistral key exists", () => {
    const result = getMistralActiveProviders({ MISTRAL_API_KEY: "test-key" });
    expect(result).toEqual(["exa_mcp", "mistral_websearch"]);
    expect(result).not.toContain("duckduckgo");
  });
});

describe("getAllQueryProviders", () => {
  it("removes duckduckgo when mistral key exists", () => {
    const providers = getAllQueryProviders({ MISTRAL_API_KEY: "test-key" });
    expect(providers).toContain("exa_mcp");
    expect(providers).toContain("mistral_websearch");
    expect(providers).not.toContain("duckduckgo");
  });

  it("includes duckduckgo when mistral key is missing", () => {
    const providers = getAllQueryProviders({});
    expect(providers).toContain("duckduckgo");
  });
});
