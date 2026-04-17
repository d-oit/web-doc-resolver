"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { loadApiKeys, saveApiKeys, ApiKeys, resolveKeySource, KeySource } from "@/lib/keys";
import { loadUIState, saveUIState, type UIState } from "@/lib/ui-state";
import History, { HistoryEntry } from "@/app/components/History";
import ProfileCombobox from "@/app/components/ProfileCombobox";
import ToggleChip from "@/app/components/ToggleChip";
import ResultCard from "@/app/components/ResultCard";
import { parseProviderResults, extractNormalizedUrls, type ProviderResult } from "@/lib/results";

type ProfileId = "free" | "balanced" | "fast" | "quality" | "custom";

interface UiProvider {
  id: string;
  label: string;
  free: boolean;
  sourceKey?: string;
}

// Providers in CLI cascade order (see web/lib/routing.ts QUERY_CASCADE)
const PROVIDERS: UiProvider[] = [
  { id: "exa_mcp", label: "Exa MCP", free: true },
  { id: "exa", label: "Exa SDK", free: false, sourceKey: "exa" },
  { id: "tavily", label: "Tavily", free: false },
  { id: "serper", label: "Serper", free: false },
  { id: "mistral", label: "Mistral", free: false, sourceKey: "mistral" },
  { id: "duckduckgo", label: "DuckDuckGo", free: true },
];

// Profiles with providers in cascade order
const PROFILES: Array<{ id: ProfileId; label: string; providers: string[] }> = [
  { id: "free", label: "Free", providers: ["exa_mcp", "duckduckgo"] },
  { id: "fast", label: "Fast", providers: ["exa_mcp", "serper"] },
  { id: "balanced", label: "Balanced", providers: ["exa_mcp", "tavily", "serper", "duckduckgo"] },
  { id: "quality", label: "Quality", providers: ["exa_mcp", "exa", "tavily", "serper", "mistral", "duckduckgo"] },
  { id: "custom", label: "Custom", providers: [] },
];

