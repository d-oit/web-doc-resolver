import { describe, expect, it, beforeEach } from "vitest";
import { save, get, list, remove, clear, search, size, maxSize, configure } from "../lib/records";

describe("records", () => {
  beforeEach(() => {
    clear();
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
  });

  describe("FIFO eviction", () => {
    it("evicts oldest entries when max size reached", () => {
      configure({ maxEntries: 3 });

      save({ query: "first", url: null, content: "", source: "test", score: 0 });
      save({ query: "second", url: null, content: "", source: "test", score: 0 });
      save({ query: "third", url: null, content: "", source: "test", score: 0 });
      save({ query: "fourth", url: null, content: "", source: "test", score: 0 });

      expect(size()).toBe(3);
      expect(get("first")).toBeUndefined(); // Evicted
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
});