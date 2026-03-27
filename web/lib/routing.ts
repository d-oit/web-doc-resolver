export type BudgetProfile = "free" | "fast" | "balanced" | "quality";

export interface BudgetConfig {
  maxProviderAttempts: number;
  maxPaidAttempts: number;
  maxTotalLatencyMs: number;
  allowPaid: boolean;
}

export const BUDGET_PROFILES: Record<BudgetProfile, BudgetConfig> = {
  free: { maxProviderAttempts: 3, maxPaidAttempts: 0, maxTotalLatencyMs: 6000, allowPaid: false },
  fast: { maxProviderAttempts: 2, maxPaidAttempts: 1, maxTotalLatencyMs: 4000, allowPaid: true },
  balanced: { maxProviderAttempts: 6, maxPaidAttempts: 2, maxTotalLatencyMs: 12000, allowPaid: true },
  quality: { maxProviderAttempts: 10, maxPaidAttempts: 5, maxTotalLatencyMs: 20000, allowPaid: true },
};

export interface BudgetState {
  attempts: number;
  paidAttempts: number;
  elapsedMs: number;
  stopReason: string | null;
}

export class ResolutionBudget {
  private config: BudgetConfig;
  private state: BudgetState;

  constructor(profile: BudgetProfile = "balanced") {
    this.config = BUDGET_PROFILES[profile];
    this.state = { attempts: 0, paidAttempts: 0, elapsedMs: 0, stopReason: null };
  }

  canTry(isPaid: boolean): boolean {
    const { maxProviderAttempts, maxPaidAttempts, maxTotalLatencyMs, allowPaid } = this.config;
    if (this.state.attempts >= maxProviderAttempts) {
      this.state.stopReason = "max_provider_attempts";
      return false;
    }
    if (isPaid && !allowPaid) {
      this.state.stopReason = "paid_disabled";
      return false;
    }
    if (isPaid && this.state.paidAttempts >= maxPaidAttempts) {
      this.state.stopReason = "max_paid_attempts";
      return false;
    }
    if (this.state.elapsedMs >= maxTotalLatencyMs) {
      this.state.stopReason = "max_total_latency_ms";
      return false;
    }
    return true;
  }

  recordAttempt(isPaid: boolean, latencyMs: number): void {
    this.state.attempts++;
    this.state.elapsedMs += latencyMs;
    if (isPaid) this.state.paidAttempts++;
  }

  getState(): Readonly<BudgetState> {
    return this.state;
  }
}

const QUERY_CASCADE = ["exa_mcp", "exa", "tavily", "serper", "mistral_websearch", "duckduckgo"] as const;

const URL_DEFAULT = ["jina", "firecrawl", "direct_fetch", "mistral_browser"];
const URL_JS_HEAVY = ["firecrawl", "mistral_browser", "jina", "direct_fetch"];

const PAID_PROVIDERS = new Set(["exa", "serper", "tavily", "firecrawl", "mistral_websearch", "mistral_browser", "exa_mcp_mistral"]);

export function isPaidProvider(provider: string): boolean {
  return PAID_PROVIDERS.has(provider);
}

export function planProviderOrder(opts: {
  isUrl: boolean;
  jsHeavy?: boolean;
  customOrder?: string[];
  skipProviders?: Set<string>;
  keys?: { MISTRAL_API_KEY?: string; mistral_api_key?: string };
}): string[] {
  let base: string[];
  if (opts.customOrder?.length) {
    base = [...opts.customOrder];
  } else if (opts.isUrl) {
    base = opts.jsHeavy ? [...URL_JS_HEAVY] : [...URL_DEFAULT];
  } else {
    base = [...QUERY_CASCADE];
    if (opts.keys && (opts.keys.MISTRAL_API_KEY || opts.keys.mistral_api_key)) {
      base = base.filter((p) => p !== "duckduckgo");
      const mistralIdx = base.indexOf("mistral_websearch");
      if (mistralIdx > -1) {
        const mistral = base.splice(mistralIdx, 1)[0];
        if (mistral) base.unshift(mistral);
      }
    }
  }
  if (opts.skipProviders?.size) {
    base = base.filter((p) => !opts.skipProviders!.has(p));
  }
  return base;
}

export function detectJsHeavy(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes("notion.") || host.includes("confluence") || host.endsWith(".atlassian.net")) return true;
    return false;
  } catch {
    return false;
  }
}
