"use client";

import Link from "next/link";

const faqs = [
  {
    q: "What is this?",
    a: "Fetch markdown from URLs. Tries 3 providers in sequence. Stops at first success.",
  },
  {
    q: "Do I need an API key?",
    a: "No. Jina, Exa MCP, and DuckDuckGo are free. Paid providers available with keys.",
  },
  {
    q: "How long does it take?",
    a: "2–10 seconds depending on the provider cascade and site response times.",
  },
  {
    q: "How does the configuration panel work?",
    a: "The sidebar is collapsible — click 'Configuration' to toggle. Profile determines which providers run. Provider buttons show which are active (green border = from profile, solid green = manually selected). API Keys are hidden by default — expand to add paid provider keys. All settings are saved locally in your browser.",
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-background text-foreground font-mono p-8">
      <div className="max-w-xl">
        <div className="mb-8">
          <Link href="/" className="text-[11px] uppercase tracking-[0.1em] text-text-muted hover:text-accent">
            ← Back
          </Link>
        </div>

        <h1 className="text-[24px] font-bold tracking-tight mb-2">Help</h1>
        <p className="text-[11px] text-text-muted mb-8">
          How the resolver works.
        </p>

        <section className="mb-8">
          <h2 className="text-[13px] font-bold mb-3 uppercase tracking-[0.05em]">For URLs</h2>
          <ol className="text-[13px] text-text-dim space-y-1 list-decimal list-inside">
            <li>llms.txt — structured docs (free)</li>
            <li>Jina — web-to-markdown (free)</li>
            <li>Firecrawl — deep extraction (key)</li>
            <li>Direct fetch — basic HTML (free)</li>
            <li>Mistral — browser (key)</li>
            <li>DuckDuckGo — search fallback (free)</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-[13px] font-bold mb-3 uppercase tracking-[0.05em]">For Queries</h2>
          <ol className="text-[13px] text-text-dim space-y-1 list-decimal list-inside">
            <li>Exa MCP — neural search (free)</li>
            <li>Exa SDK — neural search (key)</li>
            <li>Tavily — comprehensive (key)</li>
            <li>DuckDuckGo — search fallback (free)</li>
            <li>Mistral — generation (key)</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-[13px] font-bold mb-3 uppercase tracking-[0.05em]">Troubleshooting</h2>
          <div className="flex flex-col gap-3">
            <div className="p-3 border-2 border-border-muted">
              <p className="text-[13px] font-bold">Failed to fetch</p>
              <p className="text-[11px] text-text-muted mt-1">
                Backend not running or NEXT_PUBLIC_RESOLVER_URL misconfigured.
              </p>
            </div>
            <div className="p-3 border-2 border-border-muted">
              <p className="text-[13px] font-bold">Empty results</p>
              <p className="text-[11px] text-text-muted mt-1">
                Site blocks automated fetch. Try Firecrawl or Mistral key.
              </p>
            </div>
            <div className="p-3 border-2 border-border-muted">
              <p className="text-[13px] font-bold">Slow responses</p>
              <p className="text-[11px] text-text-muted mt-1">
                Cascade tries multiple providers. Add paid keys to skip fallbacks.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[13px] font-bold mb-3 uppercase tracking-[0.05em]">FAQ</h2>
          <div className="flex flex-col gap-3">
            {faqs.map((faq) => (
              <div key={faq.q} className="p-3 border-2 border-border-muted">
                <p className="text-[13px] font-bold">{faq.q}</p>
                <p className="text-[11px] text-text-muted mt-1">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
