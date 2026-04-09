import { NextRequest, NextResponse } from "next/server";
import { ResolutionBudget, planProviderOrder, detectJsHeavy, isPaidProvider } from "@/lib/routing";
import { CircuitBreakerRegistry } from "@/lib/circuit-breaker";
import { scoreContent, QualityScore } from "@/lib/quality";
import * as cache from "@/lib/cache";
import { save as saveRecord } from "@/lib/records";
import { Logger } from "@/lib/log";
import { searchViaExaMcpWithMistral } from "@/lib/resolvers/query";
import { isUrl, queryProviders, urlProviders, ProviderKeys } from "@/lib/resolvers/index";
import { validateResolveRequest } from "@/lib/validation";

// Allow up to 60 seconds for resolver operations
export const maxDuration = 60;

const DEFAULT_MAX_CHARS = parseInt(process.env.WEB_RESOLVER_MAX_CHARS || "8000");

// Singleton circuit breaker registry (survives across warm invocations)
const circuitBreakers = new CircuitBreakerRegistry();

// Query provider functions using Logger
async function runQueryProvider(
  provider: string,
  query: string,
  keys: ProviderKeys,
  log: Logger,
  maxChars: number
): Promise<string | null> {
  // Special case: exa_mcp_mistral combo not in shared map
  if (provider === "exa_mcp_mistral") {
    return searchViaExaMcpWithMistral(query, keys.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY || "", log);
  }
  // Validate provider against allowlist before dynamic dispatch
  const allowedProviders = ["exa_mcp", "exa", "serper", "tavily", "duckduckgo", "mistral_websearch"];
  if (!allowedProviders.includes(provider)) return null;
  const fn = queryProviders[provider];
  if (!fn) return null;
  // Merge process.env fallbacks into keys
  const mergedKeys: ProviderKeys = { ...keys };
  if (!mergedKeys.EXA_API_KEY && process.env.EXA_API_KEY) mergedKeys.EXA_API_KEY = process.env.EXA_API_KEY;
  if (!mergedKeys.SERPER_API_KEY && process.env.SERPER_API_KEY) mergedKeys.SERPER_API_KEY = process.env.SERPER_API_KEY;
  if (!mergedKeys.TAVILY_API_KEY && process.env.TAVILY_API_KEY) mergedKeys.TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!mergedKeys.FIRECRAWL_API_KEY && process.env.FIRECRAWL_API_KEY) mergedKeys.FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!mergedKeys.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY) mergedKeys.MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
  return fn(query, mergedKeys, log);
}

// URL provider functions using Logger
async function runUrlProvider(
  provider: string,
  url: string,
  keys: ProviderKeys,
  log: Logger,
  maxChars: number
): Promise<string | null> {
  // Validate provider against allowlist before dynamic dispatch
  const allowedProviders = ["llms_txt", "jina", "firecrawl", "direct_fetch", "mistral_browser"];
  if (!allowedProviders.includes(provider)) return null;
  const fn = urlProviders[provider];
  if (!fn) return null;
  // Merge process.env fallbacks into keys
  const mergedKeys: ProviderKeys = { ...keys };
  if (!mergedKeys.EXA_API_KEY && process.env.EXA_API_KEY) mergedKeys.EXA_API_KEY = process.env.EXA_API_KEY;
  if (!mergedKeys.SERPER_API_KEY && process.env.SERPER_API_KEY) mergedKeys.SERPER_API_KEY = process.env.SERPER_API_KEY;
  if (!mergedKeys.TAVILY_API_KEY && process.env.TAVILY_API_KEY) mergedKeys.TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  if (!mergedKeys.FIRECRAWL_API_KEY && process.env.FIRECRAWL_API_KEY) mergedKeys.FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
  if (!mergedKeys.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY) mergedKeys.MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
  return fn(url, mergedKeys, log);
}

// Run providers sequentially with budget and circuit breaker
async function runProvidersSequential(
  query: string,
  keys: ProviderKeys,
  providerNames: string[],
  maxChars: number,
  budget: ResolutionBudget,
  log: Logger
): Promise<{ content: string; provider: string }> {
  for (const name of providerNames) {
    const paid = isPaidProvider(name);
    if (!budget.canTry(paid)) break;
    if (circuitBreakers.isOpen(name)) continue;

    const start = Date.now();
    try {
      const result = await runQueryProvider(name, query, keys, log, maxChars);
      const latency = Date.now() - start;
      budget.recordAttempt(paid, latency);
      if (result) {
        circuitBreakers.recordSuccess(name);
        return { content: result, provider: name };
      }
      circuitBreakers.recordFailure(name);
    } catch {
      budget.recordAttempt(paid, Date.now() - start);
      circuitBreakers.recordFailure(name);
    }
  }
  throw new Error("No search results found for query. Try adding API keys for better results.");
}