function toApiProviderId(providerId: string): string {
  if (providerId === "mistral") return "mistral_websearch";
  return providerId;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => (typeof window !== "undefined" ? loadApiKeys() : {}));
  const [serverKeyStatus, setServerKeyStatus] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const [resolveTime, setResolveTime] = useState<number | null>(null);
  const [sourceProvider, setSourceProvider] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // CLI parity options
  const [profile, setProfile] = useState<ProfileId>("free");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [maxChars, setMaxChars] = useState(8000);
  const [skipCache, setSkipCache] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [parsedResults, setParsedResults] = useState<ProviderResult[]>([]);
  const [viewRaw, setViewRaw] = useState(false);
  const [helpfulIds, setHelpfulIds] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);

  const keySource = useMemo(() => resolveKeySource(apiKeys, serverKeyStatus), [apiKeys, serverKeyStatus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Focus input
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Ctrl/Cmd + /: Show shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      // Escape: Clear input or close modals
      if (e.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else if (document.activeElement === inputRef.current) {
          setQuery("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showShortcuts]);

  useEffect(() => {
    fetch("/api/key-status")
      .then((r) => r.json())
      .then((status) => {
        setServerKeyStatus(status);
      })
      .catch(() => {});

    // Load UI state from server with localStorage fallback
    loadUIState()
      .then((ui) => {
        setSidebarOpen(!ui.sidebarCollapsed);
        setApiKeysOpen(ui.showApiKeys);
        setShowAdvanced(ui.showAdvanced);
        const savedProfile = PROFILES.some((p) => p.id === ui.activeProfile) ? (ui.activeProfile as ProfileId) : "free";
        setProfile(savedProfile);
        setSelectedProviders(ui.selectedProviders || []);
        setMaxChars(ui.maxChars || 8000);
        setSkipCache(!!ui.skipCache);
        setDeepResearch(!!ui.deepResearch);
        if (ui.apiKeys && typeof ui.apiKeys === "object") {
          const keys = loadApiKeys();
          const mergedKeys = { ...keys, ...ui.apiKeys } as ApiKeys;
          setApiKeys(mergedKeys);
          saveApiKeys(mergedKeys);
        }
        setLoaded(true);
        inputRef.current?.focus();
      })
      .catch(() => {
        // Fallback: just use defaults
        setLoaded(true);
        inputRef.current?.focus();
      });
  }, []);


  // Persist UI state changes (skip before first load)
  useEffect(() => {
    if (!loaded) return;
    const state: Partial<UIState> = {
      sidebarCollapsed: !sidebarOpen,
      showApiKeys: apiKeysOpen,
      showAdvanced: showAdvanced,
      activeProfile: profile,
      selectedProviders,
      maxChars,
      skipCache,
      deepResearch,
      apiKeys,
    };
    // Save to server with localStorage fallback (fire-and-forget)
    saveUIState(state);
    saveApiKeys(apiKeys);
  }, [loaded, sidebarOpen, apiKeysOpen, showAdvanced, profile, selectedProviders, maxChars, skipCache, deepResearch, apiKeys]);

  const handleProviderToggle = (providerId: string) => {
    setProfile("custom");
    setSelectedProviders((prev) => {
      const profileDefaults = PROFILES.find((p) => p.id === profile)?.providers || [];
      const base = prev.length > 0 ? prev : profileDefaults;
      return base.includes(providerId)
        ? base.filter((p) => p !== providerId)
        : [...base, providerId];
    });
  };

  const charCount = result.length;
  const isUrl = query.trim().startsWith("http");
  const mistralActive = keySource.mistral === "local" || keySource.mistral === "server";

  const isProviderAvailable = useCallback((providerId: string): boolean => {
    if (providerId === "duckduckgo" && mistralActive) return false;
    const provider = PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return false;
    if (provider.free) return true;
    const sourceId = provider.sourceKey || provider.id;
    const source = keySource[sourceId];
    return source === "local" || source === "server";
  }, [keySource, mistralActive]);

  // Providers from current profile (used as visual default when no manual selection)
  const profileProviders = useMemo(() => PROFILES.find(p => p.id === profile)?.providers || [], [profile]);
  const baseProviders = useMemo(() => profile === "custom" ? selectedProviders : selectedProviders.length > 0 ? selectedProviders : profileProviders, [profile, selectedProviders, profileProviders]);
  const activeProviders = useMemo(() => baseProviders.filter((id) => isProviderAvailable(id)), [baseProviders, isProviderAvailable]);
  const requestProviders = useMemo(() => activeProviders.map((id) => toApiProviderId(id)), [activeProviders]);
  const isCustomSelection = selectedProviders.length > 0;

  const saveToHistory = useCallback(async (data: {
    query: string;
    result: string;
    provider: string;
    charCount: number;
    resolveTime: number;
    url: string | null;
    profile: ProfileId;
    flags: { skipCache: boolean; deepResearch: boolean };
    providers: string[];
    normalizedUrlHashes: string[];
  }) => {
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      // Silent fail
    }
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError("");
    setProviderStatus("Fetching...");
    const startTime = performance.now();

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          ...apiKeys,
          providers: requestProviders,
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

      const markdown = data.markdown || data.result || "";
      const parsed = parseProviderResults(markdown);
      const normalizedUrlHashes = extractNormalizedUrls(parsed);

      setResult(markdown);
      setParsedResults(parsed);
      setViewRaw(false);
      setSourceProvider(data.provider || (activeProviders.length > 0 ? activeProviders.join(", ") : profile));
      setQualityScore(data.quality?.score ?? null);
      const elapsed = Math.round(performance.now() - startTime);
      setResolveTime(elapsed);
      setProviderStatus(null);

      // Save to history
      saveToHistory({
        query: query.trim(),
        result: markdown,
        provider: data.provider || activeProviders.join(", "),
        charCount: markdown.length,
        resolveTime: elapsed,
        url: isUrl ? query.trim() : null,
        profile,
        flags: { skipCache, deepResearch },
        providers: activeProviders,
        normalizedUrlHashes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setProviderStatus(null);
    } finally {
      setLoading(false);
    }
  }, [query, loading, apiKeys, requestProviders, deepResearch, maxChars, skipCache, isUrl, profile, activeProviders, saveToHistory]);

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const handleCopyResult = async () => {
    if (!result) return;
    await copyText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  const handleCardCopy = async (value: string) => {
    await copyText(value);
  };

  const toggleHelpful = (id: string) => {
    setHelpfulIds((prev) => {
      const next = new Set<string>(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleHistoryLoad = (entry: HistoryEntry) => {
    setQuery(entry.query);
    setResult(entry.result);
    setParsedResults(parseProviderResults(entry.result));
    setSourceProvider(entry.provider);
    setResolveTime(entry.resolveTime);
    setViewRaw(false);
    setHelpfulIds(new Set());
    inputRef.current?.focus();
  };

  const handleKeyChange = (key: keyof ApiKeys, value: string) => {
    const updated = { ...apiKeys, [key]: value || undefined };
    setApiKeys(updated);
    saveApiKeys(updated);
  };

  if (!loaded) return (
    <main className="min-h-screen bg-[#0c0c0c] flex items-center justify-center">
      <div className="text-[#666] text-sm" data-testid="app-loading">Loading...</div>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-[#e8e6e3] font-mono flex flex-col lg:flex-row" data-testid="app-loaded">
      {/* Skip to content link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-[#0c0c0c] focus:text-[#00ff41] focus:px-2 focus:py-1 focus:border-2 focus:border-[#00ff41]">
        Skip to main content
      </a>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar - Configuration */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-[280px] lg:w-[280px] lg:min-w-[280px]
        border-r-2 border-[#333]
        bg-[#0c0c0c]
        transform transition-transform duration-200
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Sidebar Header - Toggle */}
        <div
          role="button"
          data-testid="sidebar-toggle"
          tabIndex={0}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSidebarOpen((prev) => !prev);
            }
          }}
          className="w-full p-4 flex items-center justify-between hover:bg-[#141414] transition-colors min-h-[44px] focus:outline-none"
        >
          <span className="text-[11px] uppercase tracking-[0.1em] text-[#666]">
            Configuration
          </span>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-[11px] text-[#00ff41] hover:underline" onClick={(e) => e.stopPropagation()}>
              Keys
            </Link>
            <span className="text-[10px] text-[#444]">{sidebarOpen ? "Hide" : "Show"}</span>
            {/* Close button for mobile */}
            <button
              onClick={(e) => { e.stopPropagation(); setMobileMenuOpen(false); }}
              className="lg:hidden text-[#666] hover:text-[#e8e6e3] p-2"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
        </div>

        {sidebarOpen && (
          <div className="px-4 pb-4 flex flex-col gap-4">
            {/* Profile Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] text-[#888]">Profile</label>
              <ProfileCombobox
                value={profile}
                options={PROFILES.map((p) => ({ id: p.id, label: p.label, description: `${p.providers.length || 0} providers` }))}
                onChange={(nextProfile) => {
                  setProfile(nextProfile);
                  if (nextProfile !== "custom") {
                    setSelectedProviders([]);
                  }
                }}
              />
              <div className="flex flex-wrap gap-2 mt-2" aria-label="Advanced search toggles">
                <ToggleChip label="Deep research" pressed={deepResearch} onPressedChange={setDeepResearch} />
                <ToggleChip label="Skip cache" pressed={skipCache} onPressedChange={setSkipCache} />
                <div className="flex items-center gap-2">
                  <label className="text-[9px] text-[#777]">Max chars</label>
                  <select
                    value={maxChars}
                    onChange={(e) => setMaxChars(parseInt(e.target.value) || 8000)}
                    className="bg-[#141414] border border-[#333] px-2 py-1 text-[11px] text-[#e8e6e3] focus:border-[#00ff41] focus:outline-none"
                  >
                    {[4000, 8000, 12000].map((value) => (
                      <option key={value} value={value}>{value.toLocaleString()}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Provider Selection */}
            <div className="flex flex-col gap-2">
              <div className="text-[11px] text-[#888]">Providers</div>
              <div className="flex flex-wrap gap-1">
                {PROVIDERS.map((provider) => {
                  const available = isProviderAvailable(provider.id);
                  const isActive = activeProviders.includes(provider.id);
                  const isManual = selectedProviders.includes(provider.id);
                  const needsKey = !provider.free && !available;
                  const tooltipId = `provider-hint-${provider.id}`;
                  return (
                    <div key={provider.id} className="relative">
                      <button
                        onClick={() => {
                          if (!available) {
                            setSidebarOpen(true);
                            setApiKeysOpen(true);
                            setProviderStatus(`${provider.label} needs API key`);
                            return;
                          }
                          handleProviderToggle(provider.id);
                        }}
                        title={needsKey ? `${provider.label} needs API key` : undefined}
                        aria-pressed={isManual}
                        aria-describedby={!available ? tooltipId : undefined}
                        aria-label={`${provider.label} provider ${isManual ? "selected" : available ? "available" : "requires API key"}`}
                        className={`px-2 py-2 text-[11px] border-2 min-h-[44px] ${
                          isManual
                            ? "bg-[#00ff41] text-[#0c0c0c] border-[#00ff41]"
                            : isActive
                            ? "bg-[#1a3a1a] text-[#00ff41] border-[#00ff41]"
                            : available
                            ? "bg-transparent text-[#888] border-[#333] hover:border-[#00ff41]"
                            : "bg-transparent text-[#444] border-[#222]"
                        }`}
                      >
                        <span>{provider.label}</span>
                        {needsKey && <span className="ml-1 text-[9px]">(needs key)</span>}
                      </button>
                      {!available && (
                        <span id={tooltipId} className="sr-only">
                          {provider.label} requires an API key. Click to open API keys panel.
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#555]">
                {isCustomSelection
                  ? `${selectedProviders.length} selected`
                  : `Using ${profile} profile · ${profileProviders.length} providers`}
              </p>
            </div>

            {/* Advanced Options */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[11px] text-[#666] hover:text-[#888] text-left min-h-[44px] py-2"
              >
                {showAdvanced ? "▼" : "▶"} Advanced
              </button>
              {showAdvanced && (
                <div className="flex flex-col gap-3 pl-2">
                  <div className="flex items-center justify-between min-h-[44px]">
                    <label className="text-[11px] text-[#888]">Max chars</label>
                    <input
                      type="number"
                      value={maxChars}
                      onChange={(e) => setMaxChars(parseInt(e.target.value) || 8000)}
                      className="w-20 bg-[#141414] border-2 border-[#333] px-2 py-2 text-[11px] text-[#e8e6e3] focus:border-[#00ff41] focus:outline-none min-h-[44px]"
                    />
                  </div>
                  <label className="flex items-center gap-3 text-[11px] text-[#888] min-h-[44px] py-2">
                    <input
                      type="checkbox"
                      checked={skipCache}
                      onChange={(e) => setSkipCache(e.target.checked)}
                      className="w-5 h-5 bg-[#141414] border-2 border-[#333]"
                    />
                    Skip cache
                  </label>
                  <label className="flex items-center gap-3 text-[11px] text-[#888] min-h-[44px] py-2">
                    <input
                      type="checkbox"
                      checked={deepResearch}
                      onChange={(e) => setDeepResearch(e.target.checked)}
                      className="w-5 h-5 bg-[#141414] border-2 border-[#333]"
                    />
                    Deep research
                  </label>
                </div>
              )}
            </div>

            {/* API Keys - Collapsible */}
            <div className="flex flex-col gap-2">
              <button
                data-testid="api-keys-toggle"
                onClick={() => setApiKeysOpen(!apiKeysOpen)}
                className="text-[11px] text-[#666] hover:text-[#888] text-left min-h-[44px] py-2"
              >
                {apiKeysOpen ? "▼" : "▶"} API Keys
              </button>
              {apiKeysOpen && (
                <div className="flex flex-col gap-3 pl-2">
                  {PROVIDERS.filter((p) => !p.free).map((provider) => {
                    const key = `${provider.id}_api_key` as keyof ApiKeys;
                    const value = apiKeys[key] || "";
                    const source = keySource[provider.sourceKey || provider.id];
                    const hasServer = source === "server";
                    return (
                      <div key={provider.id} className="flex flex-col gap-1">
                        <label className="text-[10px] text-[#666]">{provider.label} {hasServer && !value && "(server)"}</label>
                        <input
                          type="password"
                          value={value}
                          onChange={(e) => handleKeyChange(key, e.target.value)}
                          placeholder={hasServer && !value ? "Using server key" : "sk-..."}
                          className="bg-[#141414] border-2 border-[#333] px-2 py-2 text-[12px] text-[#e8e6e3] placeholder:text-[#444] focus:border-[#00ff41] focus:outline-none min-h-[44px]"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* History */}
            <History onLoad={handleHistoryLoad} />
          </div>
        )}
      </aside>

      {/* Center - Input/Output */}
      <div id="main-content" className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="border-b-2 border-[#333] p-2 flex items-center justify-between min-h-[44px]">
          <div className="flex items-center gap-2">
            {/* Hamburger menu - mobile only */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-[#666] hover:text-[#e8e6e3] min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-[11px] text-[#666]">do-web-doc-resolver</span>
          </div>
          <Link href="/help" className="text-[11px] text-[#666] hover:text-[#00ff41] min-h-[44px] flex items-center px-2">
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  aria-label={loading ? "..." : "Fetch results"}
                  className="bg-[#00ff41] text-[#0c0c0c] px-4 py-2 text-[13px] font-bold hover:bg-[#00cc33] disabled:opacity-50 min-w-[60px] min-h-[44px]"
                >
                  {loading ? "..." : "Fetch"}
                </button>
                <button
                  onClick={() => {
                    setQuery("");
                    setResult("");
                    setError("");
                    setProviderStatus(null);
                    setResolveTime(null);
                    setSourceProvider(null);
                    setQualityScore(null);
                    setParsedResults([]);
                    setHelpfulIds(new Set());
                    setViewRaw(false);
                  }}
                  aria-label="Clear input and results"
                  className="bg-transparent text-[#888] px-4 py-2 text-[13px] border-2 border-[#333] hover:border-[#00ff41] hover:text-[#00ff41] min-h-[44px]"
                >
                  Clear
                </button>
              </div>
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
              <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-2 border-b-2 border-[#333] text-[11px] text-[#666]">
                <div className="flex items-center gap-4 flex-wrap">
                  <span>
                    Source: <span className="text-[#00ff41]">{sourceProvider}</span>
                  </span>
                  {resolveTime && <span>{resolveTime}ms</span>}
                  <span>{charCount.toLocaleString()} chars</span>
                  {qualityScore !== null && (
                    <span title="Quality score (0-100)">
                      Quality: <span className={qualityScore >= 70 ? "text-[#00ff41]" : qualityScore >= 40 ? "text-[#ffaa00]" : "text-[#ff4444]"}>{qualityScore}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewRaw(false)}
                    className={`px-3 py-1 border border-[#333] ${!viewRaw ? "text-[#00ff41] border-[#00ff41]" : "text-[#666]"}`}
                    aria-pressed={!viewRaw}
                  >
                    Cards
                  </button>
                  <button
                    onClick={() => setViewRaw(true)}
                    className={`px-3 py-1 border border-[#333] ${viewRaw ? "text-[#00ff41] border-[#00ff41]" : "text-[#666]"}`}
                    aria-pressed={viewRaw}
                  >
                    Raw
                  </button>
                  <button
                    onClick={handleCopyResult}
                    aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
                    aria-live="polite"
                    className="hover:text-[#e8e6e3] transition-colors min-h-[36px] px-2"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              {viewRaw || parsedResults.length === 0 ? (
                <textarea
                  readOnly
                  value={result}
                  className="flex-1 bg-[#141414] p-4 text-[13px] text-[#e8e6e3] font-mono resize-none focus:outline-none whitespace-pre-wrap overflow-auto min-h-[200px]"
                />
              ) : (
                <div className="flex-1 overflow-auto bg-[#0c0c0c] p-4 space-y-4">
                  {parsedResults.map((parsed) => (
                    <ResultCard
                      key={parsed.id}
                      result={parsed}
                      onCopy={handleCardCopy}
                      onHelpfulToggle={toggleHelpful}
                      helpful={helpfulIds.has(parsed.id)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#444] text-[13px] p-4 text-center">
              Paste a URL or enter a search query
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-[#0c0c0c] border-2 border-[#333] p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between mb-4">
              <h2 className="text-[13px] font-bold text-[#e8e6e3]">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-[#666] hover:text-[#e8e6e3] text-[18px] leading-none"
                aria-label="Close shortcuts"
              >
                ×
              </button>
            </div>
            <div className="space-y-2">
              {[
                { key: "Ctrl/Cmd + K", action: "Focus input" },
                { key: "Ctrl/Cmd + /", action: "Show/hide shortcuts" },
                { key: "Enter", action: "Submit query" },
                { key: "Escape", action: "Clear input or close modal" },
              ].map(({ key, action }) => (
                <div key={key} className="flex justify-between text-[11px]">
                  <span className="text-[#888]">{action}</span>
                  <kbd className="bg-[#222] px-2 py-1 text-[#e8e6e3] border border-[#333]">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
