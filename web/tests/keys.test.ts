import { describe, expect, it, beforeEach } from "vitest";
import { loadApiKeys, saveApiKeys, resolveKeySource, ApiKeys, KeySource } from "../lib/keys";

describe("loadApiKeys / saveApiKeys", () => {
  beforeEach(() => {
    saveApiKeys({});
  });

  it("loads empty keys initially", () => {
    const keys = loadApiKeys();
    expect(keys).toEqual({});
  });

  it("saves and loads keys", () => {
    const testKeys: ApiKeys = {
      exa_api_key: "test-exa-key",
      tavily_api_key: "test-tavily-key",
    };
    saveApiKeys(testKeys);
    const loaded = loadApiKeys();
    expect(loaded.exa_api_key).toBe("test-exa-key");
    expect(loaded.tavily_api_key).toBe("test-tavily-key");
  });

  it("returns copy of keys", () => {
    saveApiKeys({ serper_api_key: "serper-key" });
    const keys1 = loadApiKeys();
    const keys2 = loadApiKeys();
    expect(keys1).not.toBe(keys2); // different objects
    expect(keys1).toEqual(keys2); // same content
  });

  it("handles partial keys", () => {
    saveApiKeys({ mistral_api_key: "mistral-key" });
    const keys = loadApiKeys();
    expect(keys.mistral_api_key).toBe("mistral-key");
    expect(keys.exa_api_key).toBeUndefined();
  });
});

describe("resolveKeySource", () => {
  it("returns local for local keys", () => {
    const localKeys: ApiKeys = { exa_api_key: "local-exa" };
    const result = resolveKeySource(localKeys, {});
    expect(result.exa).toBe("local");
  });

  it("returns server when no local key but server has key", () => {
    const result = resolveKeySource({}, { exa: true });
    expect(result.exa).toBe("server");
  });

  it("returns local when both local and server have keys", () => {
    const localKeys: ApiKeys = { exa_api_key: "local-exa" };
    const result = resolveKeySource(localKeys, { exa: true });
    expect(result.exa).toBe("local");
  });

  it("returns none when no key available", () => {
    const result = resolveKeySource({}, {});
    expect(result.exa).toBe("none");
    expect(result.tavily).toBe("none");
    expect(result.serper).toBe("none");
  });

  it("returns free for free providers", () => {
    const result = resolveKeySource({}, {});
    expect(result.exa_mcp).toBe("free");
    expect(result.duckduckgo).toBe("free");
  });

  it("resolves all providers", () => {
    const result = resolveKeySource({}, {});
    expect(result).toHaveProperty("serper");
    expect(result).toHaveProperty("tavily");
    expect(result).toHaveProperty("exa");
    expect(result).toHaveProperty("firecrawl");
    expect(result).toHaveProperty("mistral");
    expect(result).toHaveProperty("exa_mcp");
    expect(result).toHaveProperty("duckduckgo");
  });
});