"""Live integration tests for providers that require real API keys.

These tests make real network calls and should be run explicitly, e.g.:
pytest -m live -s tests/test_live_api_integrations.py
"""

import os
import sys
import uuid

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.resolve import (  # noqa: E402
    _cache_key,
    _get_cache,
    _rate_limits,
    resolve_with_exa,
    resolve_with_firecrawl,
    resolve_with_mistral_browser,
    resolve_with_mistral_websearch,
    resolve_with_tavily,
)

pytestmark = pytest.mark.live


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        pytest.skip(f"{name} not set")
    return value


def _clear_cached_result(input_value: str, source: str, rate_limit_key: str | None = None) -> None:
    cache = _get_cache()
    if cache is not None:
        try:
            cache.delete(_cache_key(input_value, source))
        except Exception:
            pass
    _rate_limits.pop(rate_limit_key or source, None)


def test_live_exa_sdk_with_real_api_key():
    _require_env("EXA_API_KEY")
    pytest.importorskip("exa_py")

    query = f"Rust agent frameworks {uuid.uuid4().hex[:8]}"
    _clear_cached_result(query, "exa")

    result = resolve_with_exa(query)

    assert result is not None
    assert result.source == "exa"
    assert isinstance(result.content, str)
    assert len(result.content.strip()) > 0


def test_live_tavily_with_real_api_key():
    _require_env("TAVILY_API_KEY")
    pytest.importorskip("tavily")

    query = f"Rust agent frameworks {uuid.uuid4().hex[:8]}"
    _clear_cached_result(query, "tavily")

    result = resolve_with_tavily(query)

    assert result is not None
    assert result.source == "tavily"
    assert isinstance(result.content, str)
    assert len(result.content.strip()) > 0


def test_live_firecrawl_with_real_api_key():
    _require_env("FIRECRAWL_API_KEY")
    pytest.importorskip("firecrawl")

    url = "https://example.com"
    _clear_cached_result(url, "firecrawl")

    result = resolve_with_firecrawl(url)

    assert result is not None
    assert result.source == "firecrawl"
    assert result.url is not None
    assert isinstance(result.content, str)


def test_live_mistral_browser_with_real_api_key():
    _require_env("MISTRAL_API_KEY")
    pytest.importorskip("mistralai")

    url = "https://example.com"
    _clear_cached_result(url, "mistral_browser", rate_limit_key="mistral")

    result = resolve_with_mistral_browser(url)

    assert result is not None
    assert result.source == "mistral-browser"
    assert result.url is not None
    assert isinstance(result.content, str)
    assert len(result.content.strip()) > 0


def test_live_mistral_websearch_with_real_api_key():
    _require_env("MISTRAL_API_KEY")
    pytest.importorskip("mistralai")

    query = f"Rust async runtime overview {uuid.uuid4().hex[:8]}"
    _clear_cached_result(query, "mistral_websearch", rate_limit_key="mistral")

    result = resolve_with_mistral_websearch(query)

    assert result is not None
    assert result.source == "mistral-websearch"
    assert isinstance(result.content, str)
    assert len(result.content.strip()) > 0
