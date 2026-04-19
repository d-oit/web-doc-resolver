"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface HistoryEntry {
  id: string;
  query: string;
  url: string | null;
  result: string;
  provider: string;
  timestamp: number;
  charCount: number;
  resolveTime: number;
  profile?: string;
  flags?: {
    skipCache?: boolean;
    deepResearch?: boolean;
  };
  providers?: string[];
  normalizedUrlHashes?: string[];
}

interface HistoryProps {
  onLoad: (entry: HistoryEntry) => void;
}

export default function History({ onLoad }: HistoryProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const fetchHistory = useCallback(async (ignore: boolean) => {
    setLoading(true);
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/history${params}`);
      if (res.ok && !ignore) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch {
      // Silent fail
    } finally {
      if (!ignore) setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      setTimeout(() => fetchHistory(ignore), 0);
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, fetchHistory]);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      setConfirmDeleteId(id);
      deleteTimeoutRef.current = setTimeout(() => {
        setConfirmDeleteId(null);
        deleteTimeoutRef.current = null;
      }, 3000);
      return;
    }

    try {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setConfirmDeleteId(null);
      deleteTimeoutRef.current = null;
    } catch {
      setConfirmDeleteId(null);
      deleteTimeoutRef.current = null;
    }
  };

  const handleLoad = (entry: HistoryEntry) => {
    onLoad(entry);
    setIsOpen(false);
  };

  return (
    <div className="border-t-2 border-border-muted">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-[#141414] transition-colors text-[11px] text-text-muted min-h-[44px]"
        aria-expanded={isOpen}
        aria-controls="history-panel"
      >
        <span className="uppercase tracking-[0.1em]">History ({entries.length})</span>
        <span>{isOpen ? "▼" : "▶"}</span>
      </button>

      {isOpen && (
        <div id="history-panel" className="px-4 pb-4">
          {/* Search */}
          <div className="relative mb-2">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search history..."
              className="w-full bg-[#141414] border-2 border-border-muted px-2 py-2 text-[11px] text-foreground placeholder:text-text-dim focus:border-accent focus:outline-none min-h-[44px] pr-10"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-0 top-0 h-full px-3 text-text-dim hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[320px] overflow-y-auto flex flex-col gap-2">
            {loading ? (
              <div className="text-[10px] text-text-muted py-2">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-[10px] text-text-muted py-2">No history yet</div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="border border-[#222] p-3 bg-[#101010] group">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => handleLoad(entry)}
                      className="text-left text-[11px] text-foreground hover:text-accent flex-1"
                    >
                      {entry.query}
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className={`text-[10px] min-h-[32px] min-w-[32px] flex items-center justify-center transition-all ${
                        confirmDeleteId === entry.id
                          ? "text-[#ff4444] font-bold"
                          : "text-text-muted hover:text-[#ff4444] opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      }`}
                      aria-label={
                        confirmDeleteId === entry.id ? `Confirm delete ${entry.query}` : `Delete ${entry.query}`
                      }
                    >
                      {confirmDeleteId === entry.id ? "CONFIRM" : "×"}
                    </button>
                  </div>
                  <div className="text-[9px] text-text-dim mt-1 flex flex-wrap gap-2">
                    <span>{entry.provider}</span>
                    <span>{entry.charCount.toLocaleString()} chars</span>
                    <span>{entry.resolveTime}ms</span>
                    <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {entry.profile && (
                      <span className="text-[9px] uppercase tracking-wide border border-border-muted px-2 py-1 text-text-muted">
                        {entry.profile}
                      </span>
                    )}
                    {entry.flags?.deepResearch && (
                      <span className="text-[9px] border border-border-muted px-2 py-1 text-text-muted">Deep research</span>
                    )}
                    {entry.flags?.skipCache && (
                      <span className="text-[9px] border border-border-muted px-2 py-1 text-text-muted">Skip cache</span>
                    )}
                    {entry.providers?.slice(0, 3).map((provider) => (
                      <span key={`${entry.id}-${provider}`} className="text-[9px] border border-[#222] px-2 py-1 text-text-dim">
                        {provider}
                      </span>
                    ))}
                    {entry.providers && entry.providers.length > 3 && (
                      <span className="text-[9px] text-text-dim font-bold">+${entry.providers.length - 3}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
