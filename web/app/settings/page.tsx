"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { loadApiKeys, saveApiKeys, ApiKeys } from "@/lib/keys";

const KEY_FIELDS = [
  {
    key: "serper_api_key" as keyof ApiKeys,
    label: "Serper (Google Search)",
    placeholder: "Free 2500 credits at serper.dev",
    helpText: "Google search results via serper.dev",
    provider: "serper",
  },
  {
    key: "tavily_api_key" as keyof ApiKeys,
    label: "Tavily",
    placeholder: "Get key at tavily.com",
    helpText: "Comprehensive search with raw page content",
    provider: "tavily",
  },
  {
    key: "exa_api_key" as keyof ApiKeys,
    label: "Exa",
    placeholder: "Get key at exa.ai",
    helpText: "Neural search with higher rate limits",
    provider: "exa",
  },
  {
    key: "firecrawl_api_key" as keyof ApiKeys,
    label: "Firecrawl",
    placeholder: "Get key at firecrawl.dev",
    helpText: "Deep URL extraction with JavaScript rendering",
    provider: "firecrawl",
  },
  {
    key: "mistral_api_key" as keyof ApiKeys,
    label: "Mistral",
    placeholder: "Get key at mistral.ai",
    helpText: "AI-powered web search and URL browsing",
    provider: "mistral",
  },
];

type KeyStatus = Record<string, boolean>;

function SourceBadge({
  localHasKey,
  serverHasKey,
}: {
  localHasKey: boolean;
  serverHasKey: boolean;
}) {
  if (localHasKey) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        Local key
      </span>
    );
  }
  if (serverHasKey) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Server key
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      <span className="h-2 w-2 rounded-full bg-neutral-400" />
      Not configured
    </span>
  );
}

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({});
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "ok" | "fail" | null>>({});

  useEffect(() => {
    setApiKeys(loadApiKeys());
    fetch("/api/key-status")
      .then((res) => res.json())
      .then(setKeyStatus)
      .catch(() => {});
  }, []);

  const handleKeyChange = (key: keyof ApiKeys, value: string) => {
    const newKeys = { ...apiKeys, [key]: value || undefined };
    setApiKeys(newKeys);
    saveApiKeys(newKeys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearKey = (key: keyof ApiKeys) => {
    const newKeys = { ...apiKeys };
    delete newKeys[key];
    setApiKeys(newKeys);
    saveApiKeys(newKeys);
  };

  const clearAll = () => {
    setApiKeys({});
    saveApiKeys({});
    setTestResults({});
  };

  const testKey = async (field: (typeof KEY_FIELDS)[0]) => {
    const key = apiKeys[field.key];
    if (!key) return;
    setTesting(field.key);
    setTestResults((prev) => ({ ...prev, [field.key]: null }));
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "test connectivity",
          [field.key]: key,
          providers: [field.key.replace("_api_key", "")],
          testMode: true,
        }),
      });
      setTestResults((prev) => ({
        ...prev,
        [field.key]: res.ok ? "ok" : "fail",
      }));
    } catch {
      setTestResults((prev) => ({ ...prev, [field.key]: "fail" }));
    } finally {
      setTesting(null);
    }
  };

  const hasKeys = Object.values(apiKeys).some((v) => v);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 lg:p-16">
      <nav className="w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl flex items-center justify-between mb-6 sm:mb-8">
        <Link
          href="/"
          className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Home"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
            <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15.75a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
          </svg>
        </Link>
        <div className="flex gap-2 sm:gap-4 items-center">
          <Link
            href="/help"
            className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Help
          </Link>
        </div>
      </nav>

      <div className="w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Settings
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Configure API keys for paid search providers. Keys are stored
            locally in your browser and never sent to third parties.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
          {KEY_FIELDS.map((field) => {
            const value = apiKeys[field.key] || "";
            const localHasKey = !!value;
            const serverHasKey = !!keyStatus[field.provider];
            const testResult = testResults[field.key];

            return (
              <div key={field.key} className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {field.label}
                    </label>
                    <SourceBadge localHasKey={localHasKey} serverHasKey={serverHasKey} />
                    {testResult === "ok" && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Verified
                      </span>
                    )}
                    {testResult === "fail" && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Failed
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {localHasKey && (
                      <>
                        <button
                          onClick={() => testKey(field)}
                          disabled={testing === field.key}
                          className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50"
                        >
                          {testing === field.key ? "Testing..." : "Test"}
                        </button>
                        <button
                          onClick={() => clearKey(field.key)}
                          className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  {field.helpText}
                </p>
                {!localHasKey && serverHasKey && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                    A server-side key is configured. Enter your own to override it.
                  </p>
                )}
                <input
                  type="password"
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(e) => handleKeyChange(field.key, e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              </div>
            );
          })}
        </div>

        {hasKeys && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Clear all API keys
            </button>
          </div>
        )}

        {saved && (
          <div className="fixed bottom-4 right-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900">
            Saved
          </div>
        )}

        <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            Free providers (always available)
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            <strong>Exa MCP</strong> and <strong>DuckDuckGo</strong> are
            free and always active — no API key required. They run first in the
            cascade and serve as the default fallback. Add paid provider keys
            above for faster, more comprehensive results.
          </p>
        </div>
      </div>
    </main>
  );
}
