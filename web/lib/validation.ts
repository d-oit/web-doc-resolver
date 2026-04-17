import { z } from "zod";

// Maximum input lengths
const MAX_QUERY_LENGTH = 10000;
const MAX_URL_LENGTH = 2048;

// Private IP ranges for SSRF protection
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^::1$/,
  /^::$/,
  /^::ffff:/i,
  /^fc/i,
  /^fd/i,
  /^fe80/i,
  /^2001:db8/i,
  /^0\.0\.0\.0$/,
  /^localhost$/i,
];

function isPrivateIp(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
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
