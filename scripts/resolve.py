#!/usr/bin/env python3
"""
Web Doc Resolver - Resolve queries or URLs into compact, LLM-ready markdown.
Main orchestrator. CLI entrypoint moved to scripts/cli.py.
"""

import concurrent.futures
import logging
import os
import time
from collections.abc import Generator
from typing import Any

import scripts.cache_negative
import scripts.circuit_breaker
import scripts.providers_impl
import scripts.quality
import scripts.routing
import scripts.routing_memory
import scripts.semantic_cache
import scripts.synthesis
import scripts.utils
from scripts.models import (
    ErrorType,
    Profile,
    ProviderType,
    ResolvedResult,
    ResolveMetrics,
    ValidationResult,
)
from scripts.providers_impl import (
    _is_rate_limited,
    _rate_limits,
    _set_rate_limit,
    resolve_with_docling,
    resolve_with_duckduckgo,
    resolve_with_exa,
    resolve_with_exa_mcp,
    resolve_with_firecrawl,
    resolve_with_jina,
    resolve_with_mistral_browser,
    resolve_with_mistral_websearch,
    resolve_with_ocr,
    resolve_with_serper,
    resolve_with_tavily,
)
from scripts.semantic_cache import get_semantic_cache
from scripts.utils import (
    _cache_key,
    _detect_error_type,
    _get_cache,
    _get_from_cache,
    _save_to_cache,
    compact_content,
    fetch_llms_txt,
    fetch_url_content,
    get_cache,
    get_session,
    is_url,
    validate_links,
    validate_url,
)

# Configuration Constants
MAX_CHARS = int(os.getenv("WEB_RESOLVER_MAX_CHARS", "8000"))
MIN_CHARS = int(os.getenv("WEB_RESOLVER_MIN_CHARS", "200"))
DEFAULT_TIMEOUT = int(os.getenv("WEB_RESOLVER_TIMEOUT", "30"))

logger = logging.getLogger(__name__)

# Global State
_circuit_breakers = scripts.circuit_breaker.CircuitBreakerRegistry()
_routing_memory = scripts.routing_memory.RoutingMemory()
_cache = None
_semantic_cache = None

# Aliases for backward compatibility in tests
is_rate_limited = _is_rate_limited
set_rate_limit = _set_rate_limit


def _get_semantic_cache():
    """Get or initialize the semantic cache."""
    global _semantic_cache
    if _semantic_cache is None:
        _semantic_cache = get_semantic_cache()
    return _semantic_cache


def _check_semantic_cache(query_or_url: str) -> dict[str, Any] | None:
    """
    Check semantic cache for similar query/URL.

    Args:
        query_or_url: The query string or URL to search for

    Returns:
        Cached result dict if found above threshold, None otherwise
    """
    cache = _get_semantic_cache()
    if cache is None:
        return None

    try:
        entry = cache.query(query_or_url)
        if entry:
            logger.info(f"Semantic cache hit for '{query_or_url[:50]}...' (similarity: {entry.similarity:.3f})")
            result = dict(entry.result)
            result["semantic_cache_hit"] = True
            result["semantic_similarity"] = entry.similarity
            result["semantic_original_query"] = entry.query
            return result
    except Exception as e:
        logger.debug(f"Semantic cache check failed: {e}")

    return None


def _store_in_semantic_cache(query_or_url: str, result: dict[str, Any]) -> bool:
    """
    Store a successful result in the semantic cache.

    Args:
        query_or_url: The query string or URL
        result: The result dictionary to cache

    Returns:
        True if stored successfully, False otherwise
    """
    cache = _get_semantic_cache()
    if cache is None:
        return False

    # Don't cache failed results or already-cached results
    if result.get("source") == "none" or result.get("semantic_cache_hit"):
        return False

    try:
        return cache.store(query_or_url, result)
    except Exception as e:
        logger.debug(f"Failed to store in semantic cache: {e}")
        return False

__all__ = [
    "resolve",
    "resolve_url",
    "resolve_query",
    "resolve_direct",
    "resolve_with_order",
    "resolve_url_with_order",
    "resolve_query_with_order",
    "ResolvedResult",
    "ValidationResult",
    "ErrorType",
    "ProviderType",
    "is_url",
    "validate_url",
    "validate_links",
    "fetch_url_content",
    "fetch_llms_txt",
    "MAX_CHARS",
    "MIN_CHARS",
    "DEFAULT_TIMEOUT",
    "_detect_error_type",
    "_is_rate_limited",
    "_set_rate_limit",
    "get_session",
    "_get_from_cache",
    "_save_to_cache",
    "_cache_key",
    "_get_cache",
    "get_cache",
    "_rate_limits",
    "_cache",
    "_check_semantic_cache",
    "_store_in_semantic_cache",
]


def synthesize_results(query: str, results: list[ResolvedResult], api_key: str, model: str) -> str:
    if not results:
        return "No results to synthesize."
    if not scripts.synthesis.should_call_llm_synthesis(results):
        return scripts.synthesis.deterministic_merge(results)
    context = "".join(
        [
            f"\nResult {i+1}:\nURL: {res.url or 'unk'}\nContent: {res.content}\n---\n"
            for i, res in enumerate(results)
        ]
    )
    prompt = (
        f"Synthesize for query: '{query}'. Provide markdown with citations.\n\nContext:\n{context}"
    )
    try:
        import requests

        resp = requests.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "Assistant"},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return str(content)
    except Exception as e:
        logger.error(f"LLM Synthesis failed: {e}")
        return scripts.synthesis.deterministic_merge(results)


def resolve_url(
    url: str, max_chars: int = MAX_CHARS, profile: Profile = Profile.BALANCED
) -> dict[str, Any]:
    for result in resolve_url_stream(url, max_chars, profile):
        if result.get("source") != "partial":
            return result
    return {"source": "none", "url": url, "content": "Failed"}


def resolve_url_stream(
    url: str, max_chars: int = MAX_CHARS, profile: Profile = Profile.BALANCED
) -> Generator[dict[str, Any], None, None]:
    logger.info(f"Resolving URL: {url}")

    # Check semantic cache first
    cached_result = _check_semantic_cache(url)
    if cached_result:
        cached_result["url"] = url
        yield cached_result
        return

    metrics = ResolveMetrics()
    budget_data = scripts.routing.PROFILE_BUDGETS.get(
        profile.value, scripts.routing.PROFILE_BUDGETS["balanced"]
    )
    budget = scripts.routing.ResolutionBudget(
        max_provider_attempts=budget_data["max_provider_attempts"],
        max_paid_attempts=budget_data["max_paid_attempts"],
        max_total_latency_ms=budget_data["max_total_latency_ms"],
        allow_paid=bool(budget_data["allow_paid"]),
    )

    if any(url.lower().endswith(ext) for ext in [".pdf", ".docx", ".pptx"]):
        res = resolve_with_docling(url, max_chars)
        if res:
            res.metrics = metrics
            yield res.to_dict()
            return
    if any(url.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg"]):
        res = resolve_with_ocr(url, max_chars)
        if res:
            res.metrics = metrics
            yield res.to_dict()
            return

    provider_names = scripts.routing.plan_provider_order(
        target=url, is_url=True, routing_memory=_routing_memory
    )
    cascade_map: dict[str, tuple[ProviderType, Any]] = {
        "llms_txt": (ProviderType.LLMS_TXT, lambda: fetch_llms_txt(url)),
        "jina": (ProviderType.JINA, lambda: resolve_with_jina(url, max_chars)),
        "firecrawl": (ProviderType.FIRECRAWL, lambda: resolve_with_firecrawl(url, max_chars)),
        "direct_fetch": (
            ProviderType.DIRECT_FETCH,
            lambda: fetch_url_content(url, max_chars=max_chars),
        ),
        "mistral_browser": (
            ProviderType.MISTRAL_BROWSER,
            lambda: resolve_with_mistral_browser(url, max_chars),
        ),
        "duckduckgo": (ProviderType.DUCKDUCKGO, lambda: resolve_with_duckduckgo(url, max_chars)),
    }

    cache = _get_cache()
    domain = scripts.routing.extract_domain(url)
    eligible = [p for p in provider_names if p in cascade_map]
    active_futures = {}

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(eligible)))
    try:
        for i, p_name in enumerate(eligible):
            pt, func = cascade_map[p_name]
            if not budget.can_try(is_paid=pt.is_paid()):
                if budget.stop_reason in ("paid_disabled", "max_paid_attempts"):
                    continue
                break
            if scripts.cache_negative.should_skip_from_negative_cache(cache, url, p_name):
                continue
            if _circuit_breakers.is_open(p_name):
                continue

            logger.info(f"Starting probe: {p_name}")
            start_time_probe = time.time()
            future = executor.submit(func)
            active_futures[future] = (p_name, pt, start_time_probe)
            threshold = _routing_memory.get_p75_latency(domain or "any", p_name) / 1000.0

            while active_futures:
                elapsed = time.time() - start_time_probe

                # If we've hit the threshold, start the next provider (hedging)
                if i < len(eligible) - 1 and elapsed >= threshold:
                    logger.info(f"Hedging threshold reached for {p_name} ({threshold}s)")
                    break

                # Wait for any task to complete
                done, _ = concurrent.futures.wait(
                    active_futures.keys(),
                    timeout=0.01,
                    return_when=concurrent.futures.FIRST_COMPLETED,
                )

                found_acceptable = False
                for f in list(done):
                    if f not in active_futures:
                        continue
                    p_name_done, pt_done, s_time = active_futures.pop(f)
                    latency = int((time.time() - s_time) * 1000)
                    budget.record_attempt(is_paid=pt_done.is_paid(), latency_ms=latency)
                    try:
                        res_or_content = f.result()
                    except Exception as e:
                        err_type = _detect_error_type(e)
                        if err_type not in (ErrorType.AUTH_ERROR, ErrorType.SSRF_BLOCKED):
                            _circuit_breakers.record_failure(p_name_done)
                        metrics.record_provider(pt_done, latency, False)
                        continue
                    if res_or_content:
                        if isinstance(res_or_content, ResolvedResult):
                            content = res_or_content.content
                        else:
                            content = str(res_or_content)

                        q_score = scripts.quality.score_content(content)
                        if q_score.acceptable or pt_done == ProviderType.LLMS_TXT:
                            _circuit_breakers.record_success(p_name_done)
                            metrics.record_provider(pt_done, latency, True)
                            if domain:
                                _routing_memory.record(
                                    domain, p_name_done, True, latency, q_score.score
                                )

                            found_acceptable = True
                            if pt_done == ProviderType.LLMS_TXT:
                                result_dict = {
                                    "source": "llms.txt",
                                    "url": url,
                                    "content": compact_content(content, max_chars),
                                    "metrics": metrics,
                                }
                                _store_in_semantic_cache(url, result_dict)
                                yield result_dict
                            elif isinstance(res_or_content, ResolvedResult):
                                res_or_content.metrics, res_or_content.score = (
                                    metrics,
                                    q_score.score,
                                )
                                result_dict = res_or_content.to_dict()
                                _store_in_semantic_cache(url, result_dict)
                                yield result_dict
                            break
                        else:
                            scripts.cache_negative.write_negative_cache(
                                cache, url, p_name_done, "thin_content", 1800
                            )
                            if domain:
                                _routing_memory.record(
                                    domain, p_name_done, False, latency, q_score.score
                                )
                    else:
                        _circuit_breakers.record_failure(p_name_done)
                        metrics.record_provider(pt_done, latency, False)

                if found_acceptable:
                    return
                if done:
                    break
                if not active_futures:
                    break
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    yield {
        "source": "none",
        "url": url,
        "content": "Failed",
        "error": f"No resolution method available. Stop reason: {budget.stop_reason}",
    }


def resolve_query(
    query: str,
    max_chars: int = MAX_CHARS,
    skip_providers: set[str] | None = None,
    profile: Profile = Profile.BALANCED,
) -> dict[str, Any]:
    for result in resolve_query_stream(query, max_chars, skip_providers, profile):
        if result.get("source") != "partial":
            return result
    return {"source": "none", "query": query, "content": "Failed"}


def resolve_query_stream(
    query: str,
    max_chars: int = MAX_CHARS,
    skip_providers: set[str] | None = None,
    profile: Profile = Profile.BALANCED,
) -> Generator[dict[str, Any], None, None]:
    skip = skip_providers or set()

    # Check semantic cache first
    cached_result = _check_semantic_cache(query)
    if cached_result:
        cached_result["query"] = query
        yield cached_result
        return

    metrics = ResolveMetrics()
    budget_data = scripts.routing.PROFILE_BUDGETS.get(
        profile.value, scripts.routing.PROFILE_BUDGETS["balanced"]
    )
    budget = scripts.routing.ResolutionBudget(
        max_provider_attempts=budget_data["max_provider_attempts"],
        max_paid_attempts=budget_data["max_paid_attempts"],
        max_total_latency_ms=budget_data["max_total_latency_ms"],
        allow_paid=bool(budget_data["allow_paid"]),
    )
    provider_names = scripts.routing.plan_provider_order(
        target=query, is_url=False, skip_providers=skip, routing_memory=_routing_memory
    )
    cascade_map = {
        "exa_mcp": (ProviderType.EXA_MCP, resolve_with_exa_mcp),
        "exa": (ProviderType.EXA, resolve_with_exa),
        "tavily": (ProviderType.TAVILY, resolve_with_tavily),
        "serper": (ProviderType.SERPER, resolve_with_serper),
        "duckduckgo": (ProviderType.DUCKDUCKGO, resolve_with_duckduckgo),
        "mistral_websearch": (ProviderType.MISTRAL_WEBSEARCH, resolve_with_mistral_websearch),
    }
    cache = _get_cache()
    eligible = [p for p in provider_names if p in cascade_map]
    active_futures = {}
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(eligible)))
    try:
        for i, p_name in enumerate(eligible):
            pt, func = cascade_map[p_name]
            if not budget.can_try(is_paid=pt.is_paid()):
                if budget.stop_reason in ("paid_disabled", "max_paid_attempts"):
                    continue
                break
            if scripts.cache_negative.should_skip_from_negative_cache(cache, query, p_name):
                continue
            if _circuit_breakers.is_open(p_name):
                continue
            logger.info(f"Starting probe: {p_name}")
            start_time_probe = time.time()
            future = executor.submit(func, query, max_chars)
            active_futures[future] = (p_name, pt, start_time_probe)
            threshold = _routing_memory.get_p75_latency("query", p_name) / 1000.0
            while active_futures:
                elapsed = time.time() - start_time_probe
                if i < len(eligible) - 1 and elapsed >= threshold:
                    break

                done, _ = concurrent.futures.wait(
                    active_futures.keys(),
                    timeout=0.01,
                    return_when=concurrent.futures.FIRST_COMPLETED,
                )
                found_acceptable = False
                for f in list(done):
                    if f not in active_futures:
                        continue
                    p_name_done, pt_done, s_time = active_futures.pop(f)
                    latency = int((time.time() - s_time) * 1000)
                    budget.record_attempt(is_paid=pt_done.is_paid(), latency_ms=latency)
                    try:
                        res = f.result()
                    except Exception as e:
                        err_type = _detect_error_type(e)
                        if err_type not in (ErrorType.AUTH_ERROR, ErrorType.SSRF_BLOCKED):
                            _circuit_breakers.record_failure(p_name_done)
                        metrics.record_provider(pt_done, latency, False)
                        continue
                    if res:
                        q_score = scripts.quality.score_content(res.content)
                        if q_score.acceptable:
                            _circuit_breakers.record_success(p_name_done)
                            metrics.record_provider(pt_done, latency, True)
                            _routing_memory.record(
                                "query", p_name_done, True, latency, q_score.score
                            )

                            found_acceptable = True
                            res.metrics, res.score = metrics, q_score.score
                            result_dict = res.to_dict()
                            _store_in_semantic_cache(query, result_dict)
                            yield result_dict
                            break
                        else:
                            scripts.cache_negative.write_negative_cache(
                                cache, query, p_name_done, "thin_content", 1800
                            )
                            _routing_memory.record(
                                "query", p_name_done, False, latency, q_score.score
                            )
                    else:
                        _circuit_breakers.record_failure(p_name_done)
                        metrics.record_provider(pt_done, latency, False)

                if found_acceptable:
                    return
                if done:
                    break
                if not active_futures:
                    break
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    yield {
        "source": "none",
        "query": query,
        "content": "Failed",
        "error": f"No resolution method available. Stop reason: {budget.stop_reason}",
    }


