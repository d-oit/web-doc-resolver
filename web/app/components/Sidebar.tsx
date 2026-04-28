"use client";

import Link from "next/link";
import History, { HistoryEntry } from "./History";
import ProfileCombobox from "./ProfileCombobox";
import { ApiKeys, KeySource } from "@/lib/keys";
import { ProfileId, PROVIDERS, PROFILES } from "../constants";
import { Dispatch, SetStateAction } from "react";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  profile: ProfileId;
  setProfile: (profile: ProfileId) => void;
  setSelectedProviders: Dispatch<SetStateAction<string[]>>;
  apiKeys: ApiKeys;
  handleKeyChange: (key: keyof ApiKeys, value: string) => void;
  handleProviderToggle: (providerId: string) => void;
  isProviderAvailable: (providerId: string) => boolean;
  activeProviders: string[];
  selectedProviders: string[];
  maxChars: number;
  setMaxChars: (chars: number) => void;
  skipCache: boolean;
  setSkipCache: (skip: boolean) => void;
  deepResearch: boolean;
  setDeepResearch: (deep: boolean) => void;
  apiKeysOpen: boolean;
  setApiKeysOpen: (open: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  keySource: Record<string, KeySource>;
  mistralActive: boolean;
  handleHistoryLoad: (entry: HistoryEntry) => void;
  isCustomSelection: boolean;
}

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  profile,
  setProfile,
  setSelectedProviders,
  apiKeys,
  handleKeyChange,
  handleProviderToggle,
  isProviderAvailable,
  activeProviders,
  selectedProviders,
  maxChars,
  setMaxChars,
  skipCache,
  setSkipCache,
  deepResearch,
  setDeepResearch,
  apiKeysOpen,
  setApiKeysOpen,
  mobileMenuOpen,
  setMobileMenuOpen,
  keySource,
  mistralActive,
  handleHistoryLoad,
  isCustomSelection,
}: SidebarProps) {
  return (
    <>
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
          className="w-full p-4 flex items-center justify-between hover:bg-[#141414] transition-colors min-h-[44px]"
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
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#222] border border-border-muted text-[9px] text-text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
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
                          className="bg-[#141414] border-2 border-border-muted px-2 py-2 text-[12px] text-foreground placeholder:text-text-dim focus:border-accent min-h-[44px]"
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
    </>
  );
}