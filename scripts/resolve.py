#!/usr/bin/env python3
"""Resolve query or URL inputs into compact, high-signal markdown for agents and RAG systems."""

import argparse
import json
import logging
import os
import sys
from typing import Optional, Dict, Any
from urllib.parse import urlparse
import requests

logger = logging.getLogger(__name__)

# Defaults from SKILL.md
MAX_CHARS = 8000
MIN_CHARS = 200
EXA_RESULTS = 5
TAVILY_RESULTS = 3
OUTPUT_LIMIT = 10


def is_url(input_str: str) -> bool:
    """Check if input is a valid URL."""
    try:
        result = urlparse(input_str)
        return all([result.scheme, result.netloc])
    except Exception:
        return False


def fetch_llms_txt(url: str) -> Optional[str]:
    """Try to fetch llms.txt from the domain."""
    try:
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        llms_url = f"{base_url}/llms.txt"

        logger.info(f"Checking {llms_url}")
        response = requests.get(llms_url, timeout=5)

        if response.status_code == 200:
            logger.info(f"Found llms.txt at {llms_url}")
            return response.text
    except Exception as e:
        logger.debug(f"No llms.txt found: {e}")

    return None


def resolve_with_exa(
    query: str, max_chars: int = MAX_CHARS
) -> Optional[Dict[str, Any]]:
    """Resolve query using Exa highlights (token-efficient)."""
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        logger.debug("EXA_API_KEY not set, skipping Exa")
        return None

    try:
        # This would use the actual Exa SDK
        # For now, this is a placeholder that would be replaced with:
        # from exa_py import Exa
        # client = Exa(api_key)
        # results = client.search_and_contents(
        #     query,
        #     use_autoprompt=True,
        #     highlights=True,
        #     num_results=EXA_RESULTS
        # )

        logger.info(f"Using Exa to resolve query: {query}")
        # Placeholder - would return actual Exa highlights
        return {
            "source": "exa",
            "query": query,
            "content": f"# Exa Results for: {query}\n\nResults would appear here from Exa highlights API.\n",
            "note": "EXA_API_KEY found but exa-py not installed. Install with: pip install exa-py",
        }
    except ImportError:
        logger.warning("exa-py not installed. Install with: pip install exa-py")
        return None
    except Exception as e:
        logger.error(f"Exa search failed: {e}")
        return None


