#!/usr/bin/env python3
"""
Example usage with all API keys configured.

This demonstrates the full cascade with enhanced features:
- Exa MCP (free, no API key required) - primary search
- Exa SDK (if EXA_API_KEY set) - enhanced search
- Tavily (if TAVILY_API_KEY set) - comprehensive results
- DuckDuckGo (free fallback)
- Firecrawl (if FIRECRAWL_API_KEY set) - deep URL extraction
- Mistral (if MISTRAL_API_KEY set) - AI-powered fallback
"""

import os

from scripts.resolve import resolve


def main():
    print("=" * 60)
    print("web-doc-resolver: Full Cascade with API Keys")
    print("=" * 60)
    print()

    # Check which API keys are set
    print("Configured API Keys:")
    print("-" * 60)
    keys = {
        "EXA_API_KEY": os.getenv("EXA_API_KEY"),
        "TAVILY_API_KEY": os.getenv("TAVILY_API_KEY"),
        "FIRECRAWL_API_KEY": os.getenv("FIRECRAWL_API_KEY"),
        "MISTRAL_API_KEY": os.getenv("MISTRAL_API_KEY"),
    }

    for key_name, key_value in keys.items():
        status = "✓ Set" if key_value else "✗ Not set"
        print(f"{key_name}: {status}")
    print()

    print("Cascade Order (Query):")
    print("  1. Exa MCP (free, no API key)")
    print("  2. Exa SDK (if EXA_API_KEY set)")
    print("  3. Tavily (if TAVILY_API_KEY set)")
    print("  4. DuckDuckGo (free fallback)")
    print("  5. Mistral (if MISTRAL_API_KEY set)")
    print()

    print("Cascade Order (URL):")
    print("  1. llms.txt check (free)")
    print("  2. Firecrawl (if FIRECRAWL_API_KEY set)")
    print("  3. Direct HTTP fetch (free)")
    print("  4. Mistral browser (if MISTRAL_API_KEY set)")
    print("  5. DuckDuckGo search (free fallback)")
    print()

    # Example 1: Query with full cascade
    print("Example 1: Query resolution with full cascade...")
    print("-" * 60)
    query = "latest machine learning research 2024"
    result = resolve(query)
    print(f"Input: {query}")
    print(f"Source: {result.get('source', 'unknown')}")
    print(f"Result length: {len(result.get('content', ''))} characters")
    print(f"Preview: {result.get('content', '')[:300]}...")
    print()

    # Example 2: URL with llms.txt check first
    print("Example 2: URL resolution (llms.txt first)...")
    print("-" * 60)
    if keys["FIRECRAWL_API_KEY"]:
        url = "https://docs.python.org/3/library/asyncio.html"
        result = resolve(url)
        print(f"Input: {url}")
        print(f"Source: {result.get('source', 'unknown')}")
        print(f"Result length: {len(result.get('content', ''))} characters")
        print(f"Preview: {result.get('content', '')[:300]}...")
    else:
        print("Skipped: FIRECRAWL_API_KEY not set")
        print("Set FIRECRAWL_API_KEY to enable deep extraction")
        print("Note: llms.txt and direct fetch still work without API keys")
    print()

    # Example 3: Skip providers to test specific fallbacks
    print("Example 3: Test specific providers by skipping others...")
    print("-" * 60)
    query = "rust async programming best practices"
    print("Testing: Skip Exa MCP and Exa SDK to use Tavily/DuckDuckGo")
    result = resolve(query, skip_providers={"exa_mcp", "exa"})
    print(f"Input: {query}")
    print("Skipped: exa_mcp, exa")
    print(f"Source: {result.get('source', 'unknown')}")
    print(f"Result length: {len(result.get('content', ''))} characters")
    print()

    # Example 4: Use only free providers
    print("Example 4: Use only free providers...")
    print("-" * 60)
    query = "web scraping best practices"
    result = resolve(query, skip_providers={"exa", "tavily", "mistral"})
    print(f"Input: {query}")
    print("Skipped: exa, tavily, mistral (using only free providers)")
    print(f"Source: {result.get('source', 'unknown')}")
    print(f"Result length: {len(result.get('content', ''))} characters")
    print()

    print("=" * 60)
    print("All examples completed!")
    print("Note: Results vary based on which API keys are configured")
    print("      Free providers (Exa MCP, DuckDuckGo) always work")
    print("=" * 60)


if __name__ == "__main__":
    main()
