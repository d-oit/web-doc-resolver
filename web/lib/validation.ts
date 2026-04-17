import { z } from "zod";

// Maximum input lengths
const MAX_QUERY_LENGTH = 10000;
const MAX_URL_LENGTH = 2048;

// Private and reserved IP ranges for SSRF protection
const PRIVATE_IP_RANGES = [
  // IPv4 Loopback and Reserved
  /^127\.\d+\.\d+\.\d+$/,
  /^0\.\d+\.\d+\.\d+$/,
  // IPv4 Private Ranges (RFC 1918)
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  // IPv4 Link-Local
  /^169\.254\.\d+\.\d+$/,
  // IPv4 CGNAT (100.64.0.0/10)
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.\d+\.\d+$/,
  // IPv4 Documentation (RFC 5737)
  /^192\.0\.2\.\d+$/,
  /^198\.51\.100\.\d+$/,
  /^203\.0\.113\.\d+$/,
  // IPv4 Benchmarking (RFC 2544)
  /^198\.(1[89])\.\d+\.\d+$/,
  // IPv4 Other reserved/special
  /^192\.0\.0\.\d+$/,
  /^192\.88\.99\.\d+$/,
  /^224\.\d+\.\d+\.\d+$/, // Multicast
  /^240\.\d+\.\d+\.\d+$/, // Reserved
  /^255\.255\.255\.255$/,
  // IPv6 Loopback and Unspecified
  /^::1$/,
  /^::$/,
  // IPv4-mapped IPv6
  /^::ffff:((\d+\.\d+\.\d+\.\d+)|([\da-fA-F]{1,4}:[\da-fA-F]{1,4}))$/i,
  // IPv6 Unique Local Address (fc00::/7)
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  // IPv6 Link-Local (fe80::/10)
  /^fe[89ab][0-9a-f]:/i,
  // IPv6 Documentation (2001:db8::/32)
  /^2001:db8:/i,
  // IPv6 Discard-Only (100::/64)
  /^100:/i,
  // IPv6 Well-Known Prefix (64:ff9b::/96)
  /^64:ff9b:/i,
  // Localhost
  /^localhost$/i,
];

function isPrivateIp(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  // If it's localhost, block it
  if (normalized === "localhost") return true;

  // Check if the hostname looks like an IPv4 or IPv6 address before checking private ranges
  // This prevents false positives for domain names that happen to start with private IP prefixes
  const isIpv4 = /^\d+\.\d+\.\d+\.\d+$/.test(normalized);
  const isIpv6 = normalized.includes(":") || /^[0-9a-f]+$/.test(normalized);

  if (!isIpv4 && !isIpv6) {
    return false;
  }

  return PRIVATE_IP_RANGES.some((range) => range.test(normalized));
}

function isBlockedInternalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized.endsWith(".local") || normalized.endsWith(".internal");
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
 * Validate URL for SSRF protection
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

    // Block private/internal IPs
    if (isPrivateIp(parsed.hostname) || isBlockedInternalHostname(parsed.hostname)) {
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
