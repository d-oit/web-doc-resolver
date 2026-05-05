export type ProfileId = "free" | "balanced" | "fast" | "quality" | "custom";

export interface UiProvider {
  id: string;
  label: string;
  free: boolean;
  sourceKey?: string;
  type: "query" | "url" | "both";
}

// Providers in CLI cascade order (see web/lib/routing.ts QUERY_CASCADE)
export const PROVIDERS: UiProvider[] = [
  { id: "exa_mcp", label: "Exa MCP", free: true, type: "query" },
  { id: "exa", label: "Exa SDK", free: false, sourceKey: "exa", type: "query" },
  { id: "tavily", label: "Tavily", free: false, type: "query" },
  { id: "serper", label: "Serper", free: false, type: "query" },
  { id: "firecrawl", label: "Firecrawl", free: false, type: "url" },
  { id: "mistral", label: "Mistral", free: false, sourceKey: "mistral", type: "both" },
  { id: "duckduckgo", label: "DuckDuckGo", free: true, type: "query" },
];

// Profiles with providers in cascade order
export const PROFILES: Array<{ id: ProfileId; label: string; providers: string[] }> = [
  { id: "free", label: "Free", providers: ["exa_mcp", "duckduckgo"] },
  { id: "fast", label: "Fast", providers: ["exa_mcp", "serper"] },
  { id: "balanced", label: "Balanced", providers: ["exa_mcp", "tavily", "serper", "firecrawl", "duckduckgo"] },
  { id: "quality", label: "Quality", providers: ["exa_mcp", "exa", "tavily", "serper", "firecrawl", "mistral", "duckduckgo"] },
  { id: "custom", label: "Custom", providers: [] },
];

export function toApiProviderId(providerId: string): string {
  if (providerId === "mistral") return "mistral_websearch";
  return providerId;
}
