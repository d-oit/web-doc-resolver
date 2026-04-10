export interface ProviderResult {
  id: string;
  title: string;
  url?: string;
  normalizedUrl?: string;
  author?: string;
  published?: string;
  snippet: string;
  raw: string;
}

const SPLIT_REGEX = /\n-{3,}\n+/g;

function extractFirstUrlCandidate(input: string): string | undefined {
  const fromParen = input.match(/https?:\/\/[^)\s]+/);
  if (fromParen) return fromParen[0];
  const fromSpace = input.split(/\s+/).find((token) => token.startsWith("http"));
  if (fromSpace) return fromSpace;
  if (input.includes("(")) {
    const inner = input.substring(input.indexOf("(") + 1, input.lastIndexOf(")"));
    if (inner.startsWith("http")) return inner;
  }
  return input.trim().startsWith("http") ? input.trim() : undefined;
}

function canonicalizeUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const candidate = extractFirstUrlCandidate(raw)?.trim();
  if (!candidate) return undefined;
  const normalizedCandidate = candidate.replace(/https?:\/([^/])/g, (match) => match.replace(/:\//, "://"));
  try {
    const url = new URL(normalizedCandidate);
    if (url.hostname === "nextjs.org" && url.pathname.startsWith("/docs/llm-digest/")) {
      url.pathname = url.pathname.replace("/docs/llm-digest", "/docs");
    }
    url.hash = "";
    return url.toString();
  } catch {
    return normalizedCandidate;
  }
}

function normalizeSnippet(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseBlock(block: string, index: number): ProviderResult | null {
  const lines = block.trim().split(/\n+/);
  if (lines.length === 0) return null;

  let title: string | undefined;
  let url: string | undefined;
  let author: string | undefined;
  let published: string | undefined;
  const snippetLines: string[] = [];
  let inHighlights = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("title:")) {
      title = line.split(/title:/i)[1]?.trim();
      continue;
    }
    if (lower.startsWith("url:")) {
      url = line.split(/url:/i)[1]?.trim();
      continue;
    }
    if (lower.startsWith("author:")) {
      author = line.split(/author:/i)[1]?.trim();
      continue;
    }
    if (lower.startsWith("published:")) {
      published = line.split(/published:/i)[1]?.trim();
      continue;
    }
    if (lower.startsWith("highlights:")) {
      inHighlights = true;
      const content = line.split(/highlights:/i)[1]?.trim();
      if (content) snippetLines.push(content);
      continue;
    }
    if (inHighlights) {
      snippetLines.push(line);
      continue;
    }
  }

  const snippet = normalizeSnippet(inHighlights ? snippetLines : lines.slice(1));
  if (!title && !snippet) return null;

  const normalizedUrl = canonicalizeUrl(url);
  const result: ProviderResult = {
    id: `${index}-${title || url || Math.random().toString(36).slice(2)}`,
    title: title || "Untitled Result",
    snippet: snippet || block.trim(),
    raw: block.trim(),
  };
  if (url !== undefined) result.url = url;
  if (normalizedUrl !== undefined) result.normalizedUrl = normalizedUrl;
  if (author !== undefined) result.author = author;
  if (published !== undefined) result.published = published;
  return result;
}

export function parseProviderResults(markdown: string): ProviderResult[] {
  if (!markdown) return [];
  const blocks = markdown.split(SPLIT_REGEX).map((block) => block.trim()).filter(Boolean);
  const parsed: ProviderResult[] = [];
  blocks.forEach((block, index) => {
    const result = parseBlock(block, index);
    if (result) parsed.push(result);
  });
  return dedupeResults(parsed);
}

export function dedupeResults(results: ProviderResult[]): ProviderResult[] {
  const seen = new Map<string, ProviderResult>();
  for (const result of results) {
    const key = (result.normalizedUrl || result.title || result.raw).toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, result);
    }
  }
  return Array.from(seen.values());
}

export function extractNormalizedUrls(results: ProviderResult[]): string[] {
  return Array.from(new Set(results.map((r) => r.normalizedUrl).filter(Boolean))) as string[];
}
