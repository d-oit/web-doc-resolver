const DEFAULT_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 300_000; // 5 minutes

export class CircuitBreaker {
  failures = 0;
  openUntil: number | null = null; // epoch ms

  isOpen(now = Date.now()): boolean {
    if (this.openUntil === null) return false;
    return this.openUntil > now;
  }

  recordFailure(threshold = DEFAULT_THRESHOLD, cooldownMs = DEFAULT_COOLDOWN_MS): void {
    this.failures++;
    if (this.failures >= threshold) {
      this.openUntil = Date.now() + cooldownMs;
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntil = null;
  }
}

export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(provider: string): CircuitBreaker {
    let b = this.breakers.get(provider);
    if (!b) {
      b = new CircuitBreaker();
      this.breakers.set(provider, b);
    }
    return b;
  }

  isOpen(provider: string): boolean {
    return this.get(provider).isOpen();
  }

  recordFailure(provider: string, threshold?: number, cooldownMs?: number): void {
    this.get(provider).recordFailure(threshold, cooldownMs);
  }

  recordSuccess(provider: string): void {
    this.get(provider).recordSuccess();
  }
}
