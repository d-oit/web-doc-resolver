"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { loadApiKeys, ApiKeys, resolveKeySource, KeySource } from "@/lib/keys";
import ReactMarkdown from "react-markdown";

const ALL_PROVIDERS = [
  { id: "exa_mcp", label: "Exa MCP", free: true },
  { id: "duckduckgo", label: "DuckDuckGo", free: true },
  { id: "serper", label: "Serper", free: false },
  { id: "tavily", label: "Tavily", free: false },
  { id: "firecrawl", label: "Firecrawl", free: false },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [copied, setCopied] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [deepResearch, setDeepResearch] = useState(false);
  const [keySource, setKeySource] = useState<Record<string, KeySource>>({});
  const [previewMode, setPreviewMode] = useState(false);
  const [history, setHistory] = useState<Array<{ query: string; markdown: string; timestamp: number; providers: string[] }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const keys = loadApiKeys();
    setApiKeys(keys);
    fetch("/api/key-status")
      .then((r) => r.json())
      .then((status) => setKeySource(resolveKeySource(keys, status)));
    try {
      const stored = sessionStorage.getItem("wdr-history");
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          ...apiKeys,
          providers: selectedProviders,
          deepResearch,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Resolver returned ${res.status}`);
      }

      setResult(data.markdown || data.result || JSON.stringify(data, null, 2));

      const newEntry = { query: query.trim(), markdown: data.markdown || data.result || "", timestamp: Date.now(), providers: selectedProviders };
      const newHistory = [...history, newEntry].slice(-10);
      setHistory(newHistory);
      try { sessionStorage.setItem("wdr-history", JSON.stringify(newHistory)); } catch {}
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resolve query"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProviderToggle = (provider: string) => {
    setSelectedProviders(prev =>
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = result;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const clearResult = () => {
    setResult("");
    setError("");
  };

  const handleRestoreHistory = (entry: typeof history[0]) => {
    setQuery(entry.query);
    setResult(entry.markdown);
    setError("");
    setShowHistory(false);
  };

  const charCount = result.length;
  const wordCount = result.trim() ? result.trim().split(/\s+/).length : 0;

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 lg:p-16">
      <nav className="w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl flex items-center justify-between mb-6 sm:mb-8">
        <Link href="/" className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors" title="Home">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
            <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15.75a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
          </svg>
        </Link>
        <div className="flex gap-2 sm:gap-4 items-center">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            title="Provider Selection"
          >
            Providers
          </button>
          <Link
            href="/settings"
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Settings
          </Link>
          <Link
            href="/help"
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Help
          </Link>
        </div>
      </nav>

      <div className="w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight">
            d.o. Web Doc Resolver
          </h1>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg text-neutral-600 dark:text-neutral-400">
            Resolve queries and URLs into compact, LLM-ready markdown
          </p>
        </div>

        {showSettings && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {ALL_PROVIDERS.map(({ id, label, free }) => {
                const source = keySource[id];
                const available = free || source === "local" || source === "server";
                const active = selectedProviders.includes(id);
                return (
                  <button
                    key={id}
                    disabled={!available}
                    onClick={() => available && handleProviderToggle(id)}
                    title={!available ? "Add key in Settings" : source === "server" ? "Using server key" : undefined}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active ? "bg-blue-600 text-white border-blue-600"
                      : available ? "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600 dark:hover:bg-neutral-700"
                      : "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-600 dark:border-neutral-700"
                    }`}
                  >
                    {label}
                    {free && <span className="ml-1 opacity-60">- free</span>}
                    {source === "server" && <span className="ml-1 h-2 w-2 rounded-full bg-green-500 inline-block" />}
                    {source === "local" && <span className="ml-1 h-2 w-2 rounded-full bg-blue-500 inline-block" />}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-sm mb-4 dark:text-neutral-300">
              <input type="checkbox" checked={deepResearch} onChange={(e) => setDeepResearch(e.target.checked)} className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800" />
              Deep Research — run selected providers in parallel
            </label>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a URL or query... (⌘K)"
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed sm:min-w-[120px]"
          >
            {loading ? "Resolving..." : "Resolve"}
          </button>
        </form>

        {history.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              {showHistory ? "▾ Hide" : "▸ Recent"} ({history.length})
            </button>
            {showHistory && (
              <div className="mt-2 rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
                {history.slice().reverse().map((entry, idx) => (
                  <button
                    key={entry.timestamp}
                    onClick={() => handleRestoreHistory(entry)}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate block">
                      {entry.query.length > 60 ? entry.query.slice(0, 60) + "…" : entry.query}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800/50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Result</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-500">
                    {charCount.toLocaleString()} chars · {wordCount.toLocaleString()} words
                  </span>
                </div>
                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    title={previewMode ? "Show raw text" : "Preview markdown"}
                  >
                    {previewMode ? "Raw" : "Preview"}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M15.988 3.012A2.25 2.25 0 0118 5.25v6.5A2.25 2.25 0 0115.75 14H13.5v-1.5h2.25a.75.75 0 00.75-.75v-6.5a.75.75 0 00-.75-.75H9.25a.75.75 0 00-.75.75v2.25H7V5.25a2.25 2.25 0 012.25-2.25h6.738zM4.25 8A2.25 2.25 0 002 10.25v6.5A2.25 2.25 0 004.25 19h6.5A2.25 2.25 0 0013 16.75v-6.5A2.25 2.25 0 0010.75 8h-6.5zm-.75 2.25a.75.75 0 01.75-.75h6.5a.75.75 0 01.75.75v6.5a.75.75 0 01-.75.75h-6.5a.75.75 0 01-.75-.75v-6.5z" clipRule="evenodd" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={clearResult}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    title="Clear result"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                    Clear
                  </button>
                </div>
              </div>
              <div className="p-4 max-h-[60vh] overflow-auto">
                {previewMode ? (
                  <div className="prose dark:prose-invert max-w-none p-4 text-sm prose-pre:bg-neutral-100 dark:prose-pre:bg-neutral-800 prose-pre:text-sm prose-code:text-sm">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-neutral-800 dark:text-neutral-200">
                    {result}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 sm:mt-12 text-center text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
          <p className="leading-relaxed">
            Try a URL like{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs sm:text-sm dark:bg-neutral-800">
              https://docs.python.org
            </code>{" "}
            or a query like{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs sm:text-sm dark:bg-neutral-800">
              python async best practices
            </code>
          </p>
        </div>
      </div>
    </main>
  );
}
