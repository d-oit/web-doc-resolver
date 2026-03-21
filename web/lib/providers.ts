export interface ProviderDef {
  id: string;
  label: string;
  description: string;
  type: "query" | "url" | "both";
  free: boolean;
  envKey?: string;
  keyLabel?: string;
  keyPlaceholder?: string;
  alwaysActive: boolean;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "exa_mcp",
    label: "Exa MCP",
    description: "Free neural search via Model Context Protocol",
    type: "query",
    free: true,
    alwaysActive: true,
  },
  {
    id: "duckduckgo",
    label: "DuckDuckGo",
    description: "Free search via DDG Lite + Jina Reader",
    type: "query",
    free: true,
    alwaysActive: true,
  },
  {
    id: "exa",
    label: "Exa SDK",
    description: "Exa API with higher rate limits and features",
    type: "query",
    free: false,
    envKey: "EXA_API_KEY",
    keyLabel: "Exa API Key",
    keyPlaceholder: "exa.ai",
    alwaysActive: false,
  },
  {
    id: "serper",
    label: "Serper",
    description: "Google search results (2500 free credits)",
    type: "query",
    free: false,
    envKey: "SERPER_API_KEY",
    keyLabel: "Serper API Key",
    keyPlaceholder: "serper.dev",
    alwaysActive: false,
  },
  {
    id: "tavily",
    label: "Tavily",
    description: "Comprehensive search with raw content",
    type: "query",
    free: false,
    envKey: "TAVILY_API_KEY",
    keyLabel: "Tavily API Key",
    keyPlaceholder: "tavily.com",
    alwaysActive: false,
  },
  {
    id: "mistral_websearch",
    label: "Mistral Web Search",
    description: "AI-powered web search (requires Mistral key)",
    type: "query",
    free: false,
    envKey: "MISTRAL_API_KEY",
    keyLabel: "Mistral API Key",
    keyPlaceholder: "mistral.ai",
    alwaysActive: false,
  },
  {
    id: "firecrawl",
    label: "Firecrawl",
    description: "Deep JS-rendered extraction (requires key)",
    type: "url",
    free: false,
    envKey: "FIRECRAWL_API_KEY",
    keyLabel: "Firecrawl API Key",
    keyPlaceholder: "firecrawl.dev",
    alwaysActive: false,
  },
];

export function getProvidersForKeys(keys: Record<string, string>): ProviderDef[] {
  return PROVIDERS.filter((p) => {
    if (p.alwaysActive) return true;
    if (p.free) return true;
    if (!p.envKey) return true;
    return !!keys[p.envKey];
  });
}

export function getFreeQueryProviders(): string[] {
  return PROVIDERS.filter((p) => p.free && (p.type === "query" || p.type === "both")).map((p) => p.id);
}

export function getAllQueryProviders(keys: Record<string, string>): string[] {
  return getProvidersForKeys(keys)
    .filter((p) => p.type === "query" || p.type === "both")
    .map((p) => p.id);
}

export function getUrlProviders(keys: Record<string, string>): string[] {
  const base = ["jina", "direct_fetch"];
  if (keys.FIRECRAWL_API_KEY || keys.firecrawl_api_key) base.splice(1, 0, "firecrawl");
  return base;
}

export type Profile = "free" | "balanced" | "fast" | "quality";

export interface ProfileConfig {
  maxProviders: number;
  maxPaid: number;
  maxLatencyMs: number;
  allowPaid: boolean;
}

export const PROFILES: Record<Profile, ProfileConfig> = {
  free: { maxProviders: 3, maxPaid: 0, maxLatencyMs: 6000, allowPaid: false },
  balanced: { maxProviders: 6, maxPaid: 2, maxLatencyMs: 12000, allowPaid: true },
  fast: { maxProviders: 2, maxPaid: 1, maxLatencyMs: 4000, allowPaid: true },
  quality: { maxProviders: 10, maxPaid: 5, maxLatencyMs: 20000, allowPaid: true },
};

export interface ProviderMetrics {
  provider: string;
  latencyMs: number;
  success: boolean;
  paid: boolean;
  errorType?: string;
  errorMessage?: string;
}

export interface ResolveResponse {
  markdown: string;
  source: string;
  metrics: {
    totalLatencyMs: number;
    providers: ProviderMetrics[];
    cascadeDepth: number;
    paidUsed: boolean;
  };
}
