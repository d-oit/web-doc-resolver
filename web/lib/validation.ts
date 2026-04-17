import { z } from "zod";
import ipaddr from "ipaddr.js";
import dns from "node:dns/promises";

// Maximum input lengths
const MAX_QUERY_LENGTH = 10000;
const MAX_URL_LENGTH = 2048;

/**
 * Check if an IP address is private or reserved
 */
function isPrivateIpAddress(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);
    const kind = addr.kind();

    // Handle IPv4-mapped IPv6 and similar encapsulations
    let effectiveAddr = addr;
    if (kind === "ipv6") {
      const v6addr = addr as ipaddr.IPv6;
      if (v6addr.isIPv4MappedAddress()) {
        effectiveAddr = v6addr.toIPv4Address();
      } else if (v6addr.range() === "rfc6145") {
        // RFC 6145 - IPv4-Translated addresses, extract the embedded IPv4
        // ipaddr.js parts for ::ffff:0:a.b.c.d are [0, 0, 0, 0, 0xffff, 0, high, low]
        // or similar depending on the exact format.
        // For ::ffff:0:127.0.0.1, parts are [0, 0, 0, 0, 0xffff, 0, 32512, 1]
        const parts = v6addr.parts;
        const ipv4Bytes = [
          (parts[6] >> 8) & 0xff,
          parts[6] & 0xff,
          (parts[7] >> 8) & 0xff,
          parts[7] & 0xff,
        ];
        effectiveAddr = ipaddr.fromByteArray(ipv4Bytes);
      }
    }

    const range = effectiveAddr.range();
    const blockedRanges = [
      "loopback",
      "private",
      "linkLocal",
      "unspecified",
      "broadcast",
      "carrierGradeNat",
      "reserved",
      "doc",
      "benchmarking",
      "amt",
      "teredo",
      "6to4",
      "multicast",
      "uniqueLocal",
      "rfc6145",
      "ipv4Mapped",
    ];

    return blockedRanges.includes(range);
  } catch {
    // If it's not a valid IP, it's not a private IP
    return false;
  }
}

function isBlockedInternalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  );
}

/**
 * Sanitize user input by removing control characters and limiting length
 */
export function sanitizeInput(input: string, maxLength = MAX_QUERY_LENGTH): string {
  // Remove control characters (except newline, tab)
  const cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
  // Limit length
  return cleaned.slice(0, maxLength);
}

/**
 * Async version of validateUrl that performs DNS resolution for hostnames.
 * Used before server-side fetching to prevent SSRF via DNS-based bypasses (e.g., nip.io).
 */
export async function validateUrlForFetchAsync(url: string): Promise<{ valid: boolean; error?: string }> {
  const syncResult = validateUrl(url);
  if (!syncResult.valid) return syncResult;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

    // Check if it's already a literal IP
    try {
      ipaddr.parse(hostname);
      // Literal IP already validated by sync validateUrl
      return { valid: true };
    } catch {
      // Not a literal IP, must be a domain name - resolve it
      const addresses = await dns.lookup(hostname, { all: true });
      for (const { address } of addresses) {
        if (isPrivateIpAddress(address)) {
          return { valid: false, error: `Domain resolves to private/internal IP: ${address}` };
        }
      }
    }

    return { valid: true };
  } catch (err) {
    // If resolution fails, we block it to be safe
    return { valid: false, error: "DNS resolution failed or invalid URL" };
  }
}

/**
 * Validate URL for SSRF protection (Synchronous, string-only check)
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, error: "URL too long" };
  }

  try {
    const parsed = new URL(url);

    // Only allow http(s)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

    // Block private/internal IPs and hostnames
    if (isPrivateIpAddress(hostname) || isBlockedInternalHostname(hostname)) {
      return { valid: false, error: "Private/internal URLs are not allowed" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

// Zod schema for resolve request
export const ResolveRequestSchema = z.object({
  query: z.string().max(MAX_QUERY_LENGTH).optional(),
  url: z.string().url().max(MAX_URL_LENGTH).optional(),
  providers: z.array(z.string()).max(20).optional(),
  maxChars: z.number().min(100).max(50000).optional(),
  profile: z.enum(["free", "fast", "balanced", "quality"]).optional(),
  deepResearch: z.boolean().optional(),
  skipCache: z.boolean().optional(),
}).refine((data) => data.query || data.url, {
  message: "Either query or url is required",
});

export type ResolveRequest = z.infer<typeof ResolveRequestSchema>;

/**
 * Validate and sanitize resolve request
 */
export function validateResolveRequest(data: unknown): {
  success: boolean;
  data?: ResolveRequest;
  error?: string;
} {
  try {
    const result = ResolveRequestSchema.safeParse(data);
    if (!result.success) {
      const errorMessage = result.error.issues[0]?.message || "Invalid request";
      return { success: false, error: errorMessage };
    }

    // Sanitize query if present
    if (result.data.query) {
      result.data.query = sanitizeInput(result.data.query);
    }

    // Validate URL if present
    if (result.data.url) {
      const urlValidation = validateUrl(result.data.url);
      if (!urlValidation.valid) {
        return { success: false, error: urlValidation.error || "Invalid URL" };
      }
    }

    return { success: true, data: result.data };
  } catch (err) {
    return { success: false, error: "Invalid request format" };
  }
}
