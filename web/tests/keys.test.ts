import { describe, expect, it, beforeEach } from "vitest";
import {
  loadApiKeys,
  saveApiKeys,
  resolveKeySource,
} from "../lib/keys";
import type { ApiKeys } from "../lib/keys";

describe("keys", () => {
  beforeEach(() => {
    saveApiKeys({});
  });

  describe("loadApiKeys", () => {
    it("returns empty object initially", () => {
      expect(loadApiKeys()).toEqual({});
    });

    it("returns a copy, not a reference", () => {
      const keys = loadApiKeys();
      keys.serper_api_key = "injected";
      expect(loadApiKeys().serper_api_key).toBeUndefined();
    });
  });

  describe("saveApiKeys", () => {
    it("persists keys that loadApiKeys can retrieve", () => {
      const input: ApiKeys = { serper_api_key: "sk-test", tavily_api_key: "tvly-test" };
      saveApiKeys(input);
      expect(loadApiKeys()).toEqual(input);
    });

    it("replaces previous keys entirely", () => {
      saveApiKeys({ serper_api_key: "old" });
      saveApiKeys({ exa_api_key: "new" });
      expect(loadApiKeys()).toEqual({ exa_api_key: "new" });
    });

    it("does not expose internal reference", () => {
      const input: ApiKeys = { firecrawl_api_key: "fc-123" };
      saveApiKeys(input);
      input.firecrawl_api_key = "tampered";
      expect(loadApiKeys().firecrawl_api_key).toBe("fc-123");
    });
  });

  describe("resolveKeySource", () => {
    it("returns 'local' when local key is present", () => {
      const result = resolveKeySource(
        { serper_api_key: "sk-local" },
        { serper: false }
      );
      expect(result.serper).toBe("local");
    });

    it("returns 'server' when server status is true and no local key", () => {
      const result = resolveKeySource(
        {},
        { serper: true }
      );
      expect(result.serper).toBe("server");
    });

    it("returns 'none' when no local key and server status is false", () => {
      const result = resolveKeySource(
        {},
        { serper: false }
      );
      expect(result.serper).toBe("none");
    });

    it("always returns 'free' for exa_mcp and duckduckgo", () => {
      const result = resolveKeySource({}, {});
      expect(result.exa_mcp).toBe("free");
      expect(result.duckduckgo).toBe("free");
    });

    it("returns 'free' for exa_mcp and duckduckgo regardless of other keys", () => {
      const result = resolveKeySource(
        { exa_api_key: "exa-local", serper_api_key: "sk-123" },
        { tavily: true, firecrawl: true }
      );
      expect(result.exa_mcp).toBe("free");
      expect(result.duckduckgo).toBe("free");
    });

    it("handles empty inputs", () => {
      const result = resolveKeySource({}, {});
      expect(result).toEqual({
        serper: "none",
        tavily: "none",
        exa: "none",
        firecrawl: "none",
        mistral: "none",
        exa_mcp: "free",
        duckduckgo: "free",
      });
    });

    it("resolves all providers independently", () => {
      const result = resolveKeySource(
        { serper_api_key: "sk", exa_api_key: "exa" },
        { tavily: true, firecrawl: false, mistral: true }
      );
      expect(result.serper).toBe("local");
      expect(result.tavily).toBe("server");
      expect(result.exa).toBe("local");
      expect(result.firecrawl).toBe("none");
      expect(result.mistral).toBe("server");
    });

    it("prefers local over server", () => {
      const result = resolveKeySource(
        { mistral_api_key: "ml-local" },
        { mistral: true }
      );
      expect(result.mistral).toBe("local");
    });
  });
});
