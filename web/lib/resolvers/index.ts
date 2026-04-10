import { Logger } from "@/lib/log";
import type { ProviderMetrics } from "@/lib/providers";
import {
  extractViaLlmsTxt,
  extractViaJina,
  extractViaDirectFetch,
  extractViaFirecrawl,
  extractViaMistralBrowser,
} from "./url";
import {
  searchViaExaMcp,
  searchViaExaSdk,
  searchViaSerper,
  searchViaTavily,
  searchViaDuckDuckGoLite,
  searchViaDuckDuckGoFree,
  searchViaMistralWeb,
} from "./query";

export type ProviderFn = (
  query: string,
  keys: ProviderKeys,
  log: Logger
) => Promise<string | null>;

export interface ProviderKeys {
  SERPER_API_KEY?: string;
  TAVILY_API_KEY?: string;
  EXA_API_KEY?: string;
  FIRECRAWL_API_KEY?: string;
  MISTRAL_API_KEY?: string;
}

export function isUrl(input: string): boolean {
  return /^https?:\/\/\S+$/i.test(input.trim());
}

export const queryProviders: Record<string, ProviderFn> = {
  exa_mcp: async (q, _k, log) => searchViaExaMcp(q, log),
  exa: async (q, k, log) => searchViaExaSdk(q, k.EXA_API_KEY || "", log),
  serper: async (q, k, log) => searchViaSerper(q, k.SERPER_API_KEY || "", log),
  tavily: async (q, k, log) => searchViaTavily(q, k.TAVILY_API_KEY || "", log),
  duckduckgo: async (q, _k, log) =>
    (await searchViaDuckDuckGoLite(q, log)) || (await searchViaDuckDuckGoFree(q, log)),
  mistral_websearch: async (q, k, log) =>
    searchViaMistralWeb(q, k.MISTRAL_API_KEY || "", log),
};

export const urlProviders: Record<string, ProviderFn> = {
  llms_txt: async (q, _k, log) => extractViaLlmsTxt(q, log),
  jina: async (q, _k, log) => extractViaJina(q, log),
  firecrawl: async (q, k, log) => extractViaFirecrawl(q, k.FIRECRAWL_API_KEY || "", log),
  direct_fetch: async (q, _k, log) => extractViaDirectFetch(q, log),
  mistral_browser: async (q, k, log) =>
    extractViaMistralBrowser(q, k.MISTRAL_API_KEY || "", log),
};

export const paidProviders = new Set(["exa", "serper", "tavily", "firecrawl", "mistral_websearch", "mistral_browser"]);

export interface RunResult {
  markdown: string;
  source: string;
  metrics: ProviderMetrics[];
  depth: number;
}

export async function runSequential(
  providers: Record<string, ProviderFn>,
  providerNames: string[],
  query: string,
  keys: ProviderKeys,
  log: Logger
): Promise<RunResult> {
  const metrics: ProviderMetrics[] = [];
  let depth = 0;

  for (const name of providerNames) {
    depth++;
    const fn = providers[name];
    if (!fn) continue;
    const start = Date.now();
    try {
      const result = await fn(query, keys, log);
      const latencyMs = Date.now() - start;
      metrics.push({
        provider: name,
        latencyMs,
        success: !!result,
        paid: paidProviders.has(name),
      });
      if (result) {
        return { markdown: result, source: name, metrics, depth };
      }
    } catch (e) {
      metrics.push({
        provider: name,
        latencyMs: Date.now() - start,
        success: false,
        paid: paidProviders.has(name),
        errorType: e instanceof Error ? e.constructor.name : "Unknown",
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  }

  throw new Error(
    "No results found. Try adding API keys in Settings for better coverage."
  );
}

export async function runParallel(
  providers: Record<string, ProviderFn>,
  providerNames: string[],
  query: string,
  keys: ProviderKeys,
  log: Logger
): Promise<RunResult> {
  const results = await Promise.all(
    providerNames.map(async (name) => {
      const fn = providers[name];
      if (!fn) return { name, result: null, latencyMs: 0 };
      const start = Date.now();
      try {
        const result = await fn(query, keys, log);
        return { name, result, latencyMs: Date.now() - start };
      } catch {
        return { name, result: null, latencyMs: Date.now() - start };
      }
    })
  );

  const metrics: ProviderMetrics[] = results.map((r) => ({
    provider: r.name,
    latencyMs: r.latencyMs,
    success: !!r.result,
    paid: paidProviders.has(r.name),
  }));

  const successful = results.filter((r) => r.result !== null);
  if (successful.length === 0) {
    throw new Error(
      "No results found from any provider. Try adding API keys in Settings."
    );
  }

  const markdown = successful
    .map((r) => `## Results from ${r.name}\n\n${r.result}`)
    .join("\n\n---\n\n");

  return {
    markdown,
    source: successful.map((r) => r.name).join(", "),
    metrics,
    depth: results.length,
  };
}
