"use client";

import { useState, useEffect } from "react";

export interface HistoryEntry {
  id: string;
  query: string;
  url: string | null;
  result: string;
  provider: string;
  timestamp: number;
  charCount: number;
  resolveTime: number;
}

interface HistoryProps {
  onLoad: (entry: HistoryEntry) => void;
}

export default function History({ onLoad }: HistoryProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // Silent fail
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
        className="w-full p-4 flex items-center justify-between hover:bg-[#141414] transition-colors text-[11px] text-[#666] min-h-[44px]"
        aria-expanded={isOpen}
        aria-controls="history-panel"
      >
        <span className="uppercase tracking-[0.1em]">History ({entries.length})</span>
        <span>{isOpen ? "▼" : "▶"}</span>
      </button>

      {isOpen && (
        <div id="history-panel" className="px-4 pb-4">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history..."
            className="w-full bg-[#141414] border-2 border-[#333] px-2 py-2 text-[11px] text-[#e8e6e3] placeholder:text-[#444] focus:border-[#00ff41] focus:outline-none mb-2 min-h-[44px]"
          />

          {/* List */}
          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="text-[10px] text-[#555] py-2">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-[10px] text-[#555] py-2">No history yet</div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-b border-[#222] py-2 flex items-start gap-2 group"
                >
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => handleLoad(entry)}
                      className="text-left text-[11px] text-[#e8e6e3] hover:text-[#00ff41] truncate block w-full"
                    >
                      {entry.query}
                    </button>
                    <div className="text-[9px] text-[#555] mt-1">
                      {entry.provider} · {entry.charCount.toLocaleString()} chars ·{" "}
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-[10px] text-[#444] hover:text-[#ff4444] opacity-0 group-hover:opacity-100 transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Delete ${entry.query}`}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}