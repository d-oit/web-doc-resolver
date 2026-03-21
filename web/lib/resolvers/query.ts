import { classifyError } from "@/lib/errors";
import { Logger } from "@/lib/log";
import { MAX_CHARS, MIN_CHARS } from "./url";

export { MAX_CHARS, MIN_CHARS } from "./url";

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

export async function searchViaExaMcp(query: string, log: Logger): Promise<string | null> {
  const start = Date.now();
  log.info("attempt", "exa_mcp", { query: query.slice(0, 80) });
  try {
    const mcpRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "web_search_exa", arguments: { query, numResults: 8 } },
    };
    const res = await fetchWithTimeout("https://mcp.exa.ai/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mcpRequest),
    });
    if (!res.ok) {
      const err = classifyError("exa_mcp", new Error(`HTTP ${res.status}`), res.status);
      log.info("failure", "exa_mcp", { status: res.status, latencyMs: Date.now() - start, errorType: err.type });
      return null;
    }
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.result?.content) {
            const content = data.result.content[0]?.text;
            if (content && content.length > MIN_CHARS) {
              log.info("success", "exa_mcp", { latencyMs: Date.now() - start, chars: content.length });
              return content.slice(0, MAX_CHARS);
            }
          }
        } catch { /* ignore */ }
      }
    }
    log.info("failure", "exa_mcp", { latencyMs: Date.now() - start, reason: "no_content" });
    return null;
  } catch {
    log.info("failure", "exa_mcp", { latencyMs: Date.now() - start });
    return null;
  }
}

export async function searchViaExaSdk(query: string, apiKey: string, log: Logger): Promise<string | null> {
  if (!apiKey) return null;
  const start = Date.now();
  log.info("attempt", "exa", { query: query.slice(0, 80) });
  try {
    const res = await fetchWithTimeout("https://api.exa.ai/search", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ query, numResults: 5, useAutoprompt: true, contents: { text: true } }),
    });
    if (!res.ok) {
      const err = classifyError("exa", new Error(`HTTP ${res.status}`), res.status);
      log.info("failure", "exa", { status: res.status, latencyMs: Date.now() - start, errorType: err.type });
      return null;
    }
    const data = await res.json();
    const results = (data.results || [])
      .map((r: { title?: string; url?: string; text?: string }) =>
        `## ${r.title || "Untitled"}\nSource: ${r.url}\n\n${r.text || ""}`)
      .join("\n\n---\n\n");
    if (results.length > MIN_CHARS) {
      log.info("success", "exa", { latencyMs: Date.now() - start, chars: results.length });
      return results.slice(0, MAX_CHARS);
    }
    return null;
  } catch {
    log.info("failure", "exa", { latencyMs: Date.now() - start });
    return null;
  }
}

export async function searchViaSerper(query: string, apiKey: string, log: Logger): Promise<string | null> {
  if (!apiKey) return null;
  const start = Date.now();
  log.info("attempt", "serper", { query: query.slice(0, 80) });
  try {
    const res = await fetchWithTimeout("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (!res.ok) {
      const err = classifyError("serper", new Error(`HTTP ${res.status}`), res.status);
      log.info("failure", "serper", { status: res.status, latencyMs: Date.now() - start, errorType: err.type });
      return null;
    }
    const data = await res.json();
    const snippets = (data.organic || [])
      .map((r: { snippet?: string }) => r.snippet).filter(Boolean).join("\n\n");
    if (snippets.length < MIN_CHARS) {
      log.info("failure", "serper", { latencyMs: Date.now() - start, reason: "thin_content" });
      return null;
    }
    log.info("success", "serper", { latencyMs: Date.now() - start, chars: snippets.length, mode: "snippets" });
    return `Search results for: ${query}\n\n${snippets.slice(0, MAX_CHARS)}`;
  } catch {
    log.info("failure", "serper", { latencyMs: Date.now() - start });
    return null;
  }
}

export async function searchViaTavily(query: string, apiKey: string, log: Logger): Promise<string | null> {
  if (!apiKey) return null;
  const start = Date.now();
  log.info("attempt", "tavily", { query: query.slice(0, 80) });
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, max_results: 5, include_raw_content: true }),
    });
    if (!res.ok) {
      const err = classifyError("tavily", new Error(`HTTP ${res.status}`), res.status);
      log.info("failure", "tavily", { status: res.status, latencyMs: Date.now() - start, errorType: err.type });
      return null;
    }
    const data = await res.json();
    const results = (data.results || [])
      .map((r: { title?: string; url?: string; raw_content?: string; content?: string }) =>
        `## ${r.title}\nSource: ${r.url}\n\n${r.raw_content || r.content || ""}`)
      .join("\n\n---\n\n");
    if (results.length > MIN_CHARS) {
      log.info("success", "tavily", { latencyMs: Date.now() - start, chars: results.length });
      return results.slice(0, MAX_CHARS);
    }
    log.info("failure", "tavily", { latencyMs: Date.now() - start, reason: "thin_content" });
    return null;
  } catch {
    log.info("failure", "tavily", { latencyMs: Date.now() - start });
    return null;
  }
}

export async function searchViaDuckDuckGoLite(query: string, log: Logger): Promise<string | null> {
  const start = Date.now();
  log.info("attempt", "duckduckgo", { query: query.slice(0, 80) });
  try {
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(`https://r.jina.ai/${searchUrl}`, {
      headers: { Accept: "text/plain", "X-Return-Format": "text" },
    });
    if (!res.ok) {
      log.info("failure", "duckduckgo", { status: res.status, latencyMs: Date.now() - start });
      return null;
    }
    const text = await res.text();
    const lines = text.split("\n").filter((line) => {
      const t = line.trim();
      return t.length >= 20 && !t.includes("DuckDuckGo") && !t.includes("web images news") && !/^[\d\.\s]+$/.test(t);
    });
    const cleaned = lines.join("\n\n").trim();
    if (cleaned.length > MIN_CHARS) {
      log.info("success", "duckduckgo", { latencyMs: Date.now() - start, chars: cleaned.length });
      return cleaned.slice(0, MAX_CHARS);
    }
    return null;
  } catch {
    log.info("failure", "duckduckgo", { latencyMs: Date.now() - start });
    return null;
  }
}

export async function searchViaDuckDuckGoFree(query: string, log: Logger): Promise<string | null> {
  const start = Date.now();
  log.info("attempt", "duckduckgo", { variant: "html", query: query.slice(0, 80) });
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(`https://r.jina.ai/${searchUrl}`, {
      headers: { Accept: "text/plain", "X-Return-Format": "text" },
    });
    if (!res.ok) {
      log.info("failure", "duckduckgo", { variant: "html", status: res.status, latencyMs: Date.now() - start });
      return null;
    }
    const text = await res.text();
    const lines = text.split("\n").filter((line) => {
      const t = line.trim();
      return t.length >= 20 && !t.includes("Your browser is out of date") && !t.includes("DuckDuckGo") && !/^[\s\-\*\|]+$/.test(t);
    });
    const cleaned = lines.join("\n\n").trim();
    if (cleaned.length > MIN_CHARS) {
      log.info("success", "duckduckgo", { variant: "html", latencyMs: Date.now() - start, chars: cleaned.length });
      return cleaned.slice(0, MAX_CHARS);
    }
    return null;
  } catch {
    log.info("failure", "duckduckgo", { variant: "html", latencyMs: Date.now() - start });
    return null;
  }
}

export async function searchViaMistralWeb(query: string, apiKey: string, log: Logger): Promise<string | null> {
  if (!apiKey) return null;
  const start = Date.now();
  log.info("attempt", "mistral_websearch", { query: query.slice(0, 80) });
  try {
    const res = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: `Research this topic and provide comprehensive, well-sourced information as markdown: ${query}` }],
        max_tokens: 4000,
      }),
    }, 25000);
    if (!res.ok) {
      const err = classifyError("mistral_websearch", new Error(`HTTP ${res.status}`), res.status);
      log.info("failure", "mistral_websearch", { status: res.status, latencyMs: Date.now() - start, errorType: err.type });
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content && content.length > MIN_CHARS) {
      log.info("success", "mistral_websearch", { latencyMs: Date.now() - start, chars: content.length });
      return content.slice(0, MAX_CHARS);
    }
    return null;
  } catch {
    log.info("failure", "mistral_websearch", { latencyMs: Date.now() - start });
    return null;
  }
}
