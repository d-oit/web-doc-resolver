import { describe, expect, it, beforeEach } from "vitest";
import { get, set, clear, stats, configure, size } from "../lib/cache";

describe("cache", () => {
  beforeEach(() => {
    clear();
  });

  describe("get/set", () => {
    it("stores and retrieves values", async () => {
      await set("test-input", "test-source", { data: "test" });
      const result = await get("test-input", "test-source");
      expect(result).toEqual({ data: "test" });
    });

    it("returns null for missing keys", async () => {
      const result = await get("missing", "missing");
      expect(result).toBeNull();
    });

    it("respects TTL", async () => {
      await set("test", "source", { data: "test" }, 10); // 10ms TTL

      // Wait for expiry
      await new Promise<void>((resolve) => setTimeout(resolve, 20));

      const result = await get("test", "source");
      expect(result).toBeNull();
    });
  });

  describe("LRU eviction", () => {
    it("evicts old entries when max size reached", async () => {
      configure({ maxSize: 3 });

      await set("a", "source", 1);
      await set("b", "source", 2);
      await set("c", "source", 3);
      await set("d", "source", 4); // Should evict 'a'

      expect(size()).toBe(3);
      expect(await get("a", "source")).toBeNull();
      expect(await get("d", "source")).toBe(4);
    });

    it("updates access order on get", async () => {
      configure({ maxSize: 3 });

      await set("a", "source", 1);
      await set("b", "source", 2);
      await set("c", "source", 3);

      // Access 'a' to make it recently used
      await get("a", "source");

      // Add new entry - should evict 'b' (oldest), not 'a'
      await set("d", "source", 4);

      expect(await get("a", "source")).toBe(1);
      expect(await get("b", "source")).toBeNull();
    });
  });

  describe("stats", () => {
    it("tracks hits and misses", async () => {
      await set("test", "source", "data");

      await get("test", "source"); // hit
      await get("missing", "source"); // miss

      const s = stats();
      expect(s.hits).toBe(1);
      expect(s.misses).toBe(1);
      expect(s.hitRate).toBe(0.5);
    });
  });

  describe("clear", () => {
    it("clears all entries", async () => {
      await set("a", "source", 1);
      await set("b", "source", 2);

      clear();

      expect(size()).toBe(0);
      const s = stats();
      expect(s.hits).toBe(0);
      expect(s.misses).toBe(0);
    });
  });
});