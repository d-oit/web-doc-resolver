import { describe, it, expect } from "vitest";
import { CircuitBreaker, CircuitBreakerRegistry } from "../lib/circuit-breaker";

describe("CircuitBreaker", () => {
  it("starts closed", () => {
    const cb = new CircuitBreaker();
    expect(cb.isOpen()).toBe(false);
    expect(cb.failures).toBe(0);
    expect(cb.openUntil).toBeNull();
  });

  it("increments failures on recordFailure", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    expect(cb.failures).toBe(1);
    cb.recordFailure();
    expect(cb.failures).toBe(2);
  });

  it("opens circuit at default threshold of 3", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);
  });

  it("resets failures and openUntil on recordSuccess", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);
    cb.recordSuccess();
    expect(cb.failures).toBe(0);
    expect(cb.openUntil).toBeNull();
    expect(cb.isOpen()).toBe(false);
  });

  it("isOpen respects custom now parameter", () => {
    const cb = new CircuitBreaker();
    cb.openUntil = 1000;
    expect(cb.isOpen(500)).toBe(true);
    expect(cb.isOpen(1000)).toBe(false);
    expect(cb.isOpen(1500)).toBe(false);
  });

  it("works with custom threshold and cooldown", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure(2, 1000);
    cb.recordFailure(2, 1000);
    expect(cb.isOpen()).toBe(true);
    expect(cb.failures).toBe(2);
  });

  it("cooldown duration is respected", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure(1, 1000);
    expect(cb.isOpen()).toBe(true);
    expect(cb.openUntil).toBeGreaterThan(Date.now());
    cb.openUntil = Date.now() - 1;
    expect(cb.isOpen()).toBe(false);
  });
});

describe("CircuitBreakerRegistry", () => {
  it("creates breakers on demand", () => {
    const registry = new CircuitBreakerRegistry();
    const cb = registry.get("provider-a");
    expect(cb).toBeInstanceOf(CircuitBreaker);
    expect(registry.get("provider-a")).toBe(cb);
  });

  it("returns different breakers for different providers", () => {
    const registry = new CircuitBreakerRegistry();
    const a = registry.get("a");
    const b = registry.get("b");
    expect(a).not.toBe(b);
  });

  it("delegates isOpen to provider's breaker", () => {
    const registry = new CircuitBreakerRegistry();
    expect(registry.isOpen("p")).toBe(false);
    registry.recordFailure("p");
    registry.recordFailure("p");
    registry.recordFailure("p");
    expect(registry.isOpen("p")).toBe(true);
  });

  it("delegates recordFailure with custom threshold", () => {
    const registry = new CircuitBreakerRegistry();
    registry.recordFailure("p", 2, 5000);
    registry.recordFailure("p", 2, 5000);
    expect(registry.isOpen("p")).toBe(true);
  });

  it("delegates recordSuccess to reset state", () => {
    const registry = new CircuitBreakerRegistry();
    registry.recordFailure("p");
    registry.recordFailure("p");
    registry.recordFailure("p");
    expect(registry.isOpen("p")).toBe(true);
    registry.recordSuccess("p");
    expect(registry.isOpen("p")).toBe(false);
  });
});
