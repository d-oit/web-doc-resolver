"use client";

import { useState, useEffect, useRef } from "react";

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

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/history${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, search]);

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
    <div className="border-t-2 border-[#333]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-[#141414] transition-colors text-[11px] text-[#949494] min-h-[44px]"
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
              className="w-full bg-[#141414] border-2 border-[#333] px-2 py-2 pr-10 text-[11px] text-[#e8e6e3] placeholder:text-[#949494] focus:border-[#00ff41] focus:outline-none min-h-[44px]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#949494] hover:text-[#e8e6e3] p-2"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[320px] overflow-y-auto flex flex-col gap-2">
            {loading ? (
              <div className="text-[10px] text-[#949494] py-2">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-[10px] text-[#949494] py-2">No history yet</div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="border border-[#222] p-3 bg-[#101010] group">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => handleLoad(entry)}
                      className="text-left text-[11px] text-[#e8e6e3] hover:text-[#00ff41] flex-1"
                    >
                      {entry.query}
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className={`text-[10px] min-h-[32px] min-w-[32px] flex items-center justify-center transition-all ${
                        confirmDeleteId === entry.id
                          ? "text-[#ff4444] font-bold"
                          : "text-[#949494] hover:text-[#ff4444] opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      }`}
                      aria-label={
                        confirmDeleteId === entry.id ? `Confirm delete ${entry.query}` : `Delete ${entry.query}`
                      }
                    >
                      {confirmDeleteId === entry.id ? "CONFIRM" : "×"}
                    </button>
                  </div>
                  <div className="text-[9px] text-[#949494] mt-1 flex flex-wrap gap-2">
                    <span>{entry.provider}</span>
                    <span>{entry.charCount.toLocaleString()} chars</span>
                    <span>{entry.resolveTime}ms</span>
                    <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {entry.profile && (
                      <span className="text-[9px] uppercase tracking-wide border border-[#333] px-2 py-1">
                        {entry.profile}
                      </span>
                    )}
                    {entry.flags?.deepResearch && (
                      <span className="text-[9px] border border-[#333] px-2 py-1">Deep research</span>
                    )}
                    {entry.flags?.skipCache && (
                      <span className="text-[9px] border border-[#333] px-2 py-1">Skip cache</span>
                    )}
                    {entry.providers?.slice(0, 3).map((provider) => (
                      <span key={`${entry.id}-${provider}`} className="text-[9px] border border-[#222] px-2 py-1 text-[#888]">
                        {provider}
                      </span>
                    ))}
                    {entry.providers && entry.providers.length > 3 && (
                      <span className="text-[9px] text-[#949494]">+{entry.providers.length - 3}</span>
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
