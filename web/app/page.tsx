"use client";

import { useState, useEffect, useRef } from "react";
import { loadApiKeys, ApiKeys, resolveKeySource, KeySource } from "@/lib/keys";

const PROVIDERS = [
  { id: "jina", label: "Jina", free: true },
  { id: "exa_mcp", label: "Exa MCP", free: true },
  { id: "duckduckgo", label: "DuckDuckGo", free: true },
  { id: "serper", label: "Serper", free: false },
  { id: "tavily", label: "Tavily", free: false },
  { id: "firecrawl", label: "Firecrawl", free: false },
];

const DEMO_URL = "https://github.com/d-oit/web-doc-resolver";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [keySource, setKeySource] = useState<Record<string, KeySource>>({});
  const [copied, setCopied] = useState(false);
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [resolveTime, setResolveTime] = useState<number | null>(null);
  const [sourceProvider, setSourceProvider] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const keys = loadApiKeys();
    setApiKeys(keys);
    fetch("/api/key-status")
      .then((r) => r.json())
      .then((status) => setKeySource(resolveKeySource(keys, status)))
      .catch(() => {});
    setLoaded(true);
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError("");
    setProviderStatus("Fetching...");
    const startTime = Date.now();

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          ...apiKeys,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const provider = data.provider || "Unknown";
        setError(`${provider}: ${data.error || res.status}`);
        setProviderStatus(null);
        return;
      }

      setResult(data.markdown || data.result || "");
      setSourceProvider(data.provider || "Unknown");
      setResolveTime(Date.now() - startTime);
      setProviderStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setProviderStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = result;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    }
  };

  const handleKeyChange = (key: keyof ApiKeys, value: string) => {
    const updated = { ...apiKeys, [key]: value || undefined };
    setApiKeys(updated);
    try {
      localStorage.setItem("web-resolver-api-keys", JSON.stringify(updated));
    } catch {}
  };

  const charCount = result.length;
  const isUrl = query.trim().startsWith("http");

  if (!loaded) return null;

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-[#e8e6e3] font-mono flex">
      {/* Left Sidebar - Configuration */}
      <aside className="w-[280px] min-w-[280px] border-r-2 border-[#333] p-4 flex flex-col gap-6">
        <div className="text-[11px] uppercase tracking-[0.1em] text-[#666]">
          Configuration
        </div>

        {/* API Keys */}
        <div className="flex flex-col gap-3">
          <div className="text-[11px] uppercase tracking-[0.1em] text-[#666]">
            API Keys
          </div>
          <p className="text-[11px] text-[#888] leading-relaxed">
            Stored locally. Requests execute client-side.
          </p>
          {PROVIDERS.filter((p) => !p.free).map((provider) => {
            const key = `${provider.id}_api_key` as keyof ApiKeys;
            const value = apiKeys[key] || "";
            return (
              <div key={provider.id} className="flex flex-col gap-1">
                <label className="text-[11px] text-[#888]">{provider.label}</label>
                <input
                  type="password"
                  value={value}
                  onChange={(e) => handleKeyChange(key, e.target.value)}
                  placeholder={`sk-...`}
                  className="bg-[#141414] border-2 border-[#333] px-2 py-1.5 text-[13px] text-[#e8e6e3] placeholder:text-[#444] focus:border-[#00ff41] focus:outline-none"
                />
              </div>
            );
          })}
        </div>

        {/* Provider Chain */}
        <div className="flex flex-col gap-3">
          <div className="text-[11px] uppercase tracking-[0.1em] text-[#666]">
            Provider Chain
          </div>
          <div className="flex flex-col gap-1">
            {PROVIDERS.map((provider) => {
              const source = keySource[provider.id];
              const available = provider.free || source === "local" || source === "server";
              return (
                <div
                  key={provider.id}
                  className={`flex items-center gap-2 text-[12px] ${
                    available ? "text-[#888]" : "text-[#444]"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      available ? "bg-[#00ff41]" : "bg-[#333]"
                    }`}
                  />
                  {provider.label}
                  {provider.free && (
                    <span className="text-[10px] text-[#555] ml-auto">free</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Center - Input/Output */}
      <div className="flex-1 flex flex-col">
        {/* Input */}
        <div className="border-b-2 border-[#333] p-4">
          <div className="flex items-center gap-4">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="URL or search query..."
              className="flex-1 bg-transparent text-[24px] text-[#e8e6e3] placeholder:text-[#444] focus:outline-none tracking-tight"
            />
            {query.trim() && (
              <button
                onClick={() => handleSubmit()}
                disabled={loading}
                className="bg-[#00ff41] text-[#0c0c0c] px-4 py-2 text-[13px] font-bold hover:bg-[#00cc33] disabled:opacity-50"
              >
                {loading ? "Fetching..." : "Fetch"}
              </button>
            )}
          </div>
          {query.trim() && (
            <div className="text-[11px] text-[#555] mt-2 uppercase tracking-wider">
              {isUrl ? "Resolving as URL" : "Searching"}
            </div>
          )}
          {providerStatus && (
            <div className="text-[11px] text-[#00ff41] mt-2 animate-pulse">
              {providerStatus}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 border-b-2 border-[#333] text-[#ff4444] text-[13px]">
            {error}
          </div>
        )}

        {/* Output */}
        <div className="flex-1 flex flex-col">
          {result ? (
            <>
              {/* Metadata bar */}
              <div className="flex items-center justify-between px-4 py-2 border-b-2 border-[#333] text-[11px] text-[#666]">
                <div className="flex items-center gap-4">
                  <span>
                    Source: <span className="text-[#00ff41]">{sourceProvider}</span>
                  </span>
                  {resolveTime && <span>{resolveTime}ms</span>}
                  <span>{charCount.toLocaleString()} chars</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="hover:text-[#e8e6e3] transition-colors"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {/* Output textarea */}
              <textarea
                readOnly
                value={result}
                className="flex-1 bg-[#141414] p-4 text-[13px] text-[#e8e6e3] font-mono resize-none focus:outline-none whitespace-pre-wrap overflow-auto"
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#444] text-[13px]">
              Paste a URL or enter a search query
            </div>
          )}
        </div>
      </div>
    </main>
  );
}