"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { loadApiKeys, saveApiKeys, ApiKeys, resolveKeySource } from "@/lib/keys";
import { loadUIState, saveUIState, type UIState } from "@/lib/ui-state";
import { parseProviderResults, extractNormalizedUrls, type ProviderResult } from "@/lib/results";
import { HistoryEntry } from "./components/History";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";
import { ProfileId, PROVIDERS, PROFILES, toApiProviderId } from "./constants";

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
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
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
        setLoaded(true);
        inputRef.current?.focus();
      });
  }, []);

  // Persist UI state changes
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
    } catch {}
  }, []);

  const handleSubmit = useCallback(async () => {
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
        url: query.trim().startsWith("http") ? query.trim() : null,
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
  }, [query, apiKeys, requestProviders, deepResearch, maxChars, skipCache, profile, activeProviders, saveToHistory, loading]);

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

  const clearAll = () => {
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
  };

  if (!loaded) return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-text-muted text-sm" data-testid="app-loading">Loading...</div>
    </main>
  );

  return (
    <main className="min-h-screen bg-background text-foreground font-mono flex flex-col lg:flex-row" data-testid="app-loaded">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        profile={profile}
        setProfile={setProfile}
        setSelectedProviders={setSelectedProviders}
        apiKeys={apiKeys}
        handleKeyChange={handleKeyChange}
        handleProviderToggle={handleProviderToggle}
        isProviderAvailable={isProviderAvailable}
        activeProviders={activeProviders}
        selectedProviders={selectedProviders}
        maxChars={maxChars}
        setMaxChars={setMaxChars}
        skipCache={skipCache}
        setSkipCache={setSkipCache}
        deepResearch={deepResearch}
        setDeepResearch={setDeepResearch}
        apiKeysOpen={apiKeysOpen}
        setApiKeysOpen={setApiKeysOpen}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        keySource={keySource}
        mistralActive={mistralActive}
        handleHistoryLoad={handleHistoryLoad}
        isCustomSelection={isCustomSelection}
      />
      <MainContent
        query={query}
        setQuery={setQuery}
        handleSubmit={handleSubmit}
        loading={loading}
        result={result}
        error={error}
        providerStatus={providerStatus}
        sourceProvider={sourceProvider}
        resolveTime={resolveTime}
        qualityScore={qualityScore}
        parsedResults={parsedResults}
        viewRaw={viewRaw}
        setViewRaw={setViewRaw}
        handleCopyResult={handleCopyResult}
        copied={copied}
        helpfulIds={helpfulIds}
        toggleHelpful={toggleHelpful}
        handleCardCopy={handleCardCopy}
        inputRef={inputRef}
        setMobileMenuOpen={setMobileMenuOpen}
        clearAll={clearAll}
      />
      <KeyboardShortcutsModal
        showShortcuts={showShortcuts}
        setShowShortcuts={setShowShortcuts}
      />
    </main>
  );
}