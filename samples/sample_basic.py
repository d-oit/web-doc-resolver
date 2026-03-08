#!/usr/bin/env python3
"""
Basic usage example without API keys.

This demonstrates using web-doc-resolver with free sources only:
- llms.txt checks
- Free fallbacks
- No API keys required
"""

from scripts.resolve import resolve


def main():
    print("=" * 60)
    print("web-doc-resolver: Basic Usage (No API Keys)")
    print("=" * 60)
    print()

    # Example 1: Resolve a URL
    print("Example 1: Resolving a URL...")
    print("-" * 60)
    url = "https://example.com"
    result = resolve(url)
    print(f"Input: {url}")
    print(f"Result length: {len(result)} characters")
    print(f"Preview: {result[:200]}...")
    print()

    # Example 2: Resolve a query
    print("Example 2: Resolving a query...")
    print("-" * 60)
    query = "latest AI research papers"
    result = resolve(query)
    print(f"Input: {query}")
    print(f"Result length: {len(result)} characters")
    print(f"Preview: {result[:200]}...")
    print()

    # Example 3: Another URL example
    print("Example 3: Resolving another URL...")
    print("-" * 60)
    url2 = "https://github.com"
    result = resolve(url2)
    print(f"Input: {url2}")
    print(f"Result length: {len(result)} characters")
    print(f"Preview: {result[:200]}...")
    print()

    print("=" * 60)
    print("All examples completed successfully!")
    print("Note: These results use only free sources (llms.txt, fallbacks)")
    print("=" * 60)


if __name__ == "__main__":
    main()
