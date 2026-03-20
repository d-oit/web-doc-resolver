"use client";

import Link from "next/link";

const faqs = [
  {
    q: "What is Web Doc Resolver?",
    a: "It is a tool that turns any URL or search query into clean, compact markdown optimized for LLM consumption.",
  },
  {
    q: "Do I need an API key?",
    a: "No. The default cascade uses free providers (llms.txt, DuckDuckGo, Jina Reader, direct fetch). Optional providers like Exa, Tavily, Firecrawl, and Mistral are unlocked with API keys.",
  },
  {
    q: "What input formats are supported?",
    a: "Enter any full URL (e.g. https://docs.python.org) or a natural-language search query (e.g. python async best practices).",
  },
  {
    q: "How long does resolution take?",
    a: "Most results return in 2–10 seconds depending on the provider cascade and site response times.",
  },
  {
    q: "Can I use the resolver programmatically?",
    a: "Yes. POST to /resolve with a JSON body { \"query\": \"...\" }. See the project README for the full API.",
  },
];

export default function HelpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8 sm:p-16">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to resolver
          </Link>
        </div>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Help & FAQ
        </h1>
        <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
          Everything you need to know about Web Doc Resolver.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">How to use</h2>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-neutral-700 dark:text-neutral-300">
            <li>Type a URL or search query into the input field.</li>
            <li>Click <strong>Resolve</strong> (or press Enter).</li>
            <li>The resolver runs through a cascade of providers to fetch the best possible content.</li>
            <li>Clean markdown appears in the result box. Copy it for your workflow.</li>
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Supported inputs</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-neutral-700 dark:text-neutral-300">
            <li>
              <strong>URLs</strong> — any public web page, e.g.{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
                https://docs.python.org
              </code>
            </li>
            <li>
              <strong>Search queries</strong> — natural language questions or keywords, e.g.{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
                python async best practices
              </code>
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">How the cascade works</h2>
          <p className="mt-3 text-neutral-700 dark:text-neutral-300">
            The resolver tries providers in order, stopping as soon as one returns a good result. Free providers run first.
          </p>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="font-medium">For URLs</h3>
              <ol className="mt-2 list-inside list-decimal text-sm text-neutral-600 dark:text-neutral-400">
                <li>llms.txt — structured docs file (free)</li>
                <li>Jina Reader — web-to-markdown (free)</li>
                <li>Firecrawl — deep extraction (requires API key)</li>
                <li>Direct fetch — basic HTML extraction (free)</li>
                <li>Mistral browser — AI-powered (requires API key)</li>
                <li>DuckDuckGo — search-based fallback (free)</li>
              </ol>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="font-medium">For queries</h3>
              <ol className="mt-2 list-inside list-decimal text-sm text-neutral-600 dark:text-neutral-400">
                <li>Exa MCP — neural search (free)</li>
                <li>Exa SDK — neural search (requires API key)</li>
                <li>Tavily — comprehensive search (requires API key)</li>
                <li>DuckDuckGo — search fallback (free)</li>
                <li>Mistral — AI generation fallback (requires API key)</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Result format</h2>
          <p className="mt-3 text-neutral-700 dark:text-neutral-300">
            Results are returned as plain markdown. The content is cleaned, deduplicated, and trimmed to fit within LLM
            context windows. Use it directly in prompts, documentation, or notes.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Troubleshooting</h2>
          <div className="mt-3 space-y-3 text-neutral-700 dark:text-neutral-300">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="font-medium">Error: &ldquo;Failed to fetch&rdquo;</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                The backend resolver is not running or not reachable. Make sure the resolver server is started and
                the <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-800">NEXT_PUBLIC_RESOLVER_URL</code> environment
                variable points to it.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="font-medium">Empty or partial results</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Some sites block automated fetching. Try a different URL or add an API key for Firecrawl / Mistral to
                improve coverage.
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="font-medium">Slow responses</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                The cascade may try several providers before finding a result. Add optional API keys to skip slower
                fallback providers.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">FAQ</h2>
          <div className="mt-4 space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <p className="font-medium">{faq.q}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 border-t border-neutral-200 pt-6 text-center dark:border-neutral-800">
          <Link
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to resolver
          </Link>
        </div>
      </div>
    </main>
  );
}
