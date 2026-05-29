"""
Individual provider implementations for the Web Doc Resolver.
"""

import json
import logging
import os
import subprocess
import threading
import time

from scripts.constants import (
    DDG_RESULTS,
    DEFAULT_TIMEOUT,
    EXA_RESULTS,
    MAX_CHARS,
    MIN_CHARS,
    TAVILY_RESULTS,
)
from scripts.models import ResolvedResult
from scripts.utils import (
    _get_from_cache,
    _save_to_cache,
    get_session,
    is_safe_url,
)

logger = logging.getLogger(__name__)

_rate_limits: dict[str, float] = {}
_rate_limits_lock = threading.Lock()


def _is_rate_limited(provider: str) -> bool:
    with _rate_limits_lock:
        if provider in _rate_limits:
            if time.time() < _rate_limits[provider]:
                return True
            del _rate_limits[provider]
    return False


def _set_rate_limit(provider: str, cooldown: int = 60):
    with _rate_limits_lock:
        _rate_limits[provider] = time.time() + cooldown


def _clear_rate_limits() -> None:
    with _rate_limits_lock:
        _rate_limits.clear()


# Exported names for both internal use and tests
is_rate_limited = _is_rate_limited
set_rate_limit = _set_rate_limit


def resolve_with_jina(url: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    if not is_safe_url(url):
        logger.warning("SSRF blocked: %s", url)
        return None
    cached = _get_from_cache(url, "jina")
    if cached:
        return ResolvedResult(**cached)
    if _is_rate_limited("jina"):
        return None
    try:
        session = get_session()
        response = session.get(
            f"https://r.jina.ai/{url}",
            timeout=DEFAULT_TIMEOUT,
            headers={"Accept": "text/markdown"},
        )
        if response.status_code == 429:
            logger.warning("Jina rate limited — setting cooldown")
            _set_rate_limit("jina")
            return None
        if response.status_code == 401 or response.status_code == 403:
            logger.warning("Jina auth error: HTTP %s for %s", response.status_code, url)
            return None
        if response.status_code != 200:
            logger.warning("Jina HTTP %s for %s", response.status_code, url)
            return None
        content = response.text.strip()
        if len(content) < MIN_CHARS:
            logger.warning(
                "Jina returned insufficient content (%s chars) for %s", len(content), url
            )
            return None
        result = ResolvedResult(source="jina", content=content[:max_chars], url=url)
        _save_to_cache(url, "jina", result.to_dict())
        return result
    except Exception as e:
        logger.warning("Jina resolution failed: %s: %s", type(e).__name__, e)
        return None


def resolve_with_exa_mcp(query: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    cached = _get_from_cache(query, "exa_mcp")
    if cached:
        return ResolvedResult(**cached)
    if _is_rate_limited("exa_mcp"):
        return None
    try:
        mcp_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": "web_search_exa", "arguments": {"query": query, "numResults": 8}},
        }
        session = get_session()
        response = session.post(
            "https://mcp.exa.ai/mcp",
            json=mcp_request,
            headers={"Accept": "application/json, text/event-stream"},
            timeout=25,
        )
        if response.status_code != 200:
            logger.warning("Exa MCP HTTP %s for query: %s", response.status_code, query)
            return None
        for line in response.text.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                if data.get("result") and data["result"].get("content"):
                    content = data["result"]["content"][0].get("text", "")
                    if not content:
                        logger.warning("Exa MCP returned empty content for query: %s", query)
                        return None
                    result = ResolvedResult(
                        source="exa_mcp", content=content[:max_chars], query=query
                    )
                    _save_to_cache(query, "exa_mcp", result.to_dict())
                    return result
        logger.warning("Exa MCP returned no usable content for query: %s", query)
    except json.JSONDecodeError as e:
        logger.warning("Exa MCP JSON parse failed: %s", e)
    except Exception as e:
        logger.warning("Exa MCP resolution failed: %s: %s", type(e).__name__, e)
    return None


def resolve_with_exa(query: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    cached = _get_from_cache(query, "exa")
    if cached:
        return ResolvedResult(**cached)
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        logger.debug("Exa skipped: no API key")
        return None
    if _is_rate_limited("exa"):
        logger.debug("Exa skipped: rate limited")
        return None
    try:
        from exa_py import Exa

        client = Exa(api_key)
        res = client.search_and_contents(
            query, use_autoprompt=True, highlights=True, num_results=EXA_RESULTS
        )
        if not res or not res.results:
            logger.warning("Exa returned no results for query: %s", query)
            return None
        content = "\n\n---\n\n".join(
            [
                r.highlight or r.text
                for r in res.results
                if hasattr(r, "highlight") and r.highlight or hasattr(r, "text") and r.text
            ]
        )
        if not content:
            logger.warning("Exa returned empty content for query: %s", query)
            return None
        result = ResolvedResult(source="exa", content=content[:max_chars], query=query)
        _save_to_cache(query, "exa", result.to_dict())
        return result
    except Exception as e:
        status = getattr(e, "status_code", None)
        if status == 401:
            logger.warning("Exa failed: 401 Unauthorized — API key may be invalid or expired")
        elif status == 429:
            logger.warning("Exa failed: 429 Rate limited — setting cooldown")
            _set_rate_limit("exa")
        elif status == 403:
            logger.warning("Exa failed: 403 Forbidden — %s", e)
        else:
            logger.warning("Exa resolution failed: %s: %s", type(e).__name__, e)
        return None


def resolve_with_tavily(query: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    cached = _get_from_cache(query, "tavily")
    if cached:
        return ResolvedResult(**cached)
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        logger.debug("Tavily skipped: no API key")
        return None
    if _is_rate_limited("tavily"):
        logger.debug("Tavily skipped: rate limited")
        return None
    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=api_key)
        res = client.search(query, max_results=TAVILY_RESULTS)
        if not res or not res.get("results"):
            logger.warning("Tavily returned no results for query: %s", query)
            return None
        content = "\n\n---\n\n".join([f"## {r['title']}\n\n{r['content']}" for r in res["results"]])
        result = ResolvedResult(source="tavily", content=content[:max_chars], query=query)
        _save_to_cache(query, "tavily", result.to_dict())
        return result
    except Exception as e:
        status = getattr(e, "status_code", None)
        if status == 401:
            logger.warning("Tavily failed: 401 Unauthorized — API key may be invalid or expired")
        elif status == 429:
            logger.warning("Tavily failed: 429 Rate limited — setting cooldown")
            _set_rate_limit("tavily")
        elif status == 403:
            logger.warning("Tavily failed: 403 Forbidden — %s", e)
        else:
            logger.warning("Tavily resolution failed: %s: %s", type(e).__name__, e)
        return None


def resolve_with_serper(query: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    """Search via Serper (Google Search API). Free tier: 2500 credits."""
    cached = _get_from_cache(query, "serper")
    if cached:
        return ResolvedResult(**cached)
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        logger.debug("Serper skipped: no API key")
        return None
    if _is_rate_limited("serper"):
        logger.debug("Serper skipped: rate limited")
        return None
    try:
        session = get_session()
        response = session.post(
            "https://google.serper.dev/search",
            headers={
                "X-API-KEY": api_key,
                "Content-Type": "application/json",
            },
            json={"q": query, "num": 5},
            timeout=DEFAULT_TIMEOUT,
        )
        if response.status_code == 429:
            logger.warning("Serper rate limited — setting 1hr cooldown")
            _set_rate_limit("serper", 3600)
            return None
        if response.status_code == 401 or response.status_code == 403:
            logger.warning(
                "Serper auth error: HTTP %s — API key may be invalid", response.status_code
            )
            return None
        if response.status_code != 200:
            logger.warning("Serper HTTP %s for query: %s", response.status_code, query)
            return None
        data = response.json()
        organic = data.get("organic", [])
        if not organic:
            logger.warning("Serper returned no organic results for query: %s", query)
            return None
        parts = []
        for r in organic:
            title = r.get("title", "")
            link = r.get("link", "")
            snippet = r.get("snippet", "")
            if title and snippet:
                parts.append(f"## {title}\n\n{snippet}\n\n[{link}]({link})")
        if not parts:
            logger.warning("Serper returned no usable snippets for query: %s", query)
            return None
        content = "\n\n---\n\n".join(parts)
        result = ResolvedResult(source="serper", content=content[:max_chars], query=query)
        _save_to_cache(query, "serper", result.to_dict())
        return result
    except Exception as e:
        logger.warning("Serper resolution failed: %s: %s", type(e).__name__, e)
        return None


def resolve_with_duckduckgo(query: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    cached = _get_from_cache(query, "duckduckgo")
    if cached:
        return ResolvedResult(**cached)
    if _is_rate_limited("duckduckgo"):
        logger.debug("DuckDuckGo skipped: rate limited")
        return None
    try:
        from ddgs import DDGS

        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=DDG_RESULTS))
        if not results:
            logger.warning("DuckDuckGo returned no results for query: %s", query)
            return None
        content = "\n\n---\n\n".join(
            [f"## {r.get('title', '')}\n\n{r.get('body', '')}" for r in results]
        )
        result = ResolvedResult(source="duckduckgo", content=content[:max_chars], query=query)
        _save_to_cache(query, "duckduckgo", result.to_dict())
        return result
    except Exception as e:
        logger.warning("DuckDuckGo resolution failed: %s: %s", type(e).__name__, e)
        return None


def resolve_with_firecrawl(url: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    if not is_safe_url(url):
        logger.warning("SSRF blocked: %s", url)
        return None
    cached = _get_from_cache(url, "firecrawl")
    if cached:
        return ResolvedResult(**cached)
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        logger.debug("Firecrawl skipped: no API key")
        return None
    if _is_rate_limited("firecrawl"):
        logger.debug("Firecrawl skipped: rate limited")
        return None
    try:
        from firecrawl import Firecrawl

        app = Firecrawl(api_key=api_key)
        res = app.scrape(url, formats=["markdown"])
        if not res or not hasattr(res, "markdown"):
            logger.warning("Firecrawl returned no markdown for URL: %s", url)
            return None
        markdown = res.markdown
        if not markdown:
            logger.warning("Firecrawl returned empty markdown for URL: %s", url)
            return None
        result = ResolvedResult(source="firecrawl", content=markdown[:max_chars], url=url)
        _save_to_cache(url, "firecrawl", result.to_dict())
        return result
    except Exception as e:
        status = getattr(e, "status_code", None)
        if status == 401:
            logger.warning("Firecrawl failed: 401 Unauthorized — API key may be invalid or expired")
        elif status == 429:
            logger.warning("Firecrawl failed: 429 Rate limited — setting cooldown")
            _set_rate_limit("firecrawl")
        elif status == 403:
            logger.warning("Firecrawl failed: 403 Forbidden — %s", e)
        else:
            logger.warning("Firecrawl resolution failed: %s: %s", type(e).__name__, e)
        return None


def resolve_with_mistral_browser(url: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    if not is_safe_url(url):
        logger.warning("SSRF blocked: %s", url)
        return None
    cached = _get_from_cache(url, "mistral_browser")
    if cached:
        return ResolvedResult(**cached)
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        logger.debug("Mistral browser skipped: no API key")
        return None
    if _is_rate_limited("mistral"):
        logger.debug("Mistral browser skipped: rate limited")
        return None
    try:
        from mistralai.client import Mistral

        client = Mistral(api_key=api_key)

        # Create an agent with web_search tool
        agent = client.beta.agents.create(
            model="mistral-small-latest",
            name="url-extractor",
            instructions="Extract and summarize content from web pages. Return clean markdown.",
            tools=[{"type": "web_search"}],  # type: ignore[arg-type]
        )

        try:
            # Start conversation to extract the URL
            result = client.beta.conversations.start(
                agent_id=agent.id,
                inputs=f"Extract the main content from this URL and return it as markdown: {url}",
            )

            content = ""
            for entry in result.outputs:
                if hasattr(entry, "content") and entry.content is not None:
                    # In newer mistralai, content might be a list of chunks
                    if isinstance(entry.content, str):
                        content += entry.content
                    elif isinstance(entry.content, list):
                        for chunk in entry.content:
                            if hasattr(chunk, "text") and chunk.text:
                                content += chunk.text
                            elif isinstance(chunk, str):
                                content += chunk

            if not content:
                logger.warning("Mistral browser returned empty content for URL: %s", url)
                return None

            resolved = ResolvedResult(
                source="mistral-browser", content=content[:max_chars], url=url
            )
            _save_to_cache(url, "mistral_browser", resolved.to_dict())
            return resolved
        finally:
            # Clean up the agent
            try:
                client.beta.agents.delete(agent_id=agent.id)
            except Exception as e:
                logger.warning("Mistral browser agent cleanup failed: %s", e)
    except Exception as e:
        status = getattr(e, "status_code", None)
        if status == 401:
            logger.warning(
                "Mistral browser failed: 401 Unauthorized — API key may be invalid or expired"
            )
        elif status == 429:
            logger.warning("Mistral browser failed: 429 Rate limited — setting cooldown")
            _set_rate_limit("mistral")
        elif status == 403:
            logger.warning("Mistral browser failed: 403 Forbidden — %s", e)
        else:
            logger.warning("Mistral browser failed: %s: %s", type(e).__name__, e)
        return None


def resolve_with_mistral_websearch(query: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    cached = _get_from_cache(query, "mistral_websearch")
    if cached:
        return ResolvedResult(**cached)
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        logger.debug("Mistral websearch skipped: no API key")
        return None
    if _is_rate_limited("mistral"):
        logger.debug("Mistral websearch skipped: rate limited")
        return None
    try:
        from mistralai.client import Mistral
        from mistralai.client.models import UserMessage

        client = Mistral(api_key=api_key)
        resp = client.chat.complete(
            model="mistral-small-latest",
            messages=[UserMessage(content=f"Search: {query}")],  # type: ignore[arg-type]
        )
        content = ""
        if resp.choices and resp.choices[0].message and resp.choices[0].message.content:
            msg_content = resp.choices[0].message.content
            if isinstance(msg_content, str):
                content = msg_content
            elif isinstance(msg_content, list):
                # Handle list of chunks if necessary
                for chunk in msg_content:
                    if hasattr(chunk, "text") and chunk.text:
                        content += chunk.text
                    elif isinstance(chunk, str):
                        content += chunk
        if not content:
            logger.warning("Mistral websearch returned empty content for query: %s", query)
            return None
        result = ResolvedResult(
            source="mistral-websearch", content=content[:max_chars], query=query
        )
        _save_to_cache(query, "mistral_websearch", result.to_dict())
        return result
    except Exception as e:
        status = getattr(e, "status_code", None)
        if status == 401:
            logger.warning(
                "Mistral websearch failed: 401 Unauthorized — API key may be invalid or expired"
            )
        elif status == 429:
            logger.warning("Mistral websearch failed: 429 Rate limited — setting cooldown")
            _set_rate_limit("mistral")
        elif status == 403:
            logger.warning("Mistral websearch failed: 403 Forbidden — %s", e)
        else:
            logger.warning("Mistral websearch failed: %s: %s", type(e).__name__, e)
        return None


def resolve_with_docling(url: str, max_chars: int) -> ResolvedResult | None:
    if not is_safe_url(url):
        logger.warning("SSRF blocked: %s", url)
        return None
    try:
        res = subprocess.run(
            ["docling", "--format", "markdown", url], capture_output=True, text=True, timeout=60
        )
        if res.returncode == 0:
            return ResolvedResult(source="docling", content=res.stdout[:max_chars], url=url)
    except Exception as e:
        logger.debug("Docling resolution failed: %s: %s", type(e).__name__, e)
    return None


def resolve_with_ocr(url: str, max_chars: int) -> ResolvedResult | None:
    if not is_safe_url(url):
        logger.warning("SSRF blocked: %s", url)
        return None
    try:
        res = subprocess.run(
            ["tesseract", url, "stdout"], capture_output=True, text=True, timeout=30
        )
        if res.returncode == 0:
            return ResolvedResult(source="ocr-tesseract", content=res.stdout[:max_chars], url=url)
    except Exception as e:
        logger.debug("OCR resolution failed: %s: %s", type(e).__name__, e)
    return None
