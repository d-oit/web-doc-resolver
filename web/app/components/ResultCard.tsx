"use client";

import { useState } from "react";
import type { ProviderResult } from "@/lib/results";

interface ResultCardProps {
  result: ProviderResult;
  onCopy: (value: string) => Promise<void> | void;
  onHelpfulToggle?: (id: string) => void;
  helpful?: boolean;
}

export default function ResultCard({ result, onCopy, onHelpfulToggle, helpful }: ResultCardProps) {
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    setCopying(true);
    await onCopy(result.raw);
    setTimeout(() => setCopying(false), 1000);
  };

  return (
    <article className="border-2 border-border-muted bg-background p-4 flex flex-col gap-3" aria-labelledby={`result-${result.id}`}
    >
      <header className="flex flex-col gap-1">
        {result.url ? (
          <a
            id={`result-${result.id}`}
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="text-accent text-[15px] hover:underline"
          >
            {result.title}
          </a>
        ) : (
          <h3 id={`result-${result.id}`} className="text-[15px] text-foreground">
            {result.title}
          </h3>
        )}
        {result.normalizedUrl && (
          <div className="text-[10px] text-text-dim break-all">{result.normalizedUrl}</div>
        )}
        <div className="text-[10px] text-text-dim flex gap-3 flex-wrap">
          {result.author && <span>By {result.author}</span>}
          {result.published && <span>{result.published}</span>}
        </div>
      </header>
      <p className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">{result.snippet}</p>
      <footer className="flex flex-wrap gap-2 text-[11px]">
        <button
          onClick={handleCopy}
          className="px-3 py-2 border-2 border-border-muted hover:border-accent text-text-muted"
        >
          {copying ? "Copied" : "Copy markdown"}
        </button>
        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 border-2 border-border-muted hover:border-accent text-text-muted"
          >
            Open
          </a>
        )}
        {onHelpfulToggle && (
          <button
            onClick={() => onHelpfulToggle(result.id)}
            className={`px-3 py-2 border-2 ${
              helpful ? "border-accent text-accent" : "border-border-muted text-text-dim"
            }`}
            aria-pressed={helpful}
          >
            {helpful ? "Marked helpful" : "Mark helpful"}
          </button>
        )}
      </footer>
    </article>
  );
}
