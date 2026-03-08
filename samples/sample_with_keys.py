#!/usr/bin/env python3
"""
Example usage with all API keys configured.

This demonstrates the full cascade with enhanced features:
- Exa highlights for efficient search
- Tavily for comprehensive results
- Firecrawl for deep extraction (requires API key)
- Mistral as fallback
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

    # Example 1: Complex URL with Firecrawl
    print("Example 1: Deep extraction with Firecrawl...")
    print("-" * 60)
    if keys["FIRECRAWL_API_KEY"]:
        url = "https://docs.python.org/3/library/asyncio.html"
        result = resolve(url)
        print(f"Input: {url}")
        print(f"Result length: {len(result)} characters")
        print(f"Preview: {result[:300]}...")
    else:
        print("Skipped: FIRECRAWL_API_KEY not set")
        print("Set FIRECRAWL_API_KEY to enable deep extraction")
    print()

    # Example 2: Query with Exa highlights
    print("Example 2: Token-efficient search with Exa...")
    print("-" * 60)
    if keys["EXA_API_KEY"]:
        query = "latest machine learning research 2024"
        result = resolve(query)
        print(f"Input: {query}")
        print(f"Result length: {len(result)} characters")
        print(f"Preview: {result[:300]}...")
    else:
        print("Skipped: EXA_API_KEY not set (will use free fallback)")
        query = "latest machine learning research 2024"
        result = resolve(query)
        print(f"Using free fallback for: {query}")
        print(f"Result length: {len(result)} characters")
    print()

    # Example 3: Tavily comprehensive search
    print("Example 3: Comprehensive search with Tavily...")
    print("-" * 60)
    query = "rust async programming best practices"
    result = resolve(query)
    print(f"Input: {query}")
    print(f"Result length: {len(result)} characters")
    print(f"Preview: {result[:300]}...")
    print()

    print("=" * 60)
    print("All examples completed!")
    print("Note: Results vary based on which API keys are configured")
    print("=" * 60)


if __name__ == "__main__":
    main()
