import { NextRequest, NextResponse } from "next/server";
import {
  ResolutionBudget,
  planProviderOrder,
  detectJsHeavy,
  isPaidProvider,
} from "@/lib/routing";
import { CircuitBreakerRegistry } from "@/lib/circuit-breaker";
import { scoreContent, QualityScore } from "@/lib/quality";
import * as cache from "@/lib/cache";
import { save as saveRecord } from "@/lib/records";

// Allow up to 60 seconds for resolver operations
export const maxDuration = 60;

const DEFAULT_MAX_CHARS = parseInt(process.env.WEB_RESOLVER_MAX_CHARS || "8000");

// Singleton circuit breaker registry (survives across warm invocations)
const circuitBreakers = new CircuitBreakerRegistry();

// Provider keys - can come from env vars or request body
interface ProviderKeys {
  SERPER_API_KEY?: string;
  TAVILY_API_KEY?: string;
  EXA_API_KEY?: string;
  FIRECRAWL_API_KEY?: string;
  MISTRAL_API_KEY?: string;
}

function isUrl(input: string): boolean {
  return /^https?:\/\/\S+$/i.test(input.trim());
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function extractViaJina(url: string, maxChars: number): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "text",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 50 ? text.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

async function extractViaDirectFetch(url: string, maxChars: number): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WebDocResolver/2.0; +https://web-eight-ivory-29.vercel.app)",
        Accept: "text/html",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Basic HTML to text extraction
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 50 ? text.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

/**
 * Extract content via Firecrawl API (requires API key)
 * Deep extraction with JavaScript rendering
 */
async function extractViaFirecrawl(url: string, apiKey: string, maxChars: number): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
        }),
      },
      30000 // Longer timeout for JS rendering
    );
    if (!res.ok) return null;
    const data = await res.json();
    const markdown = data?.data?.markdown;
    return markdown && markdown.length > 50 ? markdown.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

async function searchViaSerper(query: string, apiKey: string, maxChars: number): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const res = await fetchWithTimeout(
      "https://google.serper.dev/search",
      {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query, num: 5 }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const snippets = (data.organic || [])
      .map((r: { snippet?: string }) => r.snippet)
      .filter(Boolean)
      .join("\n\n");
    if (snippets.length < 100) return null;
    // Try to fetch the first result URL for full content
    const firstUrl = data.organic?.[0]?.link;
    if (firstUrl) {
      const content = await extractViaJina(firstUrl, maxChars) || await extractViaDirectFetch(firstUrl, maxChars);
      if (content && content.length > snippets.length) {
        return `Source: ${firstUrl}\n\n${content.slice(0, maxChars)}`;
      }
    }
    return `Search results for: ${query}\n\n${snippets.slice(0, maxChars)}`;
  } catch {
    return null;
  }
}

async function searchViaTavily(query: string, apiKey: string, maxChars: number): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        include_raw_content: true,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = (data.results || [])
      .map(
        (r: { title?: string; url?: string; raw_content?: string; content?: string }) =>
          `## ${r.title}\nSource: ${r.url}\n\n${r.raw_content || r.content || ""}`
      )
      .join("\n\n---\n\n");
    return results.length > 100
      ? results.slice(0, maxChars)
      : null;
  } catch {
    return null;
  }
}

/**
 * Free search via DuckDuckGo using Jina Reader to parse search results
 * This works without any API key by scraping DDG search results
 */
