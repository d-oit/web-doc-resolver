export interface ApiKeys {
  serper_api_key?: string;
  tavily_api_key?: string;
  exa_api_key?: string;
  firecrawl_api_key?: string;
  mistral_api_key?: string;
}

const STORAGE_KEY = "web-resolver-api-keys";

export function loadApiKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveApiKeys(keys: ApiKeys): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Ignore storage errors
  }
}

export type KeySource = "local" | "server" | "free" | "none";

export function resolveKeySource(
  localKeys: ApiKeys,
  serverStatus: Record<string, boolean>
): Record<string, KeySource> {
  return {
    serper: localKeys.serper_api_key ? "local" : serverStatus.serper ? "server" : "none",
    tavily: localKeys.tavily_api_key ? "local" : serverStatus.tavily ? "server" : "none",
    exa: localKeys.exa_api_key ? "local" : serverStatus.exa ? "server" : "none",
    firecrawl: localKeys.firecrawl_api_key ? "local" : serverStatus.firecrawl ? "server" : "none",
    mistral: localKeys.mistral_api_key ? "local" : serverStatus.mistral ? "server" : "none",
    exa_mcp: "free",
    duckduckgo: "free",
  };
}