def resolve(
    input_str: str,
    max_chars: int = MAX_CHARS,
    skip_providers: set[str] | None = None,
    profile: Profile | str = Profile.BALANCED,
) -> dict[str, Any]:
    # Convert string profile to enum if needed
    if isinstance(profile, str):
        profile = Profile(profile.lower())

    if is_url(input_str):
        return resolve_url(input_str, max_chars, profile=profile)
    return resolve_query(input_str, max_chars, skip_providers, profile=profile)


def resolve_direct(
    input_str: str, provider: ProviderType, max_chars: int = MAX_CHARS
) -> dict[str, Any]:
    funcs = {
        ProviderType.JINA: resolve_with_jina,
        ProviderType.EXA_MCP: resolve_with_exa_mcp,
        ProviderType.EXA: resolve_with_exa,
        ProviderType.TAVILY: resolve_with_tavily,
        ProviderType.DUCKDUCKGO: resolve_with_duckduckgo,
        ProviderType.FIRECRAWL: resolve_with_firecrawl,
        ProviderType.MISTRAL_BROWSER: resolve_with_mistral_browser,
        ProviderType.MISTRAL_WEBSEARCH: resolve_with_mistral_websearch,
    }
    if provider in funcs:
        res = funcs[provider](input_str, max_chars)
        return res.to_dict() if res else {"source": "none", "error": "Provider failed"}
    return {"source": "none", "error": "Unknown provider"}


def resolve_with_order(
    input_str: str, providers_order: list[ProviderType], max_chars: int = MAX_CHARS
) -> dict[str, Any]:
    for pt in providers_order:
        res = resolve_direct(input_str, pt, max_chars)
        if res.get("source") != "none":
            return res
    return {"source": "none", "error": "All providers failed"}


def resolve_url_with_order(
    url: str, order: list[ProviderType], max_chars: int = MAX_CHARS
) -> dict[str, Any]:
    return resolve_with_order(url, order, max_chars)


def resolve_query_with_order(
    query: str, order: list[ProviderType], max_chars: int = MAX_CHARS
) -> dict[str, Any]:
    return resolve_with_order(query, order, max_chars)
