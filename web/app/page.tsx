"use client";

import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResult("");

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_RESOLVER_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        throw new Error(`Resolver returned ${res.status}`);
      }

      const data = await res.json();
      setResult(data.markdown || data.result || JSON.stringify(data, null, 2));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resolve query"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 sm:p-16">
      <nav className="w-full max-w-2xl flex items-center justify-between mb-8">
        <Link href="/" className="text-lg font-semibold">
          Web Doc Resolver
        </Link>
        <Link
          href="/help"
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          Help
        </Link>
      </nav>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Web Doc Resolver
          </h1>
          <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
            Resolve queries and URLs into compact, LLM-ready markdown
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a URL or query..."
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Resolving..." : "Resolve"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <pre className="whitespace-pre-wrap font-mono text-sm text-neutral-800 dark:text-neutral-200">
                {result}
              </pre>
            </div>
          </div>
        )}

        <div className="mt-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
          <p>
            Try a URL like{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
              https://docs.python.org
            </code>{" "}
            or a query like{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
              python async best practices
            </code>
          </p>
        </div>
      </div>
    </main>
  );
}