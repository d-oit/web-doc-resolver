"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { loadApiKeys, saveApiKeys, ApiKeys } from "@/lib/keys";
import { loadStateFromServer, saveStateToServer } from "@/lib/ui-state";

const KEY_FIELDS = [
  {
    key: "serper_api_key" as keyof ApiKeys,
    label: "Serper",
    provider: "serper",
  },
  {
    key: "tavily_api_key" as keyof ApiKeys,
    label: "Tavily",
    provider: "tavily",
  },
  {
    key: "exa_api_key" as keyof ApiKeys,
    label: "Exa",
    provider: "exa",
  },
  {
    key: "firecrawl_api_key" as keyof ApiKeys,
    label: "Firecrawl",
    provider: "firecrawl",
  },
  {
    key: "mistral_api_key" as keyof ApiKeys,
    label: "Mistral",
    provider: "mistral",
  },
];

type KeyStatus = Record<string, boolean>;

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
    if (typeof window === "undefined") return {};
    return loadApiKeys();
  });
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/key-status")
      .then((res) => res.json())
      .then(setKeyStatus)
      .catch(() => {});

    loadStateFromServer()
      .then((serverState) => {
        if (serverState?.apiKeys) {
          setApiKeys(serverState.apiKeys);
          saveApiKeys(serverState.apiKeys);
        }
      })
      .catch(() => {});
  }, []);

  const persistKeys = (newKeys: ApiKeys) => {
    saveApiKeys(newKeys);
    saveStateToServer({ apiKeys: newKeys });
  };

  const handleKeyChange = (key: keyof ApiKeys, value: string) => {
    const newKeys = { ...apiKeys, [key]: value || undefined };
    setApiKeys(newKeys);
    persistKeys(newKeys);
    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
  };

  const clearKey = (key: keyof ApiKeys) => {
    const newKeys = { ...apiKeys };
    delete newKeys[key];
    setApiKeys(newKeys);
    persistKeys(newKeys);
  };

  return (
    <main className="min-h-screen bg-[#0c0c0c] text-[#e8e6e3] font-mono p-8">
      <div className="max-w-xl">
        <div className="mb-8">
          <Link href="/" className="text-[11px] uppercase tracking-[0.1em] text-[#666] hover:text-[#00ff41]">
            ← Back
          </Link>
        </div>

        <h1 className="text-[24px] font-bold tracking-tight mb-2">Settings</h1>
        <p className="text-[11px] text-[#666] mb-8">
          Configure API keys. Persisted via server-backed UI state on Vercel.
        </p>

        <div className="flex flex-col gap-4">
          {KEY_FIELDS.map((field) => {
            const value = apiKeys[field.key] || "";
            const localHasKey = !!value;
            const serverHasKey = !!keyStatus[field.provider];

            return (
              <div key={field.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[13px]">{field.label}</label>
                  <div className="flex items-center gap-2">
                    {localHasKey ? (
                      <span className="text-[11px] text-[#00ff41]">Local key</span>
                    ) : serverHasKey ? (
                      <span className="text-[11px] text-[#666]">Server key</span>
                    ) : (
                      <span className="text-[11px] text-[#444]">Not configured</span>
                    )}
                    {localHasKey && (
                      <button
                        onClick={() => clearKey(field.key)}
                        className="text-[11px] text-[#ff4444] hover:text-[#ff6666]"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="password"
                  value={value}
                  onChange={(e) => handleKeyChange(field.key, e.target.value)}
                  placeholder="sk-..."
                  className="bg-[#141414] border-2 border-[#333] px-3 py-2 text-[13px] text-[#e8e6e3] placeholder:text-[#444] focus:border-[#00ff41] focus:outline-none"
                />
                {serverHasKey && !localHasKey && (
                  <p className="text-[11px] text-[#666]">
                    Server key available. Enter your own to override.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 p-4 border-2 border-[#333]">
          <div className="text-[11px] uppercase tracking-[0.1em] text-[#666] mb-2">
            Free providers
          </div>
          <p className="text-[11px] text-[#888]">
            Jina, Exa MCP, and DuckDuckGo are free and always available—no API key required.
          </p>
        </div>

        {saved && (
          <div className="fixed bottom-4 right-4 bg-[#00ff41] text-[#0c0c0c] px-4 py-2 text-[12px] font-bold">
            Saved
          </div>
        )}
      </div>
    </main>
  );
}
