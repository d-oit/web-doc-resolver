interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Default rate limits
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute
};

// In-memory store for rate limiting
const requests = new Map<string, RateLimitEntry>();

/**
 * Check if a request is allowed under rate limiting
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = requests.get(identifier);

  // No entry or window expired - create new entry
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs;
    requests.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Get client identifier from request
 * Uses IP address (x-forwarded-for) as identifier
 */
export function getClientIdentifier(request: Request): string {
  // Try x-forwarded-for header (set by Vercel/proxy)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take first IP in chain (client IP)
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  // Fallback to x-real-ip
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Default identifier
  return "unknown";
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of requests) {
    if (now > entry.resetAt) {
      requests.delete(key);
      cleaned++;
    }
  }
  return cleaned;
}

/**
 * Clear all rate limit entries
 */
export function clearRateLimits(): void {
  requests.clear();
}

/**
 * Get rate limit stats
 */
export function getRateLimitStats(): { totalEntries: number; activeEntries: number } {
  const now = Date.now();
  let active = 0;
  for (const entry of requests.values()) {
    if (now <= entry.resetAt) active++;
  }
  return { totalEntries: requests.size, activeEntries: active };
}