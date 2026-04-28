import { Logger } from "@/lib/log";
import { validateUrlForFetchAsync } from "@/lib/validation";

export const MAX_CHARS = parseInt(process.env.WEB_RESOLVER_MAX_CHARS || "8000");
export const MIN_CHARS = parseInt(process.env.WEB_RESOLVER_MIN_CHARS || "50");

async function safeFetch(
  url: string,
  options: RequestInit,
  timeoutMs = 15000,
  maxRedirects = 5
): Promise<Response> {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const validation = await validateUrlForFetchAsync(currentUrl);
    if (!validation.valid) {
      throw new Error(`SSRF blocked: ${validation.error || "Invalid URL"}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        ...options,
        signal: controller.signal,
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        if (!location) {
          return response;
        }

        currentUrl = new URL(location, currentUrl).toString();
        redirectCount++;
        continue;
      }

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Too many redirects");
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

export async function extractViaLlmsTxt(url: string, log: Logger): Promise<string | null> {
  const start = Date.now();
  log.info("probing llms.txt", "llms_txt", { url });
  try {
    const parsed = new URL(url);
    const llmsUrl = `${parsed.origin}/llms.txt`;
    const res = await safeFetch(llmsUrl, {
      headers: { Accept: "text/plain" },
    }, 8000);
    if (!res.ok) {
      log.info("no llms.txt found", "llms_txt", { status: res.status, latencyMs: Date.now() - start });
      return null;
    }
    const text = await res.text();
    if (text.length > MIN_CHARS) {
      log.info("success", "llms_txt", { latencyMs: Date.now() - start, chars: text.length });
      return text.slice(0, MAX_CHARS);
    }
    log.info("llms.txt too short", "llms_txt", { chars: text.length });
    return null;
  } catch {
    log.info("failure", "llms_txt", { latencyMs: Date.now() - start });
    return null;
  }
}

export async function extractViaJina(url: string, log: Logger): Promise<string | null> {
  const start = Date.now();
  log.info("attempt", "jina", { url });
  try {
    const validation = await validateUrlForFetchAsync(url);
    if (!validation.valid) {
      throw new Error(`SSRF blocked: ${validation.error || "Invalid URL"}`);
    }

    const res = await safeFetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain", "X-Return-Format": "text" },
    });
    if (!res.ok) {
      log.info("failure", "jina", { status: res.status, latencyMs: Date.now() - start });
      return null;
    }
    const text = await res.text();
    if (text.length > MIN_CHARS) {
      log.info("success", "jina", { latencyMs: Date.now() - start, chars: text.length });
      return text.slice(0, MAX_CHARS);
    }
    return null;
  } catch {
    log.info("failure", "jina", { latencyMs: Date.now() - start });
    return null;
  }
}

/**
 * Simple HTML entity decoder
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&") // Ampersand last to avoid double-unescaping
    .replace(/\u2060/g, ""); // Remove word joiner
}

/**
 * Enhanced HTML to text conversion for direct_fetch
 */
function extractTextFromHtml(html: string): string {
  let result = "";
  let inTag = false;
  let currentTag = "";
  let skipContentDepth = 0;

  const blockTags = new Set([
    "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "tr", "pre", "br", "article", "section",
    "header", "footer", "nav", "aside"
  ]);

  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (ch === "<") {
      inTag = true;
      currentTag = "";
    } else if (ch === ">") {
      inTag = false;
      const tagLower = currentTag.toLowerCase();
      const isClosing = tagLower.startsWith("/");
      const tagName = tagLower.replace(/^\//, "").split(/\s/)[0] || "";

      if (tagName === "script" || tagName === "style") {
        if (isClosing) {
          skipContentDepth = Math.max(0, skipContentDepth - 1);
        } else {
          skipContentDepth++;
        }
      } else if (skipContentDepth === 0) {
        if (!isClosing) {
          // Opening tags
          if (blockTags.has(tagName)) {
            if (result && result[result.length - 1] !== "\n") {
              result += "\n";
            }
          }
          if (tagName === "code") {
            result += "`";
          } else if (tagName === "pre") {
            result += "\n```\n";
          }
        } else {
          // Closing tags
          if (tagName === "code") {
            result += "`";
          } else if (tagName === "pre") {
            result += "\n```\n";
          } else if (blockTags.has(tagName)) {
            if (result && result[result.length - 1] !== "\n") {
              result += "\n";
            }
          }
        }
      }
    } else if (inTag) {
      currentTag += ch;
    } else if (skipContentDepth === 0) {
      result += ch;
    }
  }

  const cleaned = result
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return decodeEntities(cleaned);
}

export async function extractViaDirectFetch(url: string, log: Logger): Promise<string | null> {
  const start = Date.now();
  log.info("attempt", "direct_fetch", { url });
  try {
    const res = await safeFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WebDocResolver/2.0)",
        Accept: "text/html",
      },
    });
    if (!res.ok) {
      log.info("failure", "direct_fetch", { status: res.status, latencyMs: Date.now() - start });
      return null;
    }
    const html = await res.text();
    const text = extractTextFromHtml(html);

    if (text.length > MIN_CHARS) {
      log.info("success", "direct_fetch", { latencyMs: Date.now() - start, chars: text.length });
      return text.slice(0, MAX_CHARS);
    }
    return null;
  } catch {
    log.info("failure", "direct_fetch", { latencyMs: Date.now() - start });
    return null;
  }
}

export async function extractViaFirecrawl(url: string, apiKey: string, log: Logger): Promise<string | null> {
  if (!apiKey) return null;
  const start = Date.now();
  log.info("attempt", "firecrawl", { url });
  try {
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"] }),
      },
      30000
    );
    if (!res.ok) {
      log.info("failure", "firecrawl", { status: res.status, latencyMs: Date.now() - start });
      return null;
    }
    const data = await res.json();
    const markdown = data?.data?.markdown;
    if (markdown && markdown.length > MIN_CHARS) {
      log.info("success", "firecrawl", { latencyMs: Date.now() - start, chars: markdown.length });
      return markdown.slice(0, MAX_CHARS);
    }
    return null;
  } catch {
    log.info("failure", "firecrawl", { latencyMs: Date.now() - start });
    return null;
  }
}

export async function extractViaMistralBrowser(url: string, apiKey: string, log: Logger): Promise<string | null> {
  if (!apiKey) return null;
  const start = Date.now();
  log.info("attempt", "mistral_browser", { url });
  try {
    const res = await fetchWithTimeout(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
    if (!res.ok) {
      log.info("failure", "mistral_browser", { status: res.status, latencyMs: Date.now() - start });
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content && content.length > MIN_CHARS) {
      log.info("success", "mistral_browser", { latencyMs: Date.now() - start, chars: content.length });
      return content.slice(0, MAX_CHARS);
    }
    return null;
  } catch {
    log.info("failure", "mistral_browser", { latencyMs: Date.now() - start });
    return null;
  }
}
