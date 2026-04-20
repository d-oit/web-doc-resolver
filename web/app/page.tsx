"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { loadApiKeys, saveApiKeys, ApiKeys, resolveKeySource } from "@/lib/keys";
import { loadUIState, saveUIState, type UIState } from "@/lib/ui-state";
import History, { HistoryEntry } from "@/app/components/History";
import ProfileCombobox from "@/app/components/ProfileCombobox";
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
      setSourceProvider(data.provider);
      setQualityScore(data.quality_score ?? null);
      const endTime = performance.now();
      const timeTaken = Math.round(endTime - startTime);
      setResolveTime(timeTaken);

      saveToHistory({
        query: query.trim(),
        result: markdown,
        provider: data.provider,
        charCount: markdown.length,
        resolveTime: timeTaken,
        url: isUrl ? query.trim() : null,
        profile,
        flags: { skipCache, deepResearch },
        providers: activeProviders,
        normalizedUrlHashes,
      });

      setProviderStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setProviderStatus(null);
    } finally {
      setLoading(false);
    }
  }, [query, apiKeys, requestProviders, deepResearch, maxChars, skipCache, isUrl, profile, activeProviders, saveToHistory, loading]);

  const handleHistoryLoad = (entry: HistoryEntry) => {
    setQuery(entry.query);
    setResult(entry.result);
    setSourceProvider(entry.provider);
    setResolveTime(entry.resolveTime);
    setParsedResults(parseProviderResults(entry.result));
    setError("");
  };

  const handleKeyChange = (key: keyof ApiKeys, value: string) => {
    setApiKeys((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const handleCopyResult = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCardCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleHelpful = (id: string) => {
    setHelpfulIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!loaded) return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-text-muted text-sm" data-testid="app-loading">Loading...</div>
    </main>
  );

  return (
    <main className="min-h-screen bg-background text-foreground font-mono flex flex-col lg:flex-row" data-testid="app-loaded">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Configuration */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-background border-r-2 border-border-muted transition-transform duration-300 lg:relative lg:translate-x-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${sidebarOpen ? "lg:w-72" : "lg:w-16"}
        `}
      >
        <button
          data-testid="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-full p-4 flex items-center justify-between hover:bg-[#141414] transition-colors min-h-[44px] focus:outline-none"
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? (
            <>
              <span className="text-[11px] uppercase tracking-[0.1em] text-text-muted">
                Configuration
              </span>
              <div className="flex items-center gap-2">
                <Link href="/settings" className="text-[11px] text-text-muted hover:text-accent">
                  Keys
                </Link>
                <span className="text-[10px] text-text-dim">Hide</span>
              </div>
            </>
          ) : (
            <span className="w-full text-center text-[10px] text-text-dim">Show</span>
          )}
        </button>

        {sidebarOpen && (
          <div className="p-4 flex flex-col gap-8 overflow-y-auto max-h-[calc(100vh-44px)]">
            {/* Profile */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] text-text-muted">Profile</label>
              <ProfileCombobox
                value={profile}
                onChange={(p) => {
                  setProfile(p as ProfileId);
                  setSelectedProviders([]);
                }}
                options={PROFILES.map((p) => ({
                  id: p.id,
                  label: p.label,
                  description: p.providers.join(", "),
                }))}
              />
              <span className="text-[10px] text-text-dim">
                {isCustomSelection ? `${selectedProviders.length} selected` : `Using ${profile} profile`}
              </span>
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] text-text-muted">Max chars</label>
                  <span className="text-[9px] text-accent">{(maxChars / 1000).toFixed(0)}k</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="32000"
                  step="1000"
                  value={maxChars}
                  onChange={(e) => setMaxChars(parseInt(e.target.value))}
                  className="w-full h-1 bg-border-muted accent-accent appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Provider Selection */}
            <div className="flex flex-col gap-2">
              <div className="text-[11px] text-text-muted">Providers</div>
              <div className="flex flex-wrap gap-1">
                {PROVIDERS.map((provider) => {
                  const available = isProviderAvailable(provider.id);
                  const isActive = activeProviders.includes(provider.id);
                  const isManual = selectedProviders.includes(provider.id);
                  const needsKey = !provider.free && !available;
                  const tooltipId = `provider-hint-${provider.id}`;
                  const showHint = needsKey || (provider.id === "duckduckgo" && mistralActive);
                  return (
                    <div key={provider.id} className="relative group">
                      <button
                        onClick={() => {
                          if (!available) {
                            setApiKeysOpen(true);
                            return;
                          }
                          handleProviderToggle(provider.id);
                        }}
                        aria-describedby={showHint ? tooltipId : undefined}
                        className={`
                          px-2 py-1 text-[10px] border-2 transition-colors min-h-[36px]
                          ${
                            isActive
                              ? isManual
                                ? "bg-accent text-background border-accent font-bold"
                                : "border-accent text-accent"
                              : "bg-transparent text-text-dim border-border-muted hover:border-border-strong"
                          }
                        `}
                      >
                        {provider.label}
                        {needsKey && <span className="ml-1 text-[9px] text-text-muted">(needs key)</span>}
                      </button>
                      {showHint && (
                        <div
                          id={tooltipId}
                          role="tooltip"
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#222] border border-border-muted text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
                        >
                          {needsKey ? "Requires API key" : "Disabled while Mistral active"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-text-dim">
                {isCustomSelection
                  ? "Custom selection active. Deselect all to return to profile defaults."
                  : "Profile-recommended providers are outlined in green."}
              </p>
            </div>

            {/* API Keys */}
            <div className="flex flex-col gap-2">
              <button
                data-testid="api-keys-toggle"
                onClick={() => setApiKeysOpen(!apiKeysOpen)}
                className="text-[11px] text-text-muted hover:text-foreground text-left min-h-[44px] py-2"
              >
                {apiKeysOpen ? "▼" : "▶"} API Keys
              </button>
              {apiKeysOpen && (
                <div className="flex flex-col gap-3 pl-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-text-muted">Max chars</label>
                      <span className="text-[9px] text-accent">{(maxChars / 1000).toFixed(0)}k</span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="32000"
                      step="1000"
                      value={maxChars}
                      onChange={(e) => setMaxChars(parseInt(e.target.value))}
                      className="w-full h-1 bg-border-muted accent-accent appearance-none cursor-pointer"
                    />
                  </div>
                  <label className="flex items-center gap-3 text-[11px] text-text-muted min-h-[44px] py-2">
                    <input
                      type="checkbox"
                      checked={skipCache}
                      onChange={(e) => setSkipCache(e.target.checked)}
                      className="w-5 h-5 bg-[#141414] border-2 border-border-muted accent-accent"
                    />
                    Skip cache
                  </label>
                  <label className="flex items-center gap-3 text-[11px] text-text-muted min-h-[44px] py-2">
                    <input
                      type="checkbox"
                      checked={deepResearch}
                      onChange={(e) => setDeepResearch(e.target.checked)}
                      className="w-5 h-5 bg-[#141414] border-2 border-border-muted accent-accent"
                    />
                    Deep research
                  </label>
                  <hr className="border-border-muted my-1" />
                  {PROVIDERS.filter((p) => !p.free).map((provider) => {
                    const key = `${provider.id}_api_key` as keyof ApiKeys;
                    const value = apiKeys[key] || "";
                    const source = keySource[provider.sourceKey || provider.id];
                    const hasServer = source === "server";
                    return (
                      <div key={provider.id} className="flex flex-col gap-1">
                        <label className="text-[10px] text-text-muted">{provider.label} {hasServer && !value && "(server)"}</label>
                        <input
                          type="password"
                          value={value}
                          onChange={(e) => handleKeyChange(key, e.target.value)}
                          placeholder={hasServer && !value ? "Using server key" : "sk-..."}
                          className="bg-[#141414] border-2 border-border-muted px-2 py-2 text-[12px] text-foreground placeholder:text-text-dim focus:border-accent focus:outline-none min-h-[44px]"
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
        <div className="border-b-2 border-border-muted p-2 flex items-center justify-between min-h-[44px]">
          <div className="flex items-center gap-2">
            {/* Hamburger menu - mobile only */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-text-muted hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-[11px] text-text-muted">do-web-doc-resolver</span>
          </div>
          <Link href="/help" className="text-[11px] text-text-muted hover:text-accent min-h-[44px] flex items-center px-2">
            Help
          </Link>
        </div>

        {/* Input */}
        <div className="border-b-2 border-border-muted p-4">
          <div className="flex items-center gap-4">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="URL or search query..."
              className="flex-1 bg-transparent text-[20px] sm:text-[24px] text-foreground placeholder:text-text-dim focus:outline-none tracking-tight"
            />
            {query.trim() && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  aria-label={loading ? "..." : "Fetch results"}
                  className="bg-accent text-background px-4 py-2 text-[13px] font-bold hover:bg-[#00cc33] disabled:opacity-50 min-w-[60px] min-h-[44px]"
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
                  className="bg-transparent text-text-dim px-4 py-2 text-[13px] border-2 border-border-muted hover:border-accent hover:text-accent min-h-[44px]"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          {query.trim() && (
            <div className="text-[11px] text-text-muted mt-2 uppercase tracking-wider">
              {isUrl ? "Resolving as URL" : "Searching"}
            </div>
          )}
          {providerStatus && (
            <div className="text-[11px] text-accent mt-2 animate-pulse">
              {providerStatus}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 border-b-2 border-border-muted text-error text-[13px]">
            {error}
          </div>
        )}

        {/* Output */}
        <div className="flex-1 flex flex-col min-h-0">
          {result ? (
            <>
              {/* Metadata bar */}
              <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-2 border-b-2 border-border-muted text-[11px] text-text-muted">
                <div className="flex items-center gap-4 flex-wrap">
                  <span>
                    Source: <span className="text-accent">{sourceProvider}</span>
                  </span>
                  {resolveTime && <span>{resolveTime}ms</span>}
                  <span>{charCount.toLocaleString()} chars</span>
                  {qualityScore !== null && (
                    <span title="Quality score (0-100)">
                      Quality: <span className={qualityScore >= 70 ? "text-accent" : qualityScore >= 40 ? "text-[#ffaa00]" : "text-error"}>{qualityScore}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewRaw(false)}
                    className={`px-3 py-1 border border-border-muted ${!viewRaw ? "text-accent border-accent" : "text-text-muted"}`}
                    aria-pressed={!viewRaw}
                  >
                    Cards
                  </button>
                  <button
                    onClick={() => setViewRaw(true)}
                    className={`px-3 py-1 border border-border-muted ${viewRaw ? "text-accent border-accent" : "text-text-muted"}`}
                    aria-pressed={viewRaw}
                  >
                    Raw
                  </button>
                  <button
                    onClick={handleCopyResult}
                    aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
                    aria-live="polite"
                    className="hover:text-foreground transition-colors min-h-[36px] px-2"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              {viewRaw || parsedResults.length === 0 ? (
                <textarea
                  readOnly
                  value={result}
                  className="flex-1 bg-[#141414] p-4 text-[13px] text-foreground font-mono resize-none focus:outline-none whitespace-pre-wrap overflow-auto min-h-[200px]"
                />
              ) : (
                <div className="flex-1 overflow-auto bg-background p-4 space-y-4">
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
            <div className="flex-1 flex items-center justify-center text-text-dim text-[13px] p-4 text-center">
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
            className="bg-background border-2 border-border-muted p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between mb-4">
              <h2 className="text-[13px] font-bold text-foreground">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-text-muted hover:text-foreground text-[18px] leading-none"
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
                  <span className="text-text-muted">{action}</span>
                  <kbd className="bg-[#222] px-2 py-1 text-foreground border border-border-muted">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
