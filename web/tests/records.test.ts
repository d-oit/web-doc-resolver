import { describe, expect, it, beforeEach, vi } from "vitest";
import { save, get, list, remove, clear, search, size, maxSize, configure, getAnalytics } from "../lib/records";

describe("records", () => {
  beforeEach(() => {
    clear();
    // Reset to default config
    configure({ maxEntries: 100, ttlMs: 30 * 24 * 60 * 60 * 1000 });
  });

  describe("save/get", () => {
    it("saves and retrieves records", () => {
      const record = save({
        query: "test query",
        url: null,
        content: "test content",
        source: "test",
        score: 0.8,
      });

      expect(record.id).toBeDefined();
      expect(record.timestamp).toBeDefined();
      expect(record.query).toBe("test query");

      const retrieved = get(record.id);
      expect(retrieved).toEqual(record);
    });

    it("returns undefined for missing records", () => {
      const result = get("non-existent");
      expect(result).toBeUndefined();
    });
  });

  describe("list", () => {
    it("lists records sorted by timestamp", async () => {
      save({ query: "first", url: null, content: "", source: "test", score: 0 });
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      save({ query: "second", url: null, content: "", source: "test", score: 0 });

      const records = list();
      expect(records.length).toBe(2);
      expect(records[0]?.query).toBe("second"); // Most recent first
    });

    it("respects limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        save({ query: `query-${i}`, url: null, content: "", source: "test", score: 0 });
      }

      const records = list(5);
      expect(records.length).toBe(5);
    });
  });

  describe("search", () => {
    it("searches by query", () => {
      save({ query: "react hooks", url: null, content: "", source: "test", score: 0 });
      save({ query: "vue components", url: null, content: "", source: "test", score: 0 });

      const results = search("react");
      expect(results.length).toBe(1);
      expect(results[0]?.query).toBe("react hooks");
    });

    it("searches by content", () => {
      save({ query: "test", url: null, content: "react documentation", source: "test", score: 0 });

      const results = search("react");
      expect(results.length).toBe(1);
    });

    it("is case-insensitive", () => {
      save({ query: "React Hooks", url: null, content: "", source: "test", score: 0 });
      
      const results = search("react");
      expect(results.length).toBe(1);
    });
  });

  describe("FIFO eviction", () => {
    it("evicts oldest entries when max size reached", () => {
      configure({ maxEntries: 3 });

      const first = save({ query: "first", url: null, content: "", source: "test", score: 0 });
      save({ query: "second", url: null, content: "", source: "test", score: 0 });
      save({ query: "third", url: null, content: "", source: "test", score: 0 });
      save({ query: "fourth", url: null, content: "", source: "test", score: 0 });

      expect(size()).toBe(3);
      expect(get(first.id)).toBeUndefined(); // Evicted
    });
  });

  describe("TTL expiration", () => {
    it("expires records after TTL", async () => {
      // Set very short TTL for testing
      configure({ ttlMs: 50 }); // 50ms

      const record = save({ query: "expires", url: null, content: "", source: "test", score: 0 });
      
      // Record should exist initially
      expect(get(record.id)).toBeDefined();
      
      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 60));
      
      // Record should be expired
      expect(get(record.id)).toBeUndefined();
    });

    it("cleans up expired records on save", async () => {
      configure({ ttlMs: 50 });

      save({ query: "expires1", url: null, content: "", source: "test", score: 0 });
      await new Promise((resolve) => setTimeout(resolve, 60));
      
      // This save should trigger cleanup
      save({ query: "new", url: null, content: "", source: "test", score: 0 });
      
      expect(size()).toBe(1);
    });

    it("filters expired records from list", async () => {
      configure({ ttlMs: 50 });

      save({ query: "expires", url: null, content: "", source: "test", score: 0 });
      await new Promise((resolve) => setTimeout(resolve, 60));
      
      const records = list();
      expect(records.length).toBe(0);
    });
  });

  describe("analytics", () => {
    it("returns analytics stats", () => {
      save({ query: "test1", url: null, content: "", source: "provider1", score: 0.9 });
      save({ query: "test2", url: null, content: "", source: "provider1", score: 0.8 });
      save({ query: "test3", url: null, content: "", source: "provider2", score: 0.7 });

      const analytics = getAnalytics();

      expect(analytics.totalRecords).toBe(3);
      expect(analytics.providerUsage["provider1"]).toBe(2);
      expect(analytics.providerUsage["provider2"]).toBe(1);
      expect(analytics.averageScore).toBeGreaterThan(0);
      expect(analytics.oldestRecord).toBeDefined();
      expect(analytics.newestRecord).toBeDefined();
    });

    it("handles empty store analytics", () => {
      const analytics = getAnalytics();

      expect(analytics.totalRecords).toBe(0);
      expect(analytics.averageScore).toBe(0);
      expect(analytics.oldestRecord).toBeNull();
      expect(analytics.newestRecord).toBeNull();
    });
  });

  describe("remove", () => {
    it("removes records by id", () => {
      const record = save({ query: "test", url: null, content: "", source: "test", score: 0 });

      const removed = remove(record.id);
      expect(removed).toBe(true);
      expect(get(record.id)).toBeUndefined();
    });

    it("returns false for non-existent records", () => {
      const removed = remove("non-existent");
      expect(removed).toBe(false);
    });
  });

  describe("clear", () => {
    it("clears all records", () => {
      save({ query: "test1", url: null, content: "", source: "test", score: 0 });
      save({ query: "test2", url: null, content: "", source: "test", score: 0 });

      const count = clear();
      expect(count).toBe(2);
      expect(size()).toBe(0);
    });
  });

  describe("maxSize", () => {
    it("returns configured max size", () => {
      configure({ maxEntries: 50 });
      expect(maxSize()).toBe(50);
    });
  });
});