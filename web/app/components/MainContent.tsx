"use client";

import { RefObject } from "react";
import Link from "next/link";
import ResultCard from "./ResultCard";
import { ProviderResult } from "@/lib/results";

interface MainContentProps {
  query: string;
  setQuery: (query: string) => void;
  handleSubmit: () => void;
  loading: boolean;
  result: string;
  error: string;
  providerStatus: string | null;
  sourceProvider: string | null;
  resolveTime: number | null;
  qualityScore: number | null;
  parsedResults: ProviderResult[];
  viewRaw: boolean;
  setViewRaw: (raw: boolean) => void;
  handleCopyResult: () => void;
  copied: boolean;
  helpfulIds: Set<string>;
  toggleHelpful: (id: string) => void;
  handleCardCopy: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  setMobileMenuOpen: (open: boolean) => void;
  clearAll: () => void;
}

export default function MainContent({
  query,
  setQuery,
  handleSubmit,
  loading,
  result,
  error,
  providerStatus,
  sourceProvider,
  resolveTime,
  qualityScore,
  parsedResults,
  viewRaw,
  setViewRaw,
  handleCopyResult,
  copied,
  helpfulIds,
  toggleHelpful,
  handleCardCopy,
  inputRef,
  setMobileMenuOpen,
  clearAll,
}: MainContentProps) {
  const charCount = result.length;
  const isUrl = query.trim().startsWith("http");

  return (
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
            className="flex-1 bg-transparent text-[20px] sm:text-[24px] text-foreground placeholder:text-text-dim tracking-tight"
          />
          {query.trim() && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSubmit()}
                disabled={loading}
                aria-label={loading ? "Fetching results..." : "Fetch results"}
                className="bg-accent text-background px-4 py-2 text-[13px] font-bold hover:bg-[#00cc33] disabled:opacity-50 min-w-[60px] min-h-[44px]"
              >
                {loading ? "..." : "Fetch"}
              </button>
              <button
                onClick={clearAll}
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
                className="flex-1 bg-[#141414] p-4 text-[13px] text-foreground font-mono resize-none whitespace-pre-wrap overflow-auto min-h-[200px]"
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
  );
}