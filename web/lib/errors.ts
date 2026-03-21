export enum ErrorType {
  RATE_LIMIT = "rate_limit",
  AUTH_ERROR = "auth_error",
  QUOTA_EXHAUSTED = "quota_exhausted",
  NETWORK_ERROR = "network_error",
  NOT_FOUND = "not_found",
  TIMEOUT = "timeout",
  INVALID_RESPONSE = "invalid_response",
  SSRF_BLOCKED = "ssrf_blocked",
  CONTENT_TOO_LARGE = "content_too_large",
  UNKNOWN = "unknown",
}

export interface ResolverError {
  type: ErrorType;
  provider: string;
  message: string;
  statusCode: number | undefined;
  retryable: boolean;
  userHint: string;
}

export function classifyError(
  provider: string,
  error: unknown,
  statusCode?: number
): ResolverError {
  const msg =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  if (statusCode === 429 || /rate.?limit|too many requests/i.test(msg)) {
    return {
      type: ErrorType.RATE_LIMIT,
      provider,
      message: msg,
      statusCode,
      retryable: true,
      userHint: `${provider} rate limited. Wait a moment and retry, or add your own API key.`,
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    /unauthorized|forbidden|invalid.?key/i.test(msg)
  ) {
    return {
      type: ErrorType.AUTH_ERROR,
      provider,
      message: msg,
      statusCode,
      retryable: false,
      userHint: `${provider} authentication failed. Check your API key in Settings.`,
    };
  }

  if (statusCode === 402 || /payment|credit|quota|exhausted/i.test(msg)) {
    return {
      type: ErrorType.QUOTA_EXHAUSTED,
      provider,
      message: msg,
      statusCode,
      retryable: false,
      userHint: `${provider} quota exhausted. Check your plan or add credits.`,
    };
  }

  if (statusCode === 404 || /not.?found/i.test(msg)) {
    return {
      type: ErrorType.NOT_FOUND,
      provider,
      message: msg,
      statusCode,
      retryable: false,
      userHint: `Content not found via ${provider}.`,
    };
  }

  if (/timeout|abort/i.test(msg)) {
    return {
      type: ErrorType.TIMEOUT,
      provider,
      message: msg,
      statusCode: undefined,
      retryable: true,
      userHint: `${provider} timed out. Retrying may help.`,
    };
  }

  if (/network|fetch|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
    return {
      type: ErrorType.NETWORK_ERROR,
      provider,
      message: msg,
      statusCode: undefined,
      retryable: true,
      userHint: `Network error contacting ${provider}. Check your connection.`,
    };
  }

  return {
    type: ErrorType.UNKNOWN,
    provider,
    message: msg,
    statusCode,
    retryable: true,
    userHint: `${provider} failed: ${msg}`,
  };
}

export function formatErrorForDisplay(errors: ResolverError[]): string {
  if (errors.length === 0) return "An unknown error occurred.";
  const first = errors[0]!;
  if (errors.length === 1) return first.userHint;

  const hints = errors.map((e) => `• ${e.userHint}`).join("\n");
  return `Multiple providers failed:\n${hints}`;
}
