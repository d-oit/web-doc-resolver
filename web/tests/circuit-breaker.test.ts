import { describe, expect, it, beforeEach } from "vitest";
import { CircuitBreaker, CircuitBreakerRegistry } from "../lib/circuit-breaker";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker();
  });

  describe("isOpen", () => {
    it("is closed initially", () => {
      expect(breaker.isOpen()).toBe(false);
    });

    it("opens after threshold failures", () => {
      breaker.recordFailure(3, 60000);
      breaker.recordFailure(3, 60000);
      breaker.recordFailure(3, 60000);
      expect(breaker.isOpen()).toBe(true);
    });

    it("stays closed below threshold", () => {
      breaker.recordFailure(3, 60000);
      breaker.recordFailure(3, 60000);
      expect(breaker.isOpen()).toBe(false);
    });

    it("closes after cooldown expires", () => {
      breaker.recordFailure(3, 10); // 10ms cooldown, threshold 3
      breaker.recordFailure(3, 10);
      breaker.recordFailure(3, 10);
      expect(breaker.isOpen()).toBe(true);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(breaker.isOpen()).toBe(false);
          resolve();
        }, 20);
      });
    });
  });

  describe("recordFailure", () => {
    it("increments failure count", () => {
      breaker.recordFailure(10, 60000);
      expect(breaker.failures).toBe(1);
      breaker.recordFailure(10, 60000);
      expect(breaker.failures).toBe(2);
    });

    it("sets openUntil when threshold reached", () => {
      breaker.recordFailure(2, 60000);
      expect(breaker.openUntil).toBe(null);
      breaker.recordFailure(2, 60000);
      expect(breaker.openUntil).not.toBe(null);
    });
  });

  describe("recordSuccess", () => {
    it("resets failure count", () => {
      breaker.recordFailure(5, 60000);
      breaker.recordFailure(5, 60000);
      breaker.recordSuccess();
      expect(breaker.failures).toBe(0);
    });

    it("closes the breaker", () => {
      breaker.recordFailure(3, 60000);
      breaker.recordFailure(3, 60000);
      breaker.recordFailure(3, 60000);
      expect(breaker.isOpen()).toBe(true);
      breaker.recordSuccess();
      expect(breaker.isOpen()).toBe(false);
      expect(breaker.openUntil).toBe(null);
    });
  });
});

describe("CircuitBreakerRegistry", () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry();
  });

  describe("get", () => {
    it("creates breaker for new provider", () => {
      const breaker = registry.get("exa");
      expect(breaker).toBeDefined();
    });

    it("returns same breaker for same provider", () => {
      const breaker1 = registry.get("exa");
      const breaker2 = registry.get("exa");
      expect(breaker1).toBe(breaker2);
    });

    it("returns different breakers for different providers", () => {
      const exa = registry.get("exa");
      const tavily = registry.get("tavily");
      expect(exa).not.toBe(tavily);
    });
  });

  describe("isOpen", () => {
    it("returns false for new provider", () => {
      expect(registry.isOpen("exa")).toBe(false);
    });

    it("returns true after failures exceed threshold", () => {
      registry.recordFailure("exa", 3, 60000);
      registry.recordFailure("exa", 3, 60000);
      registry.recordFailure("exa", 3, 60000);
      expect(registry.isOpen("exa")).toBe(true);
    });
  });

  describe("recordFailure/recordSuccess", () => {
    it("affects breaker state", () => {
      registry.recordFailure("exa", 2, 60000);
      registry.recordFailure("exa", 2, 60000);
      expect(registry.isOpen("exa")).toBe(true);

      registry.recordSuccess("exa");
      expect(registry.isOpen("exa")).toBe(false);
    });
  });
});