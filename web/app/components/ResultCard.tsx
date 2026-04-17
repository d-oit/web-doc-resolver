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
    <article className="border-2 border-[#222] bg-[#0c0c0c] p-4 flex flex-col gap-3" aria-labelledby={`result-${result.id}`}
    >
      <header className="flex flex-col gap-1">
        {result.url ? (
          <a
            id={`result-${result.id}`}
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="text-[#00ff41] text-[15px] hover:underline focus-visible:outline-2 focus-visible:outline-[#00ff41] focus-visible:outline-offset-2 focus:outline-none"
          >
            {result.title}
          </a>
        ) : (
          <h3 id={`result-${result.id}`} className="text-[15px] text-[#e8e6e3]">
            {result.title}
          </h3>
        )}
        {result.normalizedUrl && (
          <div className="text-[10px] text-[#666] break-all">{result.normalizedUrl}</div>
        )}
        <div className="text-[10px] text-[#666] flex gap-3 flex-wrap">
          {result.author && <span>By {result.author}</span>}
          {result.published && <span>{result.published}</span>}
        </div>
      </header>
      <p className="text-[12px] text-[#cfcfcf] whitespace-pre-wrap leading-relaxed">{result.snippet}</p>
      <footer className="flex flex-wrap gap-2 text-[11px]">
        <button
          onClick={handleCopy}
          className="px-3 py-2 border-2 border-[#333] hover:border-[#00ff41] focus-visible:outline-2 focus-visible:outline-[#00ff41] focus-visible:outline-offset-2 focus:outline-none"
        >
          {copying ? "Copied" : "Copy markdown"}
        </button>
        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${result.title} in new tab`}
            className="px-3 py-2 border-2 border-[#333] hover:border-[#00ff41] focus-visible:outline-2 focus-visible:outline-[#00ff41] focus-visible:outline-offset-2 focus:outline-none"
          >
            Open
          </a>
        )}
        {onHelpfulToggle && (
          <button
            onClick={() => onHelpfulToggle(result.id)}
            className={`px-3 py-2 border-2 ${
              helpful ? "border-[#00ff41] text-[#00ff41]" : "border-[#333] text-[#888]"
            } focus-visible:outline-2 focus-visible:outline-[#00ff41] focus-visible:outline-offset-2 focus:outline-none`}
            aria-pressed={helpful}
          >
            {helpful ? "Marked helpful" : "Mark helpful"}
          </button>
        )}
      </footer>
    </article>
  );
}