async function searchViaDuckDuckGoFree(query: string, maxChars: number): Promise<string | null> {
  try {
    // Use DuckDuckGo HTML search and parse via Jina Reader
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(`https://r.jina.ai/${searchUrl}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "text",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();

    // Clean up the search results text
    // Jina returns the page content, we need to extract meaningful parts
    const lines = text.split('\n').filter(line => {
      const trimmed = line.trim();
      // Filter out navigation and noise
      if (trimmed.length < 20) return false;
      if (trimmed.includes('Your browser is out of date')) return false;
      if (trimmed.includes('DuckDuckGo')) return false;
      if (trimmed.match(/^[\s\-\*\|]+$/)) return false;
      return true;
    });

    const cleaned = lines.join('\n\n').trim();
    return cleaned.length > 100 ? cleaned.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

/**
 * Alternative: Use DuckDuckGo Lite search via Jina
 */
async function searchViaDuckDuckGoLite(query: string, maxChars: number): Promise<string | null> {
  try {
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(`https://r.jina.ai/${searchUrl}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "text",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();

    // DDG Lite is cleaner, parse results
    const lines = text.split('\n').filter(line => {
      const trimmed = line.trim();
      if (trimmed.length < 20) return false;
      // Remove noise
      if (trimmed.includes('DuckDuckGo')) return false;
      if (trimmed.includes('web images news')) return false;
      if (trimmed.match(/^[\d\.\s]+$/)) return false;
      return true;
    });

    const cleaned = lines.join('\n\n').trim();
    return cleaned.length > 100 ? cleaned.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

/**
 * Free search via Exa MCP (Model Context Protocol)
 * No API key required, rate limited.
 */
async function searchViaExaMcp(query: string, maxChars: number): Promise<string | null> {
  try {
    const mcpRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "web_search_exa",
        arguments: {
          query,
          numResults: 8,
        },
      },
    };
    const res = await fetchWithTimeout("https://mcp.exa.ai/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mcpRequest),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Response is streamed with "data: " lines
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.result && data.result.content) {
            const content = data.result.content[0]?.text;
            if (content && content.length > 100) {
              return content.slice(0, maxChars);
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * AI-powered web search via Mistral API
 */
async function searchViaMistralWeb(query: string, apiKey: string, maxChars: number): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const res = await fetchWithTimeout(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [{ role: "user", content: `Research this topic and provide comprehensive, well-sourced information as markdown: ${query}` }],
          max_tokens: 4000,
        }),
      },
      25000
    );
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content && content.length > 50 ? content.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

async function searchViaExaMcpWithMistral(query: string, apiKey: string, maxChars: number): Promise<string | null> {
  if (!apiKey) return null;
  const exaContext = await searchViaExaMcp(query, Math.min(maxChars * 2, 16000));
  if (!exaContext) return null;

  try {
    const res = await fetchWithTimeout(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [
            {
              role: "system",
              content:
                "You are a documentation research assistant. Use only the supplied Exa MCP context. Produce concise markdown with accurate bullets and include source links that appear in the context.",
            },
            {
              role: "user",
              content: `User query: ${query}\n\nExa MCP context:\n${exaContext.slice(0, 12000)}`,
            },
          ],
          max_tokens: 4000,
        }),
      },
      25000
    );
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content && content.length > 50 ? content.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

/**
 * AI-powered browser extraction via Mistral API
 */
async function extractViaMistralBrowser(url: string, apiKey: string, maxChars: number): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const res = await fetchWithTimeout(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [{ role: "user", content: `Extract the main content from this URL as clean markdown: ${url}. Return only the content, no commentary.` }],
          max_tokens: 4000,
        }),
      },
      25000
    );
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content && content.length > 50 ? content.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

// Provider mapping for custom selection
type ProviderFn = (query: string, keys: ProviderKeys, maxChars: number) => Promise<string | null>;

const providerMap: Record<string, ProviderFn> = {
  exa_mcp: async (query, keys, maxChars) => searchViaExaMcp(query, maxChars),
  serper: async (query, keys, maxChars) => {
    const key = keys.SERPER_API_KEY || process.env.SERPER_API_KEY;
    return key ? searchViaSerper(query, key, maxChars) : null;
  },
  tavily: async (query, keys, maxChars) => {
    const key = keys.TAVILY_API_KEY || process.env.TAVILY_API_KEY;
    return key ? searchViaTavily(query, key, maxChars) : null;
  },
  duckduckgo: async (query, keys, maxChars) => searchViaDuckDuckGoLite(query, maxChars) || searchViaDuckDuckGoFree(query, maxChars),
  jina: async (query, keys, maxChars) => extractViaJina(query, maxChars),
  mistral_websearch: async (query, keys, maxChars) => {
    const key = keys.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY;
    return key ? searchViaMistralWeb(query, key, maxChars) : null;
  },
  mistral_browser: async (query, keys, maxChars) => {
    const key = keys.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY;
    return key ? extractViaMistralBrowser(query, key, maxChars) : null;
  },
  exa_mcp_mistral: async (query, keys, maxChars) => {
    const key = keys.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY;
    return key ? searchViaExaMcpWithMistral(query, key, maxChars) : null;
  },
};

// Run providers sequentially with budget and circuit breaker
async function runProvidersSequential(
  query: string,
  keys: ProviderKeys,
  providerNames: string[],
  maxChars: number,
  budget: ResolutionBudget
): Promise<{ content: string; provider: string }> {
  for (const name of providerNames) {
    const paid = isPaidProvider(name);
    if (!budget.canTry(paid)) break;
    if (circuitBreakers.isOpen(name)) continue;

    const fn = providerMap[name];
    if (!fn) continue;

    const start = Date.now();
    try {
      const result = await fn(query, keys, maxChars);
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
  budget: ResolutionBudget
): Promise<{ content: string; provider: string }> {
  const eligible = providerNames.filter((name) => {
    if (!budget.canTry(isPaidProvider(name))) return false;
    if (circuitBreakers.isOpen(name)) return false;
    return !!providerMap[name];
  });

  const results = await Promise.all(
    eligible.map(async (name) => {
      const start = Date.now();
      try {
        const result = await providerMap[name]!(query, keys, maxChars);
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

async function resolveUrl(url: string, keys: ProviderKeys, maxChars: number, budget: ResolutionBudget): Promise<string> {
  const order = planProviderOrder({ isUrl: true, jsHeavy: detectJsHeavy(url) });

  for (const name of order) {
    const paid = isPaidProvider(name);
    if (!budget.canTry(paid)) break;
    if (circuitBreakers.isOpen(name)) continue;

    const start = Date.now();
    let result: string | null = null;
    try {
      if (name === "jina") result = await extractViaJina(url, maxChars);
      else if (name === "firecrawl") {
        const fk = keys.FIRECRAWL_API_KEY || process.env.FIRECRAWL_API_KEY;
        if (fk) result = await extractViaFirecrawl(url, fk, maxChars);
      } else if (name === "direct_fetch") result = await extractViaDirectFetch(url, maxChars);
      else if (name === "mistral_browser") {
        const mk = keys.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY;
        if (mk) result = await extractViaMistralBrowser(url, mk, maxChars);
      }
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

async function resolveQuery(query: string, keys: ProviderKeys, maxChars: number, budget: ResolutionBudget): Promise<string> {
  const order = planProviderOrder({ isUrl: false, keys });
  const result = await runProvidersSequential(query, keys, order, maxChars, budget);
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
  try {
    const body = await request.json();
    const input = body.query?.trim() || body.url?.trim();
    const maxChars = parseInt(body.maxChars) || DEFAULT_MAX_CHARS;
    const profile = body.profile || "balanced";

    if (!input) {
      return NextResponse.json(
        { error: "No query or URL provided" },
        { status: 400 }
      );
    }

    const skipCache: boolean = body.skipCache || false;
    const urlMode = isUrl(input);
    const source = urlMode ? "url" : "query";

    // Check cache first
    if (!skipCache) {
      const cached = await cache.get(input, source);
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
      markdown = await resolveUrl(input, userKeys, maxChars, budget);
      provider = "cascade";
    } else {
      const providers: string[] = body.providers || [];
      const deepResearch: boolean = body.deepResearch || false;
      const normalizedProviders = normalizeQueryProviders(providers, userKeys);

      if (normalizedProviders.length === 0) {
        markdown = await resolveQuery(input, userKeys, maxChars, budget);
        provider = "cascade";
      } else if (deepResearch) {
        const res = await runProvidersParallel(input, userKeys, normalizedProviders, maxChars, budget);
        markdown = res.content;
        provider = res.provider;
      } else {
        const res = await runProvidersSequential(input, userKeys, normalizedProviders, maxChars, budget);
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
    await cache.set(input, source, {
      markdown,
      provider,
      quality,
      budget: budgetState,
    });

    // Auto-save as a record
    saveRecord({
      query: input,
      url: urlMode ? input : null,
      content: markdown,
      source: provider,
      score: quality.score,
    });

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
