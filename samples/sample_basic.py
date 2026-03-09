#!/usr/bin/env python3
"""
Basic usage example without API keys.

This demonstrates using web-doc-resolver with free sources only:
- llms.txt checks for URLs
- Exa MCP for queries (free, no API key required)
- DuckDuckGo as fallback
- No API keys required
"""

from scripts.resolve import resolve


def main():
    print("=" * 60)
    print("web-doc-resolver: Basic Usage (No API Keys)")
    print("=" * 60)
    print()
    print("Free providers used:")
    print("  - Exa MCP (free search, no API key)")
    print("  - llms.txt (free URL documentation)")
    print("  - DuckDuckGo (free fallback)")
    print()

    # Example 1: Resolve a URL (checks llms.txt first)
    print("Example 1: Resolving a URL...")
    print("-" * 60)
    url = "https://example.com"
    result = resolve(url)
    print(f"Input: {url}")
    print(f"Source: {result.get('source', 'unknown')}")
    print(f"Result length: {len(result.get('content', ''))} characters")
    print(f"Preview: {result.get('content', '')[:200]}...")
    print()

    # Example 2: Resolve a query (uses Exa MCP - free!)
    print("Example 2: Resolving a query...")
    print("-" * 60)
    query = "latest AI research papers"
    result = resolve(query)
    print(f"Input: {query}")
    print(f"Source: {result.get('source', 'unknown')}")
    print(f"Result length: {len(result.get('content', ''))} characters")
    print(f"Preview: {result.get('content', '')[:200]}...")
    print()

    # Example 3: Another URL example
    print("Example 3: Resolving another URL...")
    print("-" * 60)
    url2 = "https://github.com"
    result = resolve(url2)
    print(f"Input: {url2}")
    print(f"Source: {result.get('source', 'unknown')}")
    print(f"Result length: {len(result.get('content', ''))} characters")
    print(f"Preview: {result.get('content', '')[:200]}...")
    print()

    # Example 4: Skip providers to test fallbacks
    print("Example 4: Skip Exa MCP to test fallbacks...")
    print("-" * 60)
    query = "Python async programming"
    result = resolve(query, skip_providers={"exa_mcp"})
    print(f"Input: {query}")
    print("Skipped: exa_mcp")
    print(f"Source: {result.get('source', 'unknown')}")
    print(f"Result length: {len(result.get('content', ''))} characters")
    print()

    print("=" * 60)
    print("All examples completed successfully!")
    print("Note: These results use only free sources")
    print("  - Exa MCP (free, no API key)")
    print("  - DuckDuckGo (free fallback)")
    print("=" * 60)


if __name__ == "__main__":
    main()
