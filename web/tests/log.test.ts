import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "../lib/log";

describe("Logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters debug entries with default minLevel='info'", () => {
    const logger = new Logger();
    logger.debug("skipped");
    logger.info("kept");
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toBe("kept");
  });

  it("captures all levels with minLevel='debug'", () => {
    const logger = new Logger("debug");
    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");
    expect(logger.getEntries()).toHaveLength(4);
  });

  it("returns entries in order", () => {
    const logger = new Logger("debug");
    logger.info("first");
    logger.warn("second");
    logger.error("third");
    const entries = logger.getEntries();
    expect(entries.map((e) => e.message)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("entries have timestamp, level, and message", () => {
    const logger = new Logger("debug");
    logger.info("hello");
    const entries = logger.getEntries();
    const entry = entries[0];
    expect(entry).toBeDefined();
    expect(entry?.timestamp).toBeTruthy();
    expect(new Date(entry!.timestamp).getTime()).not.toBeNaN();
    expect(entry?.level).toBe("info");
    expect(entry?.message).toBe("hello");
  });

  it("entries include provider when provided", () => {
    const logger = new Logger("debug");
    logger.info("msg", "openai");
    const entries = logger.getEntries();
    expect(entries[0]?.provider).toBe("openai");
  });

  it("entries include data when provided", () => {
    const logger = new Logger("debug");
    logger.info("msg", "openai", { key: "val" });
    const entries = logger.getEntries();
    expect(entries[0]?.data).toEqual({ key: "val" });
  });

  it("getProviderSummary counts attempts", () => {
    const logger = new Logger("debug");
    logger.info("attempt", "anthropic");
    logger.info("attempt", "anthropic");
    const summary = logger.getProviderSummary();
    expect(summary["anthropic"]?.attempts).toBe(2);
  });

  it("getProviderSummary counts successes with latencyMs", () => {
    const logger = new Logger("debug");
    logger.info("success", "openai", { latencyMs: 100 });
    logger.info("success", "openai", { latencyMs: 200 });
    const summary = logger.getProviderSummary();
    expect(summary["openai"]?.successes).toBe(2);
    expect(summary["openai"]?.totalMs).toBe(300);
  });

  it("getProviderSummary counts failures", () => {
    const logger = new Logger("debug");
    logger.error("failure", "google");
    const summary = logger.getProviderSummary();
    expect(summary["google"]?.failures).toBe(1);
  });

  it("getEntries returns a copy, not a reference", () => {
    const logger = new Logger("debug");
    logger.info("msg");
    const entries = logger.getEntries();
    entries.pop();
    expect(logger.getEntries()).toHaveLength(1);
  });
});