// Run multiple providers in parallel with budget and circuit breaker
async function runProvidersParallel(
  query: string,
  keys: ProviderKeys,
  providerNames: string[],
  maxChars: number,
  budget: ResolutionBudget,
  log: Logger
): Promise<{ content: string; provider: string }> {
  const eligible = providerNames.filter((name) => {
    if (!budget.canTry(isPaidProvider(name))) return false;
    if (circuitBreakers.isOpen(name)) return false;
    return true;
  });

  const results = await Promise.all(
    eligible.map(async (name) => {
      const start = Date.now();
      try {
        const result = await runQueryProvider(name, query, keys, log, maxChars);
        budget.recordAttempt(isPaidProvider(name), Date.now() - start);
        if (result) {
          circuitBreakers.recordSuccess(name);
          return { content: result, provider: name };
        }
        circuitBreakers.recordFailure(name);
        return null;
      } catch {
        budget.recordAttempt(isPaidProvider(name), Date.now() - start);
        circuitBreakers.recordFailure(name);
        return null;
      }
    })
  );

  const successful = results.filter((r): r is { content: string; provider: string } => r !== null);
  if (successful.length === 0) {
    throw new Error("No search results found for query. Try adding API keys for better results.");
  }
  const combined = successful
    .map((r) => `## Results from ${r.provider}\n\n${r.content}`)
    .join("\n\n---\n\n");
  return { content: combined, provider: successful.map((r) => r.provider).join("+") };
}

async function resolveUrl(
  url: string,
  keys: ProviderKeys,
  maxChars: number,
  budget: ResolutionBudget,
  log: Logger
): Promise<string> {
  const order = planProviderOrder({ isUrl: true, jsHeavy: detectJsHeavy(url) });

  for (const name of order) {
    const paid = isPaidProvider(name);
    if (!budget.canTry(paid)) break;
    if (circuitBreakers.isOpen(name)) continue;

    const start = Date.now();
    try {
      const result = await runUrlProvider(name, url, keys, log, maxChars);
      budget.recordAttempt(paid, Date.now() - start);
      if (result) {
        circuitBreakers.recordSuccess(name);
        return result;
      }
      circuitBreakers.recordFailure(name);
    } catch {
      budget.recordAttempt(paid, Date.now() - start);
      circuitBreakers.recordFailure(name);
    }
  }

  throw new Error("Failed to extract content from URL");
}

async function resolveQuery(
  query: string,
  keys: ProviderKeys,
  maxChars: number,
  budget: ResolutionBudget,
  log: Logger
): Promise<string> {
  const order = planProviderOrder({ isUrl: false, keys });
  const result = await runProvidersSequential(query, keys, order, maxChars, budget, log);
  return result.content;
}

function normalizeQueryProviders(providerIds: string[], keys: ProviderKeys): string[] {
  const normalized = providerIds.map((id) => (id === "mistral" ? "mistral_websearch" : id));
  const hasMistral = !!(keys.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY);
  if (hasMistral && normalized.includes("exa_mcp") && normalized.includes("mistral_websearch")) {
    return normalized
      .filter((id) => id !== "mistral_websearch")
      .map((id) => (id === "exa_mcp" ? "exa_mcp_mistral" : id));
  }
  if (!hasMistral) return normalized;
  if (normalized.includes("mistral_websearch")) {
    return normalized.filter((id) => id !== "duckduckgo");
  }
  return normalized;
}

export async function POST(request: NextRequest) {
  const log = new Logger();
  try {
    const body = await request.json();
    const validation = validateResolveRequest(body);
    if (!validation.success || !validation.data) {
      return NextResponse.json({ error: validation.error || "Invalid request" }, { status: 400 });
    }

    const data = validation.data;
    const rawInput = (data.query || data.url || "").trim();
    if (!rawInput) {
      return NextResponse.json({ error: "No query or URL provided" }, { status: 400 });
    }

    const maxChars = data.maxChars || DEFAULT_MAX_CHARS;
    const profile = data.profile || "balanced";
    const skipCache = data.skipCache || false;
    const deepResearch = data.deepResearch || false;
    const providers = data.providers || [];

    const urlMode = isUrl(rawInput);
    const source = urlMode ? "url" : "query";

    // Check cache first
    if (!skipCache) {
      const cached = await cache.get(rawInput, source);
      if (cached) {
        return NextResponse.json({ ...(cached as object), cache_hit: true });
      }
    }

    const budget = new ResolutionBudget(profile);

    // Extract optional user-provided API keys from request body
    const userKeys: ProviderKeys = {
      SERPER_API_KEY: body.serper_api_key,
      TAVILY_API_KEY: body.tavily_api_key,
      EXA_API_KEY: body.exa_api_key,
      FIRECRAWL_API_KEY: body.firecrawl_api_key,
      MISTRAL_API_KEY: body.mistral_api_key,
    };

    let markdown: string;
    let provider: string;

    if (urlMode) {
      markdown = await resolveUrl(rawInput, userKeys, maxChars, budget, log);
      provider = "cascade";
    } else {
      const normalizedProviders = normalizeQueryProviders(providers, userKeys);

      if (normalizedProviders.length === 0) {
        markdown = await resolveQuery(rawInput, userKeys, maxChars, budget, log);
        provider = "cascade";
      } else if (deepResearch) {
        const res = await runProvidersParallel(rawInput, userKeys, normalizedProviders, maxChars, budget, log);
        markdown = res.content;
        provider = res.provider;
      } else {
        const res = await runProvidersSequential(rawInput, userKeys, normalizedProviders, maxChars, budget, log);
        markdown = res.content;
        provider = res.provider;
      }
    }

    const quality: QualityScore = scoreContent(markdown);
    const budgetState = budget.getState();

    const response = {
      markdown,
      provider,
      quality,
      budget: budgetState,
      cache_hit: false,
    };

    // Store successful result in cache
    await cache.set(rawInput, source, { markdown, provider, quality, budget: budgetState });

    // Auto-save as a record
    saveRecord({
      query: rawInput,
      url: urlMode ? rawInput : null,
      content: markdown,
      source: provider,
      score: quality.score,
    });

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    log.error("resolve failed", undefined, { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
