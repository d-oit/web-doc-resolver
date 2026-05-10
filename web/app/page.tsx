"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { loadApiKeys, saveApiKeys, ApiKeys, resolveKeySource } from "@/lib/keys";
import { loadUIState, saveUIState, type UIState } from "@/lib/ui-state";
import { HistoryEntry } from "@/app/components/History";
import { parseProviderResults, extractNormalizedUrls, type ProviderResult } from "@/lib/results";
import { PROVIDERS, PROFILES, ProfileId, UiProvider, toApiProviderId } from "@/app/constants";
import Sidebar from "@/app/components/Sidebar";
import MainContent from "@/app/components/MainContent";

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

  const SEARCH_STORAGE_KEY = "wdr-search-state";

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
        setSkipCache(Boolean(ui.skipCache));
        setDeepResearch(Boolean(ui.deepResearch));
        if (ui.apiKeys && typeof ui.apiKeys === "object") {
          const keys = loadApiKeys();
          const mergedKeys = { ...keys, ...ui.apiKeys } as ApiKeys;
          setApiKeys(mergedKeys);
          saveApiKeys(mergedKeys);
        }

        // Load search state from localStorage
        const savedSearch = localStorage.getItem(SEARCH_STORAGE_KEY);
        if (savedSearch) {
          try {
            const search = JSON.parse(savedSearch);
            if (search.query) setQuery(search.query);
            if (search.result) {
              setResult(search.result);
              setParsedResults(parseProviderResults(search.result));
            }
            if (search.error) setError(search.error);
            if (search.resolveTime) setResolveTime(search.resolveTime);
            if (search.sourceProvider) setSourceProvider(search.sourceProvider);
            if (search.qualityScore) setQualityScore(search.qualityScore);
            if (Array.isArray(search.helpfulIds)) {
              setHelpfulIds(new Set(search.helpfulIds));
            }
          } catch (e) {
            console.error("Failed to parse saved search state", e);
          }
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

  // Persist search state changes
  useEffect(() => {
    if (!loaded) return;
    const searchState = {
      query,
      result,
      error,
      resolveTime,
      sourceProvider,
      qualityScore,
      helpfulIds: Array.from(helpfulIds),
    };
    localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(searchState));
  }, [loaded, query, result, error, resolveTime, sourceProvider, qualityScore, helpfulIds]);

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

  const isUrl = query.trim().startsWith("http");
  const mistralActive = keySource["mistral"] === "local" || keySource["mistral"] === "server";

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

  const handleSubmit = useCallback(async (
    e?: React.FormEvent,
    override?: {
      query?: string;
      profile?: ProfileId | undefined;
      providers?: string[] | undefined;
      deepResearch?: boolean | undefined;
      maxChars?: number | undefined;
      skipCache?: boolean | undefined;
      isHistoryLoad?: boolean | undefined;
    }
  ) => {
    e?.preventDefault();
    const activeQuery = override?.query ?? query;
    if (!activeQuery.trim() || loading) return;

    setLoading(true);
    setError("");
    if (!override?.isHistoryLoad) {
      setParsedResults([]);
      setResult("");
    }
    setProviderStatus("Fetching...");
    const startTime = performance.now();

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: activeQuery.trim(),
          ...apiKeys,
          providers: override?.providers ?? requestProviders,
          deepResearch: override?.deepResearch ?? deepResearch,
          maxChars: override?.maxChars ?? maxChars,
          skipCache: override?.skipCache ?? skipCache,
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

      // If we're overriding providers, they might be different from activeProviders state
      const historyProviders = override?.providers
        ? PROVIDERS.filter(p => override.providers!.includes(toApiProviderId(p.id))).map(p => p.id)
        : activeProviders;

      saveToHistory({
        query: activeQuery.trim(),
        result: markdown,
        provider: data.provider,
        charCount: markdown.length,
        resolveTime: timeTaken,
        url: activeQuery.trim().startsWith("http") ? activeQuery.trim() : null,
        profile: override?.profile ?? profile,
        flags: {
          skipCache: override?.skipCache ?? skipCache,
          deepResearch: override?.deepResearch ?? deepResearch,
        },
        providers: historyProviders,
        normalizedUrlHashes,
      });

      setProviderStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setProviderStatus(null);
    } finally {
      setLoading(false);
    }
  }, [query, apiKeys, requestProviders, deepResearch, maxChars, skipCache, profile, activeProviders, saveToHistory, loading]);

  const handleHistoryLoad = (entry: HistoryEntry) => {
    setQuery(entry.query);
    setResult(entry.result);
    setSourceProvider(entry.provider);
    setResolveTime(entry.resolveTime);
    setParsedResults(parseProviderResults(entry.result));
    setError("");

    // Restore associated settings or reset to defaults
    const restoredProfile = (entry.profile && PROFILES.some((p) => p.id === entry.profile))
      ? (entry.profile as ProfileId)
      : "free";
    setProfile(restoredProfile);

    const restoredProviders = entry.providers ?? [];
    setSelectedProviders(restoredProviders);

    const restoredSkipCache = Boolean(entry.flags?.skipCache);
    const restoredDeepResearch = Boolean(entry.flags?.deepResearch);
    setSkipCache(restoredSkipCache);
    setDeepResearch(restoredDeepResearch);
    setMobileMenuOpen(false);

    // Re-run the search to ensure results are fresh and state is synced
    handleSubmit(undefined, {
      query: entry.query,
      profile: restoredProfile,
      providers: restoredProviders.length > 0 ? restoredProviders.map(toApiProviderId) : undefined,
      skipCache: restoredSkipCache,
      deepResearch: restoredDeepResearch,
      maxChars, // Keep current maxChars or could also store/restore it
      isHistoryLoad: true,
    });

    inputRef.current?.focus();
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

      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        profile={profile}
        setProfile={setProfile}
        selectedProviders={selectedProviders}
        setSelectedProviders={setSelectedProviders}
        maxChars={maxChars}
        setMaxChars={setMaxChars}
        skipCache={skipCache}
        setSkipCache={setSkipCache}
        deepResearch={deepResearch}
        setDeepResearch={setDeepResearch}
        apiKeysOpen={apiKeysOpen}
        setApiKeysOpen={setApiKeysOpen}
        apiKeys={apiKeys}
        handleKeyChange={handleKeyChange}
        handleProviderToggle={handleProviderToggle}
        isProviderAvailable={isProviderAvailable}
        activeProviders={activeProviders}
        mistralActive={mistralActive}
        keySource={keySource as Record<string, string>}
        handleHistoryLoad={handleHistoryLoad}
        isCustomSelection={isCustomSelection}
      />

      <MainContent
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        query={query}
        setQuery={setQuery}
        handleSubmit={handleSubmit}
        loading={loading}
        inputRef={inputRef}
        error={error}
        result={result}
        setResult={setResult}
        setError={setError}
        providerStatus={providerStatus}
        setProviderStatus={setProviderStatus}
        sourceProvider={sourceProvider}
        setSourceProvider={setSourceProvider}
        resolveTime={resolveTime}
        setResolveTime={setResolveTime}
        qualityScore={qualityScore}
        setQualityScore={setQualityScore}
        parsedResults={parsedResults}
        setParsedResults={setParsedResults}
        viewRaw={viewRaw}
        setViewRaw={setViewRaw}
        helpfulIds={helpfulIds}
        toggleHelpful={toggleHelpful}
        handleCopyResult={handleCopyResult}
        handleCardCopy={handleCardCopy}
        copied={copied}
        isUrl={isUrl}
      />

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