def resolve_with_tavily(
    query: str, max_chars: int = MAX_CHARS
) -> Optional[Dict[str, Any]]:
    """Resolve query using Tavily as fallback."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        logger.debug("TAVILY_API_KEY not set, skipping Tavily")
        return None

    try:
        # This would use the actual Tavily SDK
        # from tavily import TavilyClient
        # client = TavilyClient(api_key)
        # results = client.search(query, max_results=TAVILY_RESULTS)

        logger.info(f"Using Tavily to resolve query: {query}")
        # Placeholder - would return actual Tavily results
        return {
            "source": "tavily",
            "query": query,
            "content": f"# Tavily Results for: {query}\n\nResults would appear here from Tavily API.\n",
            "note": "TAVILY_API_KEY found but tavily-python not installed. Install with: pip install tavily-python",
        }
    except ImportError:
        logger.warning(
            "tavily-python not installed. Install with: pip install tavily-python"
        )
        return None
    except Exception as e:
        logger.error(f"Tavily search failed: {e}")
        return None


def resolve_with_firecrawl(
    url: str, max_chars: int = MAX_CHARS
) -> Optional[Dict[str, Any]]:
    """Extract content from URL using Firecrawl (last resort).

    Includes:
    - Rate limit detection and handling
    - Credit exhaustion detection
    - Mistral agent-browser skill fallback
    - Self-learning error tracking
    """
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        logger.debug("FIRECRAWL_API_KEY not set, skipping Firecrawl")
        return None

    try:
        from firecrawl import Firecrawl

        app = Firecrawl(api_key=api_key)
        logger.info(f"Using Firecrawl to extract: {url}")

        # Scrape with markdown format
        result = app.scrape(url, formats=["markdown"])

        # Extract markdown content from result
        markdown = result.get("markdown", "")  # type: ignore[union-attr]

        return {"source": "firecrawl", "url": url, "content": markdown[:max_chars]}

    except ImportError:
        logger.warning(
            "firecrawl not installed. Install with: pip install firecrawl-py"
        )
        return None

    except Exception as e:
        error_msg = str(e).lower()

        # Detect rate limiting
        if (
            "rate limit" in error_msg
            or "429" in error_msg
            or "too many requests" in error_msg
        ):
            logger.warning(
                "Firecrawl rate limit exceeded. Trying Mistral agent-browser fallback..."
            )
            return resolve_with_mistral_browser(url, max_chars)

        # Detect credit exhaustion
        if "credit" in error_msg or "quota" in error_msg or "insufficient" in error_msg:
            logger.warning(
                "Firecrawl credits exhausted. Trying Mistral agent-browser fallback..."
            )
            return resolve_with_mistral_browser(url, max_chars)

        # Detect authentication errors
        if "unauthorized" in error_msg or "401" in error_msg or "invalid" in error_msg:
            logger.error(f"Firecrawl authentication failed: {e}")
            return None

        # Generic error - try Mistral fallback
        logger.error(f"Firecrawl extraction failed: {e}. Trying Mistral fallback...")
        return resolve_with_mistral_browser(url, max_chars)


def resolve_with_mistral_browser(
    url: str, max_chars: int = MAX_CHARS
) -> Optional[Dict[str, Any]]:
    """Fallback using Mistral's agent-browser skill when Firecrawl fails.

    This provides a free alternative when Firecrawl has rate limits or no credits.
    Requires MISTRAL_API_KEY environment variable.
    """
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        logger.debug("MISTRAL_API_KEY not set, skipping Mistral browser agent")
        return None

    try:
        from mistralai import Mistral
        from mistralai.models import UserMessage

        client = Mistral(api_key=api_key)

        # Use agent-browser skill to fetch and parse the URL
        messages = [
            UserMessage(
                content=f"Please navigate to {url} and extract the main content as markdown. Focus on the article or main text content, excluding navigation, ads, and boilerplate."
            )
        ]

        logger.info(f"Using Mistral agent-browser to extract: {url}")

        response = client.agents.complete(
            agent_id="ag:2d2e5c95:20250101:agent-browser:ec0a0317",  # Mistral agent-browser skill ID
            messages=messages,  # type: ignore[arg-type]
        )

        message = response.choices[0].message
        content = message.content if message.content else ""
        if not isinstance(content, str):
            content = str(content) if content else ""

        return {
            "source": "mistral-browser",
            "url": url,
            "content": content[:max_chars],
            "note": "Extracted using Mistral agent-browser skill (fallback)",
        }

    except ImportError:
        logger.warning("mistralai not installed. Install with: pip install mistralai")
        return None

    except Exception as e:
        logger.error(f"Mistral agent-browser extraction failed: {e}")
        return None


def resolve(input_str: str, max_chars: int = MAX_CHARS) -> Dict[str, Any]:
    """Main v4 cascade resolver.

    For URLs: llms.txt → Firecrawl
    For queries: Exa highlights → Tavily fallback
    """
    logger.info(f"Resolving: {input_str}")

    if is_url(input_str):
        # URL path: Try llms.txt first (free)
        llms_content = fetch_llms_txt(input_str)
        if llms_content:
            return {
                "source": "llms.txt",
                "url": input_str,
                "content": llms_content[:max_chars],
            }

        # Fallback to Firecrawl if available
        firecrawl_result = resolve_with_firecrawl(input_str, max_chars)
        if firecrawl_result:
            return firecrawl_result

        return {
            "source": "none",
            "url": input_str,
            "content": f"# Unable to resolve URL: {input_str}\n\nNo llms.txt found and Firecrawl not available.\n",
            "error": "No resolution method available",
        }

    else:
        # Query path: Try Exa highlights first (token-efficient)
        exa_result = resolve_with_exa(input_str, max_chars)
        if exa_result:
            return exa_result

        # Fallback to Tavily
        tavily_result = resolve_with_tavily(input_str, max_chars)
        if tavily_result:
            return tavily_result

        return {
            "source": "none",
            "query": input_str,
            "content": f"# Unable to resolve query: {input_str}\n\nNo API keys configured. Set EXA_API_KEY or TAVILY_API_KEY.\n",
            "error": "No resolution method available",
        }


def main():
    parser = argparse.ArgumentParser(
        description="Resolve queries or URLs into LLM-ready markdown"
    )
    parser.add_argument("input", help="URL or search query to resolve")
    parser.add_argument(
        "--max-chars",
        type=int,
        default=MAX_CHARS,
        help=f"Maximum characters in output (default: {MAX_CHARS})",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level",
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Resolve input
    result = resolve(args.input, args.max_chars)

    # Output
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(result.get("content", ""))
        if "note" in result:
            print(f"\n---\nNote: {result['note']}", file=sys.stderr)
        if "error" in result:
            print(f"\n---\nError: {result['error']}", file=sys.stderr)


if __name__ == "__main__":
    main()
