"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { loadApiKeys, ApiKeys, resolveKeySource, KeySource } from "@/lib/keys";

const PROVIDERS = [
  { id: "exa_mcp", label: "Exa MCP", free: true },
  { id: "jina", label: "Jina", free: true },
  { id: "duckduckgo", label: "DuckDuckGo", free: true },
  { id: "serper", label: "Serper", free: false },
  { id: "tavily", label: "Tavily", free: false },
  { id: "firecrawl", label: "Firecrawl", free: false },
  { id: "mistral", label: "Mistral", free: false },
];

const PROFILES = [
  { id: "free", label: "Free", providers: ["exa_mcp", "jina", "duckduckgo"] },
  { id: "balanced", label: "Balanced", providers: ["exa_mcp", "serper", "jina", "duckduckgo"] },
  { id: "fast", label: "Fast", providers: ["serper", "exa_mcp"] },
  { id: "quality", label: "Quality", providers: ["tavily", "serper", "exa_mcp", "jina", "mistral"] },
];

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  // CLI parity options
  const [profile, setProfile] = useState("free");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [maxChars, setMaxChars] = useState(8000);
  const [skipCache, setSkipCache] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);

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

  const handleProviderToggle = (providerId: string) => {
    setSelectedProviders(prev =>
      prev.includes(providerId)
        ? prev.filter(p => p !== providerId)
        : [...prev, providerId]
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError("");
    setProviderStatus("Fetching...");
    const startTime = Date.now();

    try {
      const providers = selectedProviders.length > 0
        ? selectedProviders
        : PROFILES.find(p => p.id === profile)?.providers || [];

      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          ...apiKeys,
          providers,
          deepResearch,
          maxChars,
          skipCache,
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
      setSourceProvider(data.provider || (providers.length > 0 ? providers.join(", ") : profile));
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
    <main className="min-h-screen bg-[#0c0c0c] text-[#e8e6e3] font-mono flex flex-col lg:flex-row">
      {/* Left Sidebar - Configuration */}
      <aside className="w-full lg:w-[280px] lg:min-w-[280px] border-b-2 lg:border-b-0 lg:border-r-2 border-[#333] p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.1em] text-[#666]">
            Configuration
          </div>
          <Link href="/settings" className="text-[11px] text-[#00ff41] hover:underline">
            Keys
          </Link>
        </div>

        {/* Profile Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] text-[#888]">Profile</label>
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="bg-[#141414] border-2 border-[#333] px-2 py-1.5 text-[13px] text-[#e8e6e3] focus:border-[#00ff41] focus:outline-none"
          >
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Provider Selection */}
        <div className="flex flex-col gap-2">
          <div className="text-[11px] text-[#888]">Providers</div>
          <div className="flex flex-wrap gap-1">
            {PROVIDERS.map((provider) => {
              const source = keySource[provider.id];
              const available = provider.free || source === "local" || source === "server";
              const selected = selectedProviders.includes(provider.id);
              return (
                <button
                  key={provider.id}
                  onClick={() => available && handleProviderToggle(provider.id)}
                  disabled={!available}
                  className={`px-2 py-1 text-[11px] border-2 ${
                    selected
                      ? "bg-[#00ff41] text-[#0c0c0c] border-[#00ff41]"
                      : available
                      ? "bg-transparent text-[#888] border-[#333] hover:border-[#00ff41]"
                      : "bg-transparent text-[#444] border-[#222] cursor-not-allowed"
                  }`}
                >
                  {provider.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-[#555]">
            {selectedProviders.length > 0 ? `${selectedProviders.length} selected` : `Using ${profile} profile`}
          </p>
        </div>

        {/* Advanced Options */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-[#666] hover:text-[#888] text-left"
          >
            {showAdvanced ? "▼" : "▶"} Advanced
          </button>
          {showAdvanced && (
            <div className="flex flex-col gap-3 pl-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-[#888]">Max chars</label>
                <input
                  type="number"
                  value={maxChars}
                  onChange={(e) => setMaxChars(parseInt(e.target.value) || 8000)}
                  className="w-20 bg-[#141414] border-2 border-[#333] px-2 py-1 text-[11px] text-[#e8e6e3] focus:border-[#00ff41] focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-[#888]">
                <input
                  type="checkbox"
                  checked={skipCache}
                  onChange={(e) => setSkipCache(e.target.checked)}
                  className="w-4 h-4 bg-[#141414] border-2 border-[#333]"
                />
                Skip cache
              </label>
              <label className="flex items-center gap-2 text-[11px] text-[#888]">
                <input
                  type="checkbox"
                  checked={deepResearch}
                  onChange={(e) => setDeepResearch(e.target.checked)}
                  className="w-4 h-4 bg-[#141414] border-2 border-[#333]"
                />
                Deep research
              </label>
            </div>
          )}
        </div>

        {/* API Keys (short version) */}
        <div className="flex flex-col gap-2 lg:flex-1">
          <div className="text-[11px] text-[#888]">API Keys</div>
          {PROVIDERS.filter((p) => !p.free).map((provider) => {
            const key = `${provider.id}_api_key` as keyof ApiKeys;
            const value = apiKeys[key] || "";
            const source = keySource[provider.id];
            const hasServer = source === "server";
            return (
              <div key={provider.id} className="flex flex-col gap-1">
                <label className="text-[10px] text-[#666]">{provider.label} {hasServer && !value && "(server)"}</label>
                <input
                  type="password"
                  value={value}
                  onChange={(e) => handleKeyChange(key, e.target.value)}
                  placeholder={hasServer && !value ? "Using server key" : "sk-..."}
                  className="bg-[#141414] border-2 border-[#333] px-2 py-1 text-[12px] text-[#e8e6e3] placeholder:text-[#444] focus:border-[#00ff41] focus:outline-none"
                />
              </div>
            );
          })}
        </div>
      </aside>

      {/* Center - Input/Output */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="border-b-2 border-[#333] p-2 flex items-center justify-between">
          <span className="text-[11px] text-[#666]">do-web-doc-resolver</span>
          <Link href="/help" className="text-[11px] text-[#666] hover:text-[#00ff41]">
            Help
          </Link>
        </div>

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
              className="flex-1 bg-transparent text-[20px] sm:text-[24px] text-[#e8e6e3] placeholder:text-[#444] focus:outline-none tracking-tight"
            />
            {query.trim() && (
              <button
                onClick={() => handleSubmit()}
                disabled={loading}
                className="bg-[#00ff41] text-[#0c0c0c] px-4 py-2 text-[13px] font-bold hover:bg-[#00cc33] disabled:opacity-50 min-w-[60px]"
              >
                {loading ? "..." : "Fetch"}
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
        <div className="flex-1 flex flex-col min-h-0">
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
                className="flex-1 bg-[#141414] p-4 text-[13px] text-[#e8e6e3] font-mono resize-none focus:outline-none whitespace-pre-wrap overflow-auto min-h-[200px]"
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#444] text-[13px] p-4 text-center">
              Paste a URL or enter a search query
            </div>
          )}
        </div>
      </div>
    </main>
  );
}