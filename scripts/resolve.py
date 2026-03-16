#!/usr/bin/env python3
"""
Deep Research Resolver - Resolve queries or URLs into compact, LLM-ready markdown.

A comprehensive web research tool with:
- URL validation and HTTP status code handling
- Link validation for all returned results
- Retry logic with exponential backoff
- Proper error handling for all providers
- Real-time web search and content extraction
- SSRF protection and content size limits

Cascade order for queries: Exa MCP → Exa SDK → Tavily → DuckDuckGo → Mistral
Cascade order for URLs: llms.txt (cached) → Jina Reader (free) → Firecrawl → Direct HTTP fetch → Mistral browser → DuckDuckGo
"""

import argparse
import hashlib
import html as html_module
import ipaddress
import json
import logging
import os
import re
import socket
import sys
import time
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any
from urllib.parse import urlparse
from html.parser import HTMLParser

import subprocess
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# Configuration Constants (configurable via environment variables)
MAX_CHARS = int(os.getenv("WEB_RESOLVER_MAX_CHARS", "8000"))
MIN_CHARS = int(os.getenv("WEB_RESOLVER_MIN_CHARS", "200"))
MAX_CONTENT_SIZE = int(
    os.getenv("WEB_RESOLVER_MAX_CONTENT_SIZE", str(10 * 1024 * 1024))
)  # 10MB default
DEFAULT_TIMEOUT = int(os.getenv("WEB_RESOLVER_TIMEOUT", "30"))
EXA_RESULTS = int(os.getenv("WEB_RESOLVER_EXA_RESULTS", "5"))
TAVILY_RESULTS = int(os.getenv("WEB_RESOLVER_TAVILY_RESULTS", "5"))
DDG_RESULTS = int(os.getenv("WEB_RESOLVER_DDG_RESULTS", "5"))
CACHE_DIR = os.path.expanduser(os.getenv("WEB_RESOLVER_CACHE_DIR", "~/.cache/web-doc-resolver"))
CACHE_TTL = int(os.getenv("WEB_RESOLVER_CACHE_TTL", str(3600 * 24)))  # 24 hours

# HTTP Configuration
MAX_RETRIES = 3
RETRY_BACKOFF_FACTOR = 1.0
USER_AGENT = (
    "Mozilla/5.0 (compatible; WebDocResolver/2.0; +https://github.com/d-oit/web-doc-resolver)"
)

# SSRF Protection - Blocked IP ranges
BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),  # Localhost
    ipaddress.ip_network("10.0.0.0/8"),  # Private Class A
    ipaddress.ip_network("172.16.0.0/12"),  # Private Class B
    ipaddress.ip_network("192.168.0.0/16"),  # Private Class C
    ipaddress.ip_network("169.254.0.0/16"),  # Link-local
    ipaddress.ip_network("::1/128"),  # IPv6 localhost
    ipaddress.ip_network("fc00::/7"),  # IPv6 private
    ipaddress.ip_network("fe80::/10"),  # IPv6 link-local
]

# Blocked URL schemes (SSRF protection)
BLOCKED_SCHEMES: set[str] = {"file", "javascript", "data", "vbscript"}

# Rate limit tracking
_rate_limits: dict[str, float] = {}

RATE_LIMIT_FILE = os.path.join(CACHE_DIR, "rate_limits.json")


def _load_rate_limits() -> dict[str, float]:
    """Load persisted rate-limit state from disk."""
    try:
        if os.path.exists(RATE_LIMIT_FILE):
            with open(RATE_LIMIT_FILE) as f:
                data = json.load(f)
                return {k: float(v) for k, v in data.items()}
    except Exception:
        pass
    return {}


def _save_rate_limits() -> None:
    """Persist rate-limit state to disk so re-invoked processes respect cooldowns."""
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(RATE_LIMIT_FILE, "w") as f:
            json.dump(_rate_limits, f)
    except Exception:
        pass


# Initialise from disk on import
_rate_limits.update(_load_rate_limits())

# Global session for connection pooling
_global_session: requests.Session | None = None

# Module exports
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
    "DEFAULT_URL_PROVIDERS",
    "DEFAULT_QUERY_PROVIDERS",
    "is_url",
    "validate_url",
    "validate_links",
    "fetch_url_content",
    "fetch_llms_txt",
    "resolve_with_jina",
    "resolve_with_exa_mcp",
    "resolve_with_exa",
    "resolve_with_tavily",
    "resolve_with_duckduckgo",
    "resolve_with_firecrawl",
    "resolve_with_mistral_browser",
    "resolve_with_mistral_websearch",
    "MAX_CHARS",
    "MIN_CHARS",
    "DEFAULT_TIMEOUT",
]


class ErrorType(Enum):
    """Types of errors that can occur during resolution."""

    RATE_LIMIT = "rate_limit"
    AUTH_ERROR = "auth_error"
    QUOTA_EXHAUSTED = "quota_exhausted"
    NETWORK_ERROR = "network_error"
    NOT_FOUND = "not_found"
    INVALID_URL = "invalid_url"
    TIMEOUT = "timeout"
    INVALID_RESPONSE = "invalid_response"
    SSRF_BLOCKED = "ssrf_blocked"
    CONTENT_TOO_LARGE = "content_too_large"
    UNKNOWN = "unknown"


class Profile(Enum):
    """Execution profiles for resource management."""

    FREE = "free"
    BALANCED = "balanced"
    FAST = "fast"
    QUALITY = "quality"

    def is_provider_allowed(self, provider: "ProviderType") -> bool:
        if self == Profile.FREE:
            return not provider.is_paid()
        if self == Profile.FAST:
            return provider.is_fast()
        return True

    def max_hops(self) -> int:
        if self == Profile.FREE:
            return 3
        if self == Profile.FAST:
            return 2
        if self == Profile.BALANCED:
            return 6
        if self == Profile.QUALITY:
            return 8


class ProviderType(Enum):
    """Available providers for resolution."""

    # URL providers
    LLMS_TXT = "llms_txt"
    JINA = "jina"
    FIRECRAWL = "firecrawl"
    DIRECT_FETCH = "direct_fetch"
    MISTRAL_BROWSER = "mistral_browser"

    # Query providers
    EXA_MCP = "exa_mcp"
    EXA = "exa"
    TAVILY = "tavily"
    SERPER = "serper"
    DUCKDUCKGO = "duckduckgo"
    MISTRAL_WEBSEARCH = "mistral_websearch"

    # New providers
    DOCLING = "docling"
    OCR = "ocr"

    def is_paid(self) -> bool:
        return self in (
            ProviderType.EXA,
            ProviderType.TAVILY,
            ProviderType.SERPER,
            ProviderType.FIRECRAWL,
            ProviderType.MISTRAL_WEBSEARCH,
            ProviderType.MISTRAL_BROWSER,
        )

    def is_fast(self) -> bool:
        return self in (
            ProviderType.EXA_MCP,
            ProviderType.DUCKDUCKGO,
            ProviderType.LLMS_TXT,
            ProviderType.JINA,
            ProviderType.DIRECT_FETCH,
        )


# Default provider orders
DEFAULT_URL_PROVIDERS: list[ProviderType] = [
    ProviderType.LLMS_TXT,
    ProviderType.JINA,
    ProviderType.FIRECRAWL,
    ProviderType.DIRECT_FETCH,
    ProviderType.MISTRAL_BROWSER,
    ProviderType.DUCKDUCKGO,
]

DEFAULT_QUERY_PROVIDERS: list[ProviderType] = [
    ProviderType.EXA_MCP,
    ProviderType.EXA,
    ProviderType.TAVILY,
    ProviderType.SERPER,
    ProviderType.DUCKDUCKGO,
    ProviderType.MISTRAL_WEBSEARCH,
]


@dataclass
class ValidationResult:
    """Result of URL validation."""

    is_valid: bool
    status_code: int | None = None
    content_type: str | None = None
    final_url: str | None = None
    error: str | None = None
    redirect_chain: list[str] = field(default_factory=list)


@dataclass
class ProviderMetric:
    """Metrics for a single provider call."""

    provider: str
    latency_ms: int
    success: bool
    paid: bool


@dataclass
class ResolveMetrics:
    """Aggregated metrics for a resolution request."""

    total_latency_ms: int = 0
    provider_metrics: list[ProviderMetric] = field(default_factory=list)
    cascade_depth: int = 0
    paid_usage: bool = False
    cache_hit: bool = False

    def record_provider(self, provider: "ProviderType", latency_ms: int, success: bool):
        paid = provider.is_paid()
        if paid and success:
            self.paid_usage = True
        self.provider_metrics.append(
            ProviderMetric(
                provider=provider.value,
                latency_ms=latency_ms,
                success=success,
                paid=paid,
            )
        )
        self.total_latency_ms += latency_ms


@dataclass
class ResolvedResult:
    """Result of a successful resolution."""

    source: str
    content: str
    url: str | None = None
    query: str | None = None
    score: float = 0.0
    validated_links: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    metrics: ResolveMetrics | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


# ============================================================================
# HTTP Session Management
# ============================================================================


def create_session_with_retry() -> requests.Session:
    """Create a requests session with retry logic."""
    session = requests.Session()

    retry_strategy = Retry(
        total=MAX_RETRIES,
        backoff_factor=RETRY_BACKOFF_FACTOR,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"],
        raise_on_status=False,
    )

    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
    )

    return session


def get_session() -> requests.Session:
    """Get or create a global session with connection pooling."""
    global _global_session
    if _global_session is None:
        _global_session = create_session_with_retry()
    return _global_session


def close_session() -> None:
    """Close the global session if it exists."""
    global _global_session
    if _global_session is not None:
        _global_session.close()
        _global_session = None


# ============================================================================
# SSRF Protection
# ============================================================================


def is_safe_url(url: str) -> bool:
    """
    Check if a URL is safe to fetch (SSRF protection).

    Blocks:
    - Localhost and private IP ranges
    - Blocked schemes (file://, javascript:, etc.)
    - Internal network addresses
    """
    try:
        parsed = urlparse(url)

        # Check scheme
        if parsed.scheme.lower() in BLOCKED_SCHEMES:
            logger.warning(f"Blocked scheme in URL: {url}")
            return False

        if parsed.scheme not in ("http", "https"):
            logger.warning(f"Invalid scheme in URL: {url}")
            return False

        # Get hostname
        hostname = parsed.netloc.split(":")[0]  # Remove port if present

        # Check for localhost variations
        if hostname.lower() in (
            "localhost",
            "localhost.localdomain",
            "127.0.0.1",
            "::1",
            "0.0.0.0",
        ):
            logger.warning(f"Blocked localhost URL: {url}")
            return False

        # Resolve hostname to IP and check against blocked networks
        try:
            # Try to parse as IP directly
            try:
                ip = ipaddress.ip_address(hostname)
                if any(ip in network for network in BLOCKED_NETWORKS):
                    logger.warning(f"Blocked private IP in URL: {url}")
                    return False
            except ValueError:
                # Not an IP, try DNS resolution
                try:
                    # Set a timeout for DNS resolution
                    socket.setdefaulttimeout(5)
                    infos = socket.getaddrinfo(hostname, None)
                    for _family, _socktype, _proto, _canonname, sockaddr in infos:
                        ip_str = sockaddr[0]
                        ip = ipaddress.ip_address(ip_str)
                        if any(ip in network for network in BLOCKED_NETWORKS):
                            logger.warning(f"Blocked resolved private IP in URL: {url}")
                            return False
                except (TimeoutError, socket.gaierror):
                    # DNS resolution failed, allow the request to proceed
                    # The actual fetch will fail if the host is unreachable
                    pass
                finally:
                    socket.setdefaulttimeout(None)
        except Exception as e:
            logger.debug(f"Error checking URL safety: {e}")
            # Allow the request to proceed if safety check fails
            pass

        return True

    except Exception as e:
        logger.warning(f"Error parsing URL for safety check: {e}")
        return False


# ============================================================================
# Rate Limit Management
# ============================================================================


def _is_rate_limited(provider: str, cooldown: int = 60) -> bool:
    """Check if a provider is currently rate-limited."""
    if provider in _rate_limits:
        if time.time() < _rate_limits[provider]:
            return True
        del _rate_limits[provider]
    return False


def _set_rate_limit(provider: str, cooldown: int = 60) -> None:
    """Set a rate limit cooldown for a provider."""
    _rate_limits[provider] = time.time() + cooldown
    logger.warning(f"Rate limit set for {provider}, cooldown: {cooldown}s")
    _save_rate_limits()


def _detect_error_type(error: Exception) -> ErrorType:
    """Detect the type of error from an exception."""
    error_msg = str(error).lower()

    if any(code in error_msg for code in ["429", "rate limit", "too many requests", "rate_limit"]):
        return ErrorType.RATE_LIMIT
    if any(
        code in error_msg
        for code in [
            "401",
            "403",
            "unauthorized",
            "forbidden",
            "invalid api key",
            "invalid_key",
            "authentication",
        ]
    ):
        return ErrorType.AUTH_ERROR
    if any(
        code in error_msg
        for code in [
            "402",
            "payment",
            "credit",
            "quota",
            "insufficient",
            "exhausted",
            "limit exceeded",
        ]
    ):
        return ErrorType.QUOTA_EXHAUSTED
    if any(code in error_msg for code in ["timeout", "timed out"]):
        return ErrorType.TIMEOUT
    if any(code in error_msg for code in ["connection", "network"]):
        return ErrorType.NETWORK_ERROR
    if any(code in error_msg for code in ["not found", "404"]):
        return ErrorType.NOT_FOUND
    if any(code in error_msg for code in ["ssrf", "blocked", "private ip", "localhost"]):
        return ErrorType.SSRF_BLOCKED
    if any(code in error_msg for code in ["too large", "content size", "exceeds"]):
        return ErrorType.CONTENT_TOO_LARGE

    return ErrorType.UNKNOWN


# ============================================================================
# Cache Management
# ============================================================================


def get_cache():
    """Get cache instance."""
    try:
        import diskcache

        os.makedirs(CACHE_DIR, exist_ok=True)
        return diskcache.Cache(CACHE_DIR)
    except ImportError:
        logger.debug("diskcache not installed, caching disabled")
        return None
    except Exception as e:
        logger.warning(f"Failed to initialize cache: {e}")
        return None


_cache = None


def _get_cache():
    """Get or create cache instance."""
    global _cache
    if _cache is None:
        _cache = get_cache()
    return _cache


def _cache_key(input_str: str, source: str) -> str:
    """Generate cache key."""
    hash_input = f"{source}:{input_str}"
    return hashlib.sha256(hash_input.encode()).hexdigest()


def _get_from_cache(input_str: str, source: str) -> dict[str, Any] | None:
    """Get result from cache."""
    cache = _get_cache()
    if not cache:
        return None
    try:
        key = _cache_key(input_str, source)
        result = cache.get(key)
        if result and isinstance(result, dict):
            logger.debug(f"Cache hit for {source}:{input_str[:30]}...")
            return result  # type: ignore[no-any-return]
    except Exception as e:
        logger.debug(f"Cache read error: {e}")
    return None


def _save_to_cache(input_str: str, source: str, result: dict[str, Any], ttl: int | None = None):
    """Save result to cache."""
    cache = _get_cache()
    if not cache:
        return
    try:
        key = _cache_key(input_str, source)
        cache.set(key, result, expire=ttl if ttl is not None else CACHE_TTL)
    except Exception as e:
        logger.debug(f"Cache write error: {e}")


# ============================================================================
# URL Validation
# ============================================================================


def is_url(input_str: str) -> bool:
    """Check if input string is a valid URL."""
    if not input_str or not input_str.strip():
        return False
    try:
        result = urlparse(input_str)
        return all([result.scheme in ("http", "https", "ftp", "ftps"), result.netloc])
    except Exception:
        return False


def validate_url(url: str, timeout: int = 10, check_ssrf: bool = True) -> ValidationResult:
    """
    Validate a URL by making a HEAD request.

    Args:
        url: URL to validate
        timeout: Request timeout in seconds
        check_ssrf: Whether to check for SSRF vulnerabilities

    Returns ValidationResult with status code, content type, and final URL.
    """
    if not url or not url.strip():
        return ValidationResult(is_valid=False, error="Empty URL")

    if not is_url(url):
        return ValidationResult(is_valid=False, error="Invalid URL format")

    # SSRF protection
    if check_ssrf and not is_safe_url(url):
        return ValidationResult(is_valid=False, error="URL blocked for security (SSRF protection)")

    session = get_session()
    redirect_chain = []

    try:
        # First try HEAD request to check validity without downloading content
        response = session.head(url, timeout=timeout, allow_redirects=True, verify=True)

        # Track redirects
        for hist in response.history:
            redirect_chain.append(hist.url)
        redirect_chain.append(response.url)

        # Check status code
        if response.status_code >= 400:
            return ValidationResult(
                is_valid=False,
                status_code=response.status_code,
                final_url=response.url,
                redirect_chain=redirect_chain,
                error=f"HTTP {response.status_code}",
            )

        content_type = response.headers.get("Content-Type", "")

        return ValidationResult(
            is_valid=True,
            status_code=response.status_code,
            content_type=content_type,
            final_url=response.url,
            redirect_chain=redirect_chain,
        )

    except requests.exceptions.Timeout:
        return ValidationResult(is_valid=False, error="Request timed out")
    except requests.exceptions.SSLError:
        return ValidationResult(is_valid=False, error="SSL certificate error")
    except requests.exceptions.ConnectionError as e:
        return ValidationResult(is_valid=False, error=f"Connection error: {str(e)[:100]}")
    except Exception as e:
        return ValidationResult(is_valid=False, error=f"Validation error: {str(e)[:100]}")


def validate_links(links: list[str], timeout: int = 5) -> list[str]:
    """
    Validate a list of links and return only valid ones.

    Uses HEAD requests to check each link without downloading content.
    """
    valid_links = []
    session = get_session()

    for link in links:
        try:
            # Skip non-HTTP links
            parsed = urlparse(link)
            if parsed.scheme not in ("http", "https"):
                continue

            # SSRF check
            if not is_safe_url(link):
                continue

            response = session.head(link, timeout=timeout, allow_redirects=True)
            if response.status_code < 400:
                valid_links.append(link)
            else:
                logger.debug(f"Link validation failed: {link} - HTTP {response.status_code}")
        except Exception as e:
            logger.debug(f"Link validation error for {link}: {e}")

    return valid_links


# ============================================================================
# Content Extraction
# ============================================================================


def score_result(url: str, content: str) -> float:
    """Score a result based on domain trust and content quality."""
    score = 0.5

    # Domain trust heuristics
    try:
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.lower()

        trusted_tlds = [".edu", ".gov", ".org", ".rs", ".io"]
        if any(domain.endswith(tld) for tld in trusted_tlds):
            score += 0.2

        news_sites = ["nytimes.com", "bbc.co.uk", "reuters.com", "theguardian.com"]
        if any(site in domain for site in news_sites):
            score += 0.1

        dev_sites = ["github.com", "stackoverflow.com", "docs.rs", "mozilla.org"]
        if any(site in domain for site in dev_sites):
            score += 0.2
    except Exception:
        pass

    # Content quality heuristics
    word_count = len(content.split())
    if word_count > 500:
        score += 0.1
    elif word_count < 50:
        score -= 0.2

    # SEO spam detection
    spam_terms = ["buy now", "cheap", "discount", "free trial", "best price"]
    lower_content = content.lower()
    for term in spam_terms:
        if term in lower_content:
            score -= 0.1

    return max(0.0, min(1.0, score))


def synthesize_results(query: str, results: list[dict], api_key: str, model: str) -> str:
    """Synthesize multiple results into a cohesive response using Mistral API."""
    if not results:
        return "No results to synthesize."

    context_parts = []
    for i, res in enumerate(results):
        content = res.get("content", "")
        url = res.get("url", "unknown")
        context_parts.append(f"\nResult {i + 1}:\nURL: {url}\nContent: {content}\n---\n")

    context = "".join(context_parts)
    prompt = (
        f"Synthesize the following research results for the query: '{query}'. "
        "Provide a cohesive, well-structured answer in markdown format. "
        "Cite sources using [1], [2], etc.\n\nContext:\n" + context
    )

    try:
        response = requests.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are a helpful research assistant."},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return str(data["choices"][0]["message"]["content"])
    except Exception as e:
        logger.error(f"Synthesis failed: {e}")
        # Fallback to concatenated results
        return "\n\n---\n\n".join([r.get("content", "") for r in results])


def compact_content(content: str, max_chars: int) -> str:
    """Compact content by removing boilerplate and redundant information."""
    lines = content.splitlines()
    unique_lines = set()
    compacted = []

    boilerplate_terms = [
        "cookie policy",
        "all rights reserved",
        "terms of service",
        "privacy policy",
        "subscribe to our newsletter",
        "follow us on",
        "click here",
    ]

    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            compacted.append("")
            continue

        lower = trimmed.lower()
        if any(term in lower for term in boilerplate_terms):
            continue

        if trimmed not in unique_lines:
            compacted.append(trimmed)
            unique_lines.add(trimmed)

    joined = "\n".join(compacted)
    return joined[:max_chars]


def extract_text_from_html(html: str, base_url: str = "") -> str:
    """
    Extract clean text content from HTML.

    Uses simple regex-based extraction for reliability.
    """
    # Remove script and style elements using a tolerant HTML parser
    class ScriptStyleStripper(HTMLParser):
        def __init__(self) -> None:
            super().__init__(convert_charrefs=False)
            self.result: list[str] = []
            self._skip_depth = 0

        def handle_starttag(self, tag, attrs):
            if tag.lower() in ("script", "style"):
                self._skip_depth += 1
                return
            if self._skip_depth == 0:
                self.result.append(self.get_starttag_text() or "")

        def handle_endtag(self, tag):
            if tag.lower() in ("script", "style"):
                if self._skip_depth > 0:
                    self._skip_depth -= 1
                return
            if self._skip_depth == 0:
                self.result.append(f"</{tag}>")

        def handle_startendtag(self, tag, attrs):
            if self._skip_depth == 0 and tag.lower() not in ("script", "style"):
                self.result.append(self.get_starttag_text() or "")

        def handle_data(self, data):
            if self._skip_depth == 0:
                self.result.append(data)

        def handle_comment(self, data):
            if self._skip_depth == 0:
                self.result.append(f"<!--{data}-->")

    stripper = ScriptStyleStripper()
    stripper.feed(html)
    html = "".join(stripper.result)

    # Remove comments
    html = re.sub(r"<!--.*?-->", "", html, flags=re.DOTALL)

    # Convert common elements to markdown-like format
    html = re.sub(r"<h1[^>]*>(.*?)</h1>", r"# \1\n", html, flags=re.IGNORECASE)
    html = re.sub(r"<h2[^>]*>(.*?)</h2>", r"## \1\n", html, flags=re.IGNORECASE)
    html = re.sub(r"<h3[^>]*>(.*?)</h3>", r"### \1\n", html, flags=re.IGNORECASE)
    html = re.sub(r"<h4[^>]*>(.*?)</h4>", r"#### \1\n", html, flags=re.IGNORECASE)
    html = re.sub(r"<h5[^>]*>(.*?)</h5>", r"##### \1\n", html, flags=re.IGNORECASE)
    html = re.sub(r"<h6[^>]*>(.*?)</h6>", r"###### \1\n", html, flags=re.IGNORECASE)

    # Convert paragraphs and breaks
    html = re.sub(r"<p[^>]*>(.*?)</p>", r"\1\n\n", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)

    # Convert links
    html = re.sub(
        r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', r"[\2](\1)", html, flags=re.IGNORECASE
    )

    # Convert lists
    html = re.sub(r"<li[^>]*>(.*?)</li>", r"- \1\n", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<ul[^>]*>(.*?)</ul>", r"\1", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<ol[^>]*>(.*?)</ol>", r"\1", html, flags=re.DOTALL | re.IGNORECASE)

    # Convert code blocks
    html = re.sub(
        r"<pre[^>]*>(.*?)</pre>", r"```\n\1\n```\n", html, flags=re.DOTALL | re.IGNORECASE
    )
    html = re.sub(r"<code[^>]*>(.*?)</code>", r"`\1`", html, flags=re.IGNORECASE)

    # Remove remaining tags
    html = re.sub(r"<[^>]+>", "", html)

    # Decode HTML entities
    html = html_module.unescape(html)

    # Clean up whitespace
    html = re.sub(r"\n{3,}", "\n\n", html)
    html = re.sub(r" {2,}", " ", html)

    return html.strip()


def fetch_url_content(
    url: str, timeout: int = DEFAULT_TIMEOUT, max_chars: int = MAX_CHARS
) -> ResolvedResult | None:
    """
    Fetch content from a URL directly via HTTP.

    Returns ResolvedResult with extracted text content.
    """
    # Validate URL first
    validation = validate_url(url, timeout=timeout // 2)
    if not validation.is_valid:
        logger.warning(f"URL validation failed: {url} - {validation.error}")
        return None

    session = get_session()

    try:
        response = session.get(url, timeout=timeout, allow_redirects=True, verify=True)

        if response.status_code >= 400:
            logger.warning(f"HTTP {response.status_code} for {url}")
            return None

        content_type = response.headers.get("Content-Type", "")

        # Handle different content types
        if "application/json" in content_type:
            try:
                data = response.json()
                content = json.dumps(data, indent=2)
            except json.JSONDecodeError:
                content = response.text
        elif "text/" in content_type or "application/xml" in content_type:
            content = response.text
            # Extract text from HTML if needed
            if "text/html" in content_type:
                content = extract_text_from_html(content, url)
        else:
            # Binary content - just note the type
            content = f"[Binary content: {content_type}]"

        # Extract links for validation
        links = re.findall(r'href=["\']?(https?://[^"\'\s>]+)', response.text)
        validated_links = validate_links(links[:10])  # Validate first 10 links

        return ResolvedResult(
            source="direct_fetch",
            content=content[:max_chars],
            url=validation.final_url or url,
            validated_links=validated_links,
            metadata={
                "status_code": response.status_code,
                "content_type": content_type,
                "redirect_count": len(validation.redirect_chain),
            },
        )

    except requests.exceptions.Timeout:
        logger.error(f"Timeout fetching {url}")
        return None
    except requests.exceptions.SSLError:
        logger.error(f"SSL error for {url}")
        return None
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error for {url}: {e}")
        return None
    except Exception as e:
        logger.error(f"Error fetching {url}: {e}")
        return None


# ============================================================================
# llms.txt Support
# ============================================================================


def fetch_llms_txt(url: str) -> str | None:
    """
    Check for llms.txt file at the site root.
    Results are cached per origin domain with a 1-hour TTL to avoid
    probing the same domain on every call.
    """
    try:
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        llms_url = f"{base_url}/llms.txt"

        # Check cache first (keyed by origin, not full URL)
        cached = _get_from_cache(base_url, "llms_txt")
        if cached is not None:
            # cached can be {"found": False} or {"found": True, "content": "..."}
            if cached.get("found"):
                logger.debug(f"llms.txt cache hit for {base_url}")
                return str(cached.get("content", ""))
            else:
                logger.debug(f"llms.txt known-missing for {base_url}, skipping probe")
                return None

        logger.info(f"Checking for llms.txt at {llms_url}")
        session = get_session()
        response = session.get(llms_url, timeout=10, allow_redirects=True)

        if response.status_code == 200:
            content_type = response.headers.get("Content-Type", "")
            if "text" in content_type or "markdown" in content_type:
                logger.info(f"Found llms.txt at {llms_url}")
                _save_to_cache(
                    base_url, "llms_txt", {"found": True, "content": response.text}, ttl=3600
                )
                return response.text

        # Cache the miss so we don't probe again for 1 hour
        _save_to_cache(base_url, "llms_txt", {"found": False}, ttl=3600)
    except Exception as e:
        logger.debug(f"No llms.txt found: {e}")
    return None


# ============================================================================
# Provider Implementations
# ============================================================================


def resolve_with_jina(url: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    """
    Extract content from a URL using Jina Reader (r.jina.ai).
    Completely FREE - no API key required, 20 RPM without key.
    Returns clean markdown output.
    """
    cached = _get_from_cache(url, "jina")
    if cached:
        return ResolvedResult(**cached)

    if _is_rate_limited("jina"):
        logger.warning("Jina Reader is rate-limited, skipping")
        return None

    try:
        jina_url = f"https://r.jina.ai/{url}"
        logger.info(f"Using Jina Reader to extract: {url}")
        session = get_session()
        response = session.get(
            jina_url,
            timeout=DEFAULT_TIMEOUT,
            headers={"Accept": "text/markdown"},
        )

        if response.status_code == 429:
            logger.warning("Jina Reader rate limit hit")
            _set_rate_limit("jina", cooldown=60)
            return None

        if response.status_code != 200:
            logger.warning(f"Jina Reader returned status {response.status_code}")
            return None

        content = response.text.strip()
        if not content or len(content) < MIN_CHARS:
            return None

        # Extract links for validation
        links = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', content)
        validated_links = validate_links(links[:5])

        result = ResolvedResult(
            source="jina",
            content=content[:max_chars],
            url=url,
            validated_links=validated_links,
        )
        _save_to_cache(url, "jina", result.to_dict())
        return result

    except requests.exceptions.Timeout:
        logger.warning("Jina Reader request timed out")
        _set_rate_limit("jina", cooldown=30)
        return None
    except Exception as e:
        logger.error(f"Jina Reader failed: {e}")
        return None


def resolve_with_exa_mcp(
    query: str, max_chars: int = MAX_CHARS, num_results: int = 8
) -> ResolvedResult | None:
    """
    Resolve query using Exa MCP search - FREE, no API key required.

    Uses the Model Context Protocol (MCP) endpoint at https://mcp.exa.ai/mcp
    This is a free service that doesn't require authentication.

    Based on: https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/websearch.ts
    """
    cached = _get_from_cache(query, "exa_mcp")
    if cached:
        return ResolvedResult(**cached)

    if _is_rate_limited("exa_mcp"):
        logger.warning("Exa MCP is rate-limited, skipping")
        return None

    try:
        logger.info(f"Using Exa MCP to search: {query}")

        # MCP endpoint configuration
        MCP_BASE_URL = "https://mcp.exa.ai"
        MCP_ENDPOINT = "/mcp"
        TIMEOUT = 25  # seconds

        # Build JSON-RPC 2.0 request
        mcp_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "web_search_exa",
                "arguments": {
                    "query": query,
                    "numResults": num_results,
                    "type": "auto",
                    "livecrawl": "fallback",
                    "contextMaxCharacters": max_chars,
                },
            },
        }

        headers = {
            "accept": "application/json, text/event-stream",
            "content-type": "application/json",
        }

        session = get_session()

        try:
            response = session.post(
                f"{MCP_BASE_URL}{MCP_ENDPOINT}", json=mcp_request, headers=headers, timeout=TIMEOUT
            )

            if response.status_code != 200:
                logger.warning(f"Exa MCP returned status {response.status_code}")
                return None

            # Parse SSE response
            response_text = response.text
            content_text = None

            for line in response_text.split("\n"):
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])  # Remove "data: " prefix
                        if (
                            data.get("result")
                            and data["result"].get("content")
                            and len(data["result"]["content"]) > 0
                        ):
                            content_text = data["result"]["content"][0].get("text", "")
                            break
                    except json.JSONDecodeError:
                        continue

            if not content_text:
                logger.warning("Exa MCP returned no content")
                return None

            # Extract URLs from the content for validation
            urls = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', content_text)
            validated_links = validate_links(urls[:5])

            result = ResolvedResult(
                source="exa_mcp",
                content=content_text[:max_chars],
                query=query,
                validated_links=validated_links,
            )
            _save_to_cache(query, "exa_mcp", result.to_dict())
            return result

        except requests.exceptions.Timeout:
            logger.warning("Exa MCP request timed out")
            _set_rate_limit("exa_mcp", cooldown=30)
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Exa MCP request failed: {e}")
            return None

    except Exception as e:
        error_type = _detect_error_type(e)

        if error_type == ErrorType.RATE_LIMIT:
            logger.warning(f"Exa MCP rate limit hit: {e}")
            _set_rate_limit("exa_mcp", cooldown=60)
            return None
        else:
            logger.error(f"Exa MCP search failed: {e}")
            return None


def resolve_with_exa(query: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    """
    Resolve query using Exa search API.

    Exa provides AI-powered search with highlights for token-efficient results.
    Requires EXA_API_KEY environment variable.
    """
    cached = _get_from_cache(query, "exa")
    if cached:
        return ResolvedResult(**cached)

    if _is_rate_limited("exa"):
        logger.warning("Exa is rate-limited, skipping")
        return None

    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        logger.debug("EXA_API_KEY not set, skipping Exa")
        return None

    try:
        from exa_py import Exa

        client = Exa(api_key)
        results = client.search_and_contents(
            query, use_autoprompt=True, highlights=True, num_results=EXA_RESULTS
        )

        if not results or not results.results:
            return None

        content_parts = []
        urls = []
        for result in results.results:
            if hasattr(result, "highlight") and result.highlight:
                content_parts.append(result.highlight)
            elif hasattr(result, "text") and result.text:
                content_parts.append(result.text)
            if hasattr(result, "url"):
                urls.append(result.url)

        content = "\n\n---\n\n".join(content_parts)[:max_chars]

        # Validate returned URLs
        validated_links = validate_links(urls[:5])

        result = ResolvedResult(
            source="exa", content=content, query=query, validated_links=validated_links
        )
        _save_to_cache(query, "exa", result.to_dict())
        return result

    except ImportError:
        logger.warning("exa-py not installed. Install with: pip install exa-py")
        return None
    except Exception as e:
        error_type = _detect_error_type(e)

        if error_type == ErrorType.RATE_LIMIT:
            logger.warning(f"Exa rate limit hit: {e}")
            _set_rate_limit("exa", cooldown=60)
            return None
        elif error_type == ErrorType.AUTH_ERROR:
            logger.error(f"Exa authentication failed: {e}")
            return None
        elif error_type == ErrorType.QUOTA_EXHAUSTED:
            logger.warning(f"Exa quota exhausted: {e}")
            return None
        else:
            logger.error(f"Exa search failed: {e}")
            return None


def resolve_with_tavily(query: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    """
    Resolve query using Tavily search API.

    Tavily provides comprehensive search results optimized for AI applications.
    Requires TAVILY_API_KEY environment variable.
    """
    cached = _get_from_cache(query, "tavily")
    if cached:
        return ResolvedResult(**cached)

    if _is_rate_limited("tavily"):
        logger.warning("Tavily is rate-limited, skipping")
        return None

    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        logger.debug("TAVILY_API_KEY not set, skipping Tavily")
        return None

    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=api_key)
        results = client.search(query, max_results=TAVILY_RESULTS)

        if not results or not results.get("results"):
            return None

        content_parts = [f"# Search Results for: {query}\n"]
        urls = []
        for r in results["results"]:
            title = r.get("title", "")
            content = r.get("content", "")
            url = r.get("url", "")
            if title:
                content_parts.append(f"## {title}\n\n{content}\n\nSource: {url}")
                urls.append(url)

        content = "\n\n---\n\n".join(content_parts)[:max_chars]

        # Validate returned URLs
        validated_links = validate_links(urls[:5])

        result = ResolvedResult(
            source="tavily", content=content, query=query, validated_links=validated_links
        )
        _save_to_cache(query, "tavily", result.to_dict())
        return result

    except ImportError:
        logger.warning("tavily-python not installed. Install with: pip install tavily-python")
        return None
    except Exception as e:
        error_type = _detect_error_type(e)

        if error_type == ErrorType.RATE_LIMIT:
            logger.warning(f"Tavily rate limit hit: {e}")
            _set_rate_limit("tavily", cooldown=60)
            return None
        elif error_type == ErrorType.AUTH_ERROR:
            logger.error(f"Tavily authentication failed: {e}")
            return None
        elif error_type == ErrorType.QUOTA_EXHAUSTED:
            logger.warning(f"Tavily quota exhausted: {e}")
            return None
        else:
            logger.error(f"Tavily search failed: {e}")
            return None


def resolve_with_serper(query: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    """
    Resolve query using Serper.dev API (Google Search).
    Requires SERPER_API_KEY environment variable.
    """
    cached = _get_from_cache(query, "serper")
    if cached:
        return ResolvedResult(**cached)

    if _is_rate_limited("serper"):
        logger.warning("Serper is rate-limited, skipping")
        return None

    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        logger.debug("SERPER_API_KEY not set, skipping Serper")
        return None

    try:
        logger.info(f"Using Serper to search: {query}")

        response = requests.post(
            "https://google.serper.dev/search",
            headers={
                "X-API-KEY": api_key,
                "Content-Type": "application/json",
            },
            json={
                "q": query,
                "num": DDG_RESULTS,
            },
            timeout=DEFAULT_TIMEOUT,
        )

        if response.status_code == 429:
            logger.warning("Serper rate limit hit")
            _set_rate_limit("serper", cooldown=60)
            return None

        if response.status_code in (401, 403):
            logger.error("Serper API key invalid")
            return None

        response.raise_for_status()
        data = response.json()

        organic_results = data.get("organic", [])
        if not organic_results:
            return None

        content_parts = [f"# Search Results for: {query}\n"]
        urls = []
        for r in organic_results:
            title = r.get("title", "")
            snippet = r.get("snippet", "")
            link = r.get("link", "")
            if link:
                content_parts.append(f"## {title}\n\n{snippet}\n\nSource: {link}")
                urls.append(link)

        content = "\n\n---\n\n".join(content_parts)[:max_chars]

        # Validate returned URLs
        validated_links = validate_links(urls[:5])

        result = ResolvedResult(
            source="serper",
            content=content,
            url=urls[0] if urls else None,
            query=query,
            validated_links=validated_links,
        )
        _save_to_cache(query, "serper", result.to_dict())
        return result

    except Exception as e:
        error_type = _detect_error_type(e)

        if error_type == ErrorType.RATE_LIMIT:
            logger.warning(f"Serper rate limit hit: {e}")
            _set_rate_limit("serper", cooldown=60)
            return None
        else:
            logger.error(f"Serper search failed: {e}")
            return None


def resolve_with_duckduckgo(
    query: str, max_chars: int = MAX_CHARS, retries: int = 2
) -> ResolvedResult | None:
    """
    Resolve query using DuckDuckGo search - FREE, no API key required.

    This is the primary fallback when no API keys are available.
    Always available and works without authentication.

    Args:
        query: Search query string
        max_chars: Maximum characters in result
        retries: Number of retry attempts on transient failures
    """
    cached = _get_from_cache(query, "duckduckgo")
    if cached:
        return ResolvedResult(**cached)

    if _is_rate_limited("duckduckgo"):
        logger.warning("DuckDuckGo is rate-limited, skipping")
        return None

    last_error = None
    for attempt in range(retries + 1):
        try:
            from duckduckgo_search import DDGS

            logger.info(f"Using DuckDuckGo to search: {query}")

            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=DDG_RESULTS))

            if not results:
                return None

            content_parts = [f"# Search Results for: {query}\n"]
            urls = []
            for r in results:
                title = r.get("title", "")
                body = r.get("body", "")
                href = r.get("href", "")
                if title:
                    content_parts.append(f"## {title}\n\n{body}\n\nSource: {href}")
                    urls.append(href)

            content = "\n\n---\n\n".join(content_parts)[:max_chars]

            # Validate returned URLs
            validated_links = validate_links(urls[:5])

            result = ResolvedResult(
                source="duckduckgo", content=content, query=query, validated_links=validated_links
            )
            _save_to_cache(query, "duckduckgo", result.to_dict())
            return result

        except ImportError:
            logger.warning(
                "duckduckgo_search not installed. Install with: pip install duckduckgo-search"
            )
            return None
        except Exception as e:
            error_type = _detect_error_type(e)
            last_error = e

            if error_type == ErrorType.RATE_LIMIT:
                logger.warning(f"DuckDuckGo rate limit hit: {e}")
                _set_rate_limit("duckduckgo", cooldown=30)
                return None
            elif error_type == ErrorType.NETWORK_ERROR or error_type == ErrorType.TIMEOUT:
                # Retry on transient errors
                if attempt < retries:
                    wait_time = 2**attempt  # Exponential backoff
                    logger.warning(
                        f"DuckDuckGo transient error (attempt {attempt + 1}/{retries + 1}): {e}. Retrying in {wait_time}s..."
                    )
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"DuckDuckGo search failed after {retries + 1} attempts: {e}")
                    return None
            else:
                logger.error(f"DuckDuckGo search failed: {e}")
                return None

    logger.error(f"DuckDuckGo search failed after all retries: {last_error}")
    return None


def resolve_with_firecrawl(url: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    """
    Extract content from URL using Firecrawl API.

    Firecrawl provides deep content extraction with markdown output.
    Requires FIRECRAWL_API_KEY environment variable.
    """
    cached = _get_from_cache(url, "firecrawl")
    if cached:
        return ResolvedResult(**cached)

    if _is_rate_limited("firecrawl"):
        logger.warning("Firecrawl is rate-limited, skipping")
        return None

    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        logger.debug("FIRECRAWL_API_KEY not set, skipping Firecrawl")
        return None

    # Validate URL first
    validation = validate_url(url)
    if not validation.is_valid:
        logger.warning(f"Invalid URL for Firecrawl: {url} - {validation.error}")
        return None

    try:
        from firecrawl import Firecrawl

        app = Firecrawl(api_key=api_key)
        logger.info(f"Using Firecrawl to extract: {url}")

        result = app.scrape(url, formats=["markdown"])
        markdown = ""
        if result and hasattr(result, "markdown"):
            markdown = result.markdown or ""

        # Extract links for validation
        links = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', markdown)
        validated_links = validate_links(links[:5])

        result = ResolvedResult(
            source="firecrawl",
            content=markdown[:max_chars],
            url=validation.final_url or url,
            metadata={"original_url": url},
            validated_links=validated_links,
        )
        _save_to_cache(url, "firecrawl", result.to_dict())
        return result

    except ImportError:
        logger.warning("firecrawl not installed. Install with: pip install firecrawl-py")
        return None
    except Exception as e:
        error_type = _detect_error_type(e)

        if error_type == ErrorType.RATE_LIMIT:
            logger.warning(f"Firecrawl rate limit exceeded: {e}")
            _set_rate_limit("firecrawl", cooldown=60)
            return None

        if error_type == ErrorType.QUOTA_EXHAUSTED:
            logger.warning(f"Firecrawl credits exhausted: {e}")
            return None

        if error_type == ErrorType.AUTH_ERROR:
            logger.error(f"Firecrawl authentication failed: {e}")
            return None

        logger.error(f"Firecrawl extraction failed: {e}")
        return None


def resolve_with_mistral_browser(url: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    """
    Extract content from URL using Mistral's agent-browser capability.

    Mistral provides AI-powered content extraction as a fallback.
    Requires MISTRAL_API_KEY environment variable.
    """
    cached = _get_from_cache(url, "mistral_browser")
    if cached:
        return ResolvedResult(**cached)

    if _is_rate_limited("mistral"):
        logger.warning("Mistral is rate-limited, skipping")
        return None

    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        logger.debug("MISTRAL_API_KEY not set, skipping Mistral browser")
        return None

    # Validate URL first
    validation = validate_url(url)
    if not validation.is_valid:
        logger.warning(f"Invalid URL for Mistral: {url} - {validation.error}")
        return None

    try:
        from mistralai.client import Mistral
        from mistralai.client.models import UserMessage, WebSearchTool

        client = Mistral(api_key=api_key)
        logger.info(f"Using Mistral agent-browser to extract: {url}")

        # Use Mistral's agent-browser capability for content extraction
        response = client.beta.conversations.start(
            inputs=UserMessage(
                content=f"Extract and summarize the main content from this URL: {url}. Return the content in markdown format."
            ),
            tools=[WebSearchTool()],
        )

        if response and hasattr(response, "outputs") and response.outputs:
            content = response.outputs[0].content if response.outputs[0] else ""  # type: ignore[union-attr]
        else:
            content = ""

        # Extract links for validation
        links = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', str(content))
        validated_links = validate_links(links[:5])

        result = ResolvedResult(
            source="mistral-browser",
            content=content[:max_chars],  # type: ignore[arg-type]
            url=validation.final_url or url,
            metadata={"original_url": url},
            validated_links=validated_links,
        )
        _save_to_cache(url, "mistral_browser", result.to_dict())
        return result

    except ImportError:
        logger.warning("mistralai not installed. Install with: pip install mistralai")
        return None
    except Exception as e:
        error_type = _detect_error_type(e)

        if error_type == ErrorType.RATE_LIMIT:
            logger.warning(f"Mistral rate limit exceeded: {e}")
            _set_rate_limit("mistral", cooldown=60)
            return None

        if error_type == ErrorType.QUOTA_EXHAUSTED:
            logger.warning(f"Mistral quota exhausted: {e}")
            return None

        if error_type == ErrorType.AUTH_ERROR:
            logger.error(f"Mistral authentication failed: {e}")
            return None

        logger.error(f"Mistral browser extraction failed: {e}")
        return None


def resolve_with_mistral_websearch(query: str, max_chars: int = MAX_CHARS) -> ResolvedResult | None:
    """
    Search using Mistral's web search capability.

    Mistral provides AI-powered web search as a fallback.
    Requires MISTRAL_API_KEY environment variable.
    """
    cached = _get_from_cache(query, "mistral_websearch")
    if cached:
        return ResolvedResult(**cached)

    if _is_rate_limited("mistral"):
        logger.warning("Mistral is rate-limited, skipping")
        return None

    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        logger.debug("MISTRAL_API_KEY not set, skipping Mistral websearch")
        return None

    try:
        from mistralai.client import Mistral
        from mistralai.client.models import UserMessage

        client = Mistral(api_key=api_key)
        logger.info(f"Using Mistral web search for: {query}")

        # Use Mistral's chat API - the model will use its built-in web search capability
        response = client.chat.complete(
            model="mistral-large-latest",
            messages=[
                UserMessage(
                    content=f"Search the web for: {query}. Provide comprehensive results with sources and URLs. Format the response as markdown with clear sections."
                )
            ],
        )

        if response and response.choices and len(response.choices) > 0:
            content = response.choices[0].message.content or ""
        else:
            content = ""

        # Extract links for validation
        links = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', str(content))
        validated_links = validate_links(links[:5])

        result = ResolvedResult(
            source="mistral-websearch",
            content=content[:max_chars],  # type: ignore[arg-type]
            query=query,
            validated_links=validated_links,
        )
        _save_to_cache(query, "mistral_websearch", result.to_dict())
        return result

    except ImportError:
        logger.warning("mistralai not installed. Install with: pip install mistralai")
        return None
    except Exception as e:
        error_type = _detect_error_type(e)

        if error_type == ErrorType.RATE_LIMIT:
            logger.warning(f"Mistral rate limit exceeded: {e}")
            _set_rate_limit("mistral", cooldown=60)
            return None

        if error_type == ErrorType.QUOTA_EXHAUSTED:
            logger.warning(f"Mistral quota exhausted: {e}")
            return None

        if error_type == ErrorType.AUTH_ERROR:
            logger.error(f"Mistral authentication failed: {e}")
            return None

        logger.error(f"Mistral web search failed: {e}")
        return None


# ============================================================================
# Main Resolution Functions
# ============================================================================


def resolve_with_docling(url: str, max_chars: int) -> ResolvedResult | None:
    """Extract content from document using docling CLI if available."""
    try:
        logger.info(f"Attempting docling for: {url}")
        result = subprocess.run(
            ["docling", "--format", "markdown", url],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            return ResolvedResult(
                source="docling",
                content=result.stdout[:max_chars],
                url=url,
            )
    except Exception as e:
        logger.debug(f"Docling failed: {e}")
    return None


def resolve_with_ocr(url: str, max_chars: int) -> ResolvedResult | None:
    """Extract text from image using tesseract or surya CLI."""
    # Try tesseract
    try:
        logger.info(f"Attempting tesseract OCR for: {url}")
        result = subprocess.run(
            ["tesseract", url, "stdout"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            return ResolvedResult(
                source="ocr-tesseract",
                content=result.stdout[:max_chars],
                url=url,
            )
    except Exception:
        pass

    # Try surya
    try:
        logger.info(f"Attempting surya OCR for: {url}")
        result = subprocess.run(
            ["surya_ocr", url],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            return ResolvedResult(
                source="ocr-surya",
                content=result.stdout[:max_chars],
                url=url,
            )
    except Exception:
        pass

    return None


def resolve_url(
    url: str, max_chars: int = MAX_CHARS, profile: Profile = Profile.BALANCED
) -> dict[str, Any]:
    """
    Resolve a URL using the cascade: llms.txt → Jina Reader → Firecrawl → Direct fetch → Mistral browser → DuckDuckGo search.
    """
    logger.info(f"Resolving URL: {url}")
    hops = 0
    max_hops = profile.max_hops()
    metrics = ResolveMetrics()

    # Document/Image format check first
    lower_url = url.lower()
    if any(lower_url.endswith(ext) for ext in [".pdf", ".docx", ".pptx"]):
        doc_res = resolve_with_docling(url, max_chars)
        if doc_res:
            metrics.record_provider(ProviderType.DOCLING, 0, True)
            doc_res.metrics = metrics
            return doc_res.to_dict()

    if any(lower_url.endswith(ext) for ext in [".png", ".jpg", ".jpeg"]):
        ocr_res = resolve_with_ocr(url, max_chars)
        if ocr_res:
            metrics.record_provider(ProviderType.OCR, 0, True)
            ocr_res.metrics = metrics
            return ocr_res.to_dict()

    llms_content = None
    jina_result = None
    firecrawl_result = None
    direct_result = None
    mistral_result = None
    ddg_result = None
    latency = 0

    # Step 1: Check for llms.txt
    if profile.is_provider_allowed(ProviderType.LLMS_TXT):
        hops += 1
        metrics.cascade_depth = hops
        start = time.time()
        llms_content = fetch_llms_txt(url)
        latency = int((time.time() - start) * 1000)
    if llms_content:
        metrics.record_provider(ProviderType.LLMS_TXT, latency, True)
        compacted = compact_content(llms_content, max_chars)
        return {
            "source": "llms.txt",
            "url": url,
            "content": compacted,
            "validated_links": [],
            "metrics": asdict(metrics),
        }
    else:
        if profile.is_provider_allowed(ProviderType.LLMS_TXT):
            metrics.record_provider(ProviderType.LLMS_TXT, latency, False)

    # Step 2: Try Jina Reader (FREE, no API key required)
    if hops < max_hops and profile.is_provider_allowed(ProviderType.JINA):
        hops += 1
        metrics.cascade_depth = hops
        start = time.time()
        jina_result = resolve_with_jina(url, max_chars)
        latency = int((time.time() - start) * 1000)
        if jina_result:
            metrics.record_provider(ProviderType.JINA, latency, True)
            jina_result.content = compact_content(jina_result.content, max_chars)
            jina_result.score = score_result(jina_result.url or url, jina_result.content)
            jina_result.metrics = metrics
            return jina_result.to_dict()
        else:
            metrics.record_provider(ProviderType.JINA, latency, False)

    # Step 3: Try Firecrawl (if API key available)
    if hops < max_hops and profile.is_provider_allowed(ProviderType.FIRECRAWL):
        hops += 1
        metrics.cascade_depth = hops
        start = time.time()
        firecrawl_result = resolve_with_firecrawl(url, max_chars)
        latency = int((time.time() - start) * 1000)
        if firecrawl_result:
            metrics.record_provider(ProviderType.FIRECRAWL, latency, True)
            firecrawl_result.content = compact_content(firecrawl_result.content, max_chars)
            firecrawl_result.score = score_result(firecrawl_result.url or url, firecrawl_result.content)
            firecrawl_result.metrics = metrics
            return firecrawl_result.to_dict()
        else:
            metrics.record_provider(ProviderType.FIRECRAWL, latency, False)

    # Step 4: Try direct HTTP fetch
    if hops < max_hops and profile.is_provider_allowed(ProviderType.DIRECT_FETCH):
        hops += 1
        metrics.cascade_depth = hops
        start = time.time()
        direct_result = fetch_url_content(url, max_chars=max_chars)
        latency = int((time.time() - start) * 1000)
        if direct_result:
            metrics.record_provider(ProviderType.DIRECT_FETCH, latency, True)
            direct_result.content = compact_content(direct_result.content, max_chars)
            direct_result.score = score_result(direct_result.url or url, direct_result.content)
            direct_result.metrics = metrics
            return direct_result.to_dict()
        else:
            metrics.record_provider(ProviderType.DIRECT_FETCH, latency, False)

    # Step 5: Try Mistral browser (if API key available)
    if hops < max_hops and profile.is_provider_allowed(ProviderType.MISTRAL_BROWSER):
        hops += 1
        metrics.cascade_depth = hops
        start = time.time()
        mistral_result = resolve_with_mistral_browser(url, max_chars)
        latency = int((time.time() - start) * 1000)
        if mistral_result:
            metrics.record_provider(ProviderType.MISTRAL_BROWSER, latency, True)
            mistral_result.content = compact_content(mistral_result.content, max_chars)
            mistral_result.score = score_result(mistral_result.url or url, mistral_result.content)
            mistral_result.metrics = metrics
            return mistral_result.to_dict()
        else:
            metrics.record_provider(ProviderType.MISTRAL_BROWSER, latency, False)

    # Step 6: Fall back to DuckDuckGo search for the URL
    if hops < max_hops and profile.is_provider_allowed(ProviderType.DUCKDUCKGO):
        hops += 1
        metrics.cascade_depth = hops
        start = time.time()
        ddg_result = resolve_with_duckduckgo(url, max_chars)
        latency = int((time.time() - start) * 1000)
        if ddg_result:
            metrics.record_provider(ProviderType.DUCKDUCKGO, latency, True)
            ddg_result.content = compact_content(ddg_result.content, max_chars)
            ddg_result.score = score_result(ddg_result.url or url, ddg_result.content)
            ddg_result.metrics = metrics
            return ddg_result.to_dict()
        else:
            metrics.record_provider(ProviderType.DUCKDUCKGO, latency, False)

    # All methods failed
    return {
        "source": "none",
        "url": url,
        "content": f"# Unable to resolve URL: {url}\n\nAll resolution methods failed. The URL may be inaccessible or require authentication.\n",
        "error": "No resolution method available",
        "validated_links": [],
    }


def resolve_query(
    query: str,
    max_chars: int = MAX_CHARS,
    skip_providers: set[str] | None = None,
    profile: Profile = Profile.BALANCED,
) -> dict[str, Any]:
    """
    Resolve a search query using the cascade: Exa MCP (free) → Exa SDK → Tavily → DuckDuckGo → Mistral websearch.

    Args:
        query: Search query string
        max_chars: Maximum characters in output
        skip_providers: Set of provider names to skip (e.g., {'exa_mcp', 'exa', 'tavily'})
        profile: Execution profile for resource management
    """
    skip_providers = skip_providers or set()
    logger.info(f"Resolving query: {query}")
    if skip_providers:
        logger.info(f"Skipping providers: {', '.join(skip_providers)}")

    hops = 0
    max_hops = profile.max_hops()
    metrics = ResolveMetrics()
    exa_mcp_result = None
    exa_result = None
    tavily_result = None
    ddg_result = None
    mistral_result = None

    # Step 1: Try Exa MCP (FREE, no API key required)
    if (
        "exa_mcp" not in skip_providers
        and hops < max_hops
        and profile.is_provider_allowed(ProviderType.EXA_MCP)
    ):
        hops += 1
        metrics.cascade_depth = hops
        start = time.time()
        exa_mcp_result = resolve_with_exa_mcp(query, max_chars)
        latency = int((time.time() - start) * 1000)
        if exa_mcp_result:
            metrics.record_provider(ProviderType.EXA_MCP, latency, True)
            exa_mcp_result.content = compact_content(exa_mcp_result.content, max_chars)
            exa_mcp_result.score = score_result(exa_mcp_result.url or "", exa_mcp_result.content)
            exa_mcp_result.metrics = metrics
            return exa_mcp_result.to_dict()
        else:
            metrics.record_provider(ProviderType.EXA_MCP, latency, False)

    # Step 2: Try Exa SDK (if API key available)
    if (
        "exa" not in skip_providers
        and hops < max_hops
        and profile.is_provider_allowed(ProviderType.EXA)
    ):
        hops += 1
        metrics.cascade_depth = hops
        start = time.time()
        exa_result = resolve_with_exa(query, max_chars)
        latency = int((time.time() - start) * 1000)
        if exa_result:
            metrics.record_provider(ProviderType.EXA, latency, True)
            exa_result.content = compact_content(exa_result.content, max_chars)
            exa_result.score = score_result(exa_result.url or "", exa_result.content)
            exa_result.metrics = metrics
            return exa_result.to_dict()
        else:
            metrics.record_provider(ProviderType.EXA, latency, False)

    # Step 3: Try Tavily (if API key available)
    if (
        "tavily" not in skip_providers
        and profile.is_provider_allowed(ProviderType.TAVILY)
    ):
        if hops < max_hops:
            hops += 1
            metrics.cascade_depth = hops
            start = time.time()
            tavily_result = resolve_with_tavily(query, max_chars)
            latency = int((time.time() - start) * 1000)
            if tavily_result:
                metrics.record_provider(ProviderType.TAVILY, latency, True)
                tavily_result.content = compact_content(tavily_result.content, max_chars)
                tavily_result.score = score_result(tavily_result.url or "", tavily_result.content)
                tavily_result.metrics = metrics
                return tavily_result.to_dict()
            else:
                metrics.record_provider(ProviderType.TAVILY, latency, False)

    # Step 4: Try Serper (if API key available)
    if (
        "serper" not in skip_providers
        and profile.is_provider_allowed(ProviderType.SERPER)
    ):
        if hops < max_hops:
            hops += 1
            metrics.cascade_depth = hops
            start = time.time()
            serper_result = resolve_with_serper(query, max_chars)
            latency = int((time.time() - start) * 1000)
            if serper_result:
                metrics.record_provider(ProviderType.SERPER, latency, True)
                serper_result.content = compact_content(serper_result.content, max_chars)
                serper_result.score = score_result(serper_result.url or "", serper_result.content)
                serper_result.metrics = metrics
                return serper_result.to_dict()
            else:
                metrics.record_provider(ProviderType.SERPER, latency, False)

    # Step 5: DuckDuckGo (always available, no API key required)
    if "duckduckgo" not in skip_providers and profile.is_provider_allowed(ProviderType.DUCKDUCKGO):
        if hops < max_hops:
            hops += 1
            metrics.cascade_depth = hops
            start = time.time()
            ddg_result = resolve_with_duckduckgo(query, max_chars)
            latency = int((time.time() - start) * 1000)
            if ddg_result:
                metrics.record_provider(ProviderType.DUCKDUCKGO, latency, True)
                ddg_result.content = compact_content(ddg_result.content, max_chars)
                ddg_result.score = score_result(ddg_result.url or "", ddg_result.content)
                # Ensure metrics correctly identifies this as a success record
                ddg_result.metrics = metrics
                return ddg_result.to_dict()
            else:
                metrics.record_provider(ProviderType.DUCKDUCKGO, latency, False)

    # Step 6: Try Mistral websearch (if API key available)
    if "mistral" not in skip_providers and profile.is_provider_allowed(ProviderType.MISTRAL_WEBSEARCH):
        if hops < max_hops:
            hops += 1
            metrics.cascade_depth = hops
            start = time.time()
            mistral_result = resolve_with_mistral_websearch(query, max_chars)
            latency = int((time.time() - start) * 1000)
            if mistral_result:
                metrics.record_provider(ProviderType.MISTRAL_WEBSEARCH, latency, True)
                mistral_result.content = compact_content(mistral_result.content, max_chars)
                mistral_result.score = score_result(mistral_result.url or "", mistral_result.content)
                mistral_result.metrics = metrics
                return mistral_result.to_dict()
            else:
                metrics.record_provider(ProviderType.MISTRAL_WEBSEARCH, latency, False)

    # All methods failed
    return {
        "source": "none",
        "query": query,
        "content": f"# Unable to resolve query: {query}\n\nAll search methods failed. DuckDuckGo should always work - check your network connection.\n",
        "error": "No resolution method available",
        "validated_links": [],
    }


def resolve(
    input_str: str,
    max_chars: int = MAX_CHARS,
    skip_providers: set[str] | None = None,
    profile: Profile = Profile.BALANCED,
) -> dict[str, Any]:
    """
    Main entry point - resolve a URL or query into LLM-ready markdown.

    Automatically detects if input is a URL or search query and uses
    the appropriate resolution cascade.

    Args:
        input_str: URL or search query to resolve
        max_chars: Maximum characters in output
        skip_providers: Set of provider names to skip (e.g., {'exa_mcp', 'exa', 'tavily'})
        profile: Execution profile for resource management
    """
    if is_url(input_str):
        return resolve_url(input_str, max_chars, profile=profile)
    else:
        return resolve_query(input_str, max_chars, skip_providers, profile=profile)


def resolve_direct(
    input_str: str,
    provider: ProviderType,
    max_chars: int = MAX_CHARS,
) -> dict[str, Any]:
    """
    Resolve a URL or query using a specific provider directly.

    Bypasses the cascade and uses only the specified provider.
    Useful when you know exactly which service you want to use.

    Args:
        input_str: URL or search query to resolve
        provider: Specific provider to use (ProviderType enum)
        max_chars: Maximum characters in output

    Returns:
        Resolution result dict with 'source', 'content', etc.

    Example:
        >>> from scripts.resolve import resolve_direct, ProviderType
        >>> result = resolve_direct("https://example.com", ProviderType.JINA)
        >>> result = resolve_direct("python tutorials", ProviderType.EXA_MCP)
    """
    logger.info(f"Resolving with direct provider: {provider.value}")

    # URL providers
    if provider == ProviderType.LLMS_TXT:
        if not is_url(input_str):
            return {
                "source": "none",
                "error": "llms_txt provider requires a URL input",
                "content": "",
                "validated_links": [],
            }
        llms_content = fetch_llms_txt(input_str)
        if llms_content:
            return {
                "source": "llms.txt",
                "url": input_str,
                "content": llms_content[:max_chars],
                "validated_links": [],
            }
        return {
            "source": "none",
            "url": input_str,
            "error": "No llms.txt found at origin",
            "content": "",
            "validated_links": [],
        }

    elif provider == ProviderType.JINA:
        if not is_url(input_str):
            return {
                "source": "none",
                "error": "jina provider requires a URL input",
                "content": "",
                "validated_links": [],
            }
        result = resolve_with_jina(input_str, max_chars)
        if result:
            return result.to_dict()
        return {
            "source": "none",
            "url": input_str,
            "error": "Jina Reader failed to extract content",
            "content": "",
            "validated_links": [],
        }

    elif provider == ProviderType.FIRECRAWL:
        if not is_url(input_str):
            return {
                "source": "none",
                "error": "firecrawl provider requires a URL input",
                "content": "",
                "validated_links": [],
            }
        result = resolve_with_firecrawl(input_str, max_chars)
        if result:
            return result.to_dict()
        return {
            "source": "none",
            "url": input_str,
            "error": "Firecrawl failed or API key not set",
            "content": "",
            "validated_links": [],
        }

    elif provider == ProviderType.DIRECT_FETCH:
        if not is_url(input_str):
            return {
                "source": "none",
                "error": "direct_fetch provider requires a URL input",
                "content": "",
                "validated_links": [],
            }
        result = fetch_url_content(input_str, max_chars=max_chars)
        if result:
            return result.to_dict()
        return {
            "source": "none",
            "url": input_str,
            "error": "Direct HTTP fetch failed",
            "content": "",
            "validated_links": [],
        }

    elif provider == ProviderType.MISTRAL_BROWSER:
        if not is_url(input_str):
            return {
                "source": "none",
                "error": "mistral_browser provider requires a URL input",
                "content": "",
                "validated_links": [],
            }
        result = resolve_with_mistral_browser(input_str, max_chars)
        if result:
            return result.to_dict()
        return {
            "source": "none",
            "url": input_str,
            "error": "Mistral browser failed or API key not set",
            "content": "",
            "validated_links": [],
        }

    # Query providers
    elif provider == ProviderType.EXA_MCP:
        result = resolve_with_exa_mcp(input_str, max_chars)
        if result:
            return result.to_dict()
        return {
            "source": "none",
            "query": input_str,
            "error": "Exa MCP search failed",
            "content": "",
            "validated_links": [],
        }

    elif provider == ProviderType.EXA:
        result = resolve_with_exa(input_str, max_chars)
        if result:
            return result.to_dict()
        return {
            "source": "none",
            "query": input_str,
            "error": "Exa SDK search failed or API key not set",
            "content": "",
            "validated_links": [],
        }

    elif provider == ProviderType.TAVILY:
        result = resolve_with_tavily(input_str, max_chars)
        if result:
            return result.to_dict()
        return {
            "source": "none",
            "query": input_str,
            "error": "Tavily search failed or API key not set",
            "content": "",
            "validated_links": [],
        }

    elif provider == ProviderType.SERPER:
        result = resolve_with_serper(input_str, max_chars)
        if result:
            return result.to_dict()
        return {
            "source": "none",
            "query": input_str,
            "error": "Serper search failed or API key not set",
            "content": "",
            "validated_links": [],
        }

    elif provider == ProviderType.DUCKDUCKGO:
        result = resolve_with_duckduckgo(input_str, max_chars)
        if result:
            return result.to_dict()
        return {
            "source": "none",
            "query": input_str,
            "error": "DuckDuckGo search failed",
            "content": "",
            "validated_links": [],
        }

    elif provider == ProviderType.MISTRAL_WEBSEARCH:
        result = resolve_with_mistral_websearch(input_str, max_chars)
        if result:
            return result.to_dict()
        return {
            "source": "none",
            "query": input_str,
            "error": "Mistral websearch failed or API key not set",
            "content": "",
            "validated_links": [],
        }

    else:
        return {
            "source": "none",
            "error": f"Unknown provider: {provider}",
            "content": "",
            "validated_links": [],
        }


def resolve_with_order(
    input_str: str,
    providers_order: list[ProviderType],
    max_chars: int = MAX_CHARS,
) -> dict[str, Any]:
    """
    Resolve a URL or query using a custom provider order.

    Allows overriding the default cascade order. Providers are tried
    in sequence until one succeeds.

    Args:
        input_str: URL or search query to resolve
        providers_order: List of providers to try in order (ProviderType enums)
        max_chars: Maximum characters in output

    Returns:
        Resolution result dict with 'source', 'content', etc.

    Example:
        >>> from scripts.resolve import resolve_with_order, ProviderType
        >>> # Use only free providers for URLs
        >>> result = resolve_with_order(
        ...     "https://example.com",
        ...     [ProviderType.LLMS_TXT, ProviderType.JINA, ProviderType.DIRECT_FETCH]
        ... )
        >>> # Use only free providers for queries
        >>> result = resolve_with_order(
        ...     "python tutorials",
        ...     [ProviderType.EXA_MCP, ProviderType.DUCKDUCKGO]
        ... )
    """
    logger.info(f"Resolving with custom provider order: {[p.value for p in providers_order]}")

    for provider in providers_order:
        result = resolve_direct(input_str, provider, max_chars)
        if result.get("source") != "none":
            return result

    # All providers failed
    is_url_input = is_url(input_str)
    return {
        "source": "none",
        "url": input_str if is_url_input else None,
        "query": None if is_url_input else input_str,
        "content": f"# Unable to resolve {'URL' if is_url_input else 'query'}: {input_str}\n\nAll specified providers failed.\n",
        "error": "No resolution method available",
        "validated_links": [],
    }


def resolve_url_with_order(
    url: str,
    providers_order: list[ProviderType],
    max_chars: int = MAX_CHARS,
) -> dict[str, Any]:
    """
    Resolve a URL using a custom provider order.

    Args:
        url: URL to resolve
        providers_order: List of URL providers to try in order
        max_chars: Maximum characters in output

    Returns:
        Resolution result dict
    """
    # Filter to only URL-compatible providers
    url_providers = {
        ProviderType.LLMS_TXT,
        ProviderType.JINA,
        ProviderType.FIRECRAWL,
        ProviderType.DIRECT_FETCH,
        ProviderType.MISTRAL_BROWSER,
        ProviderType.DUCKDUCKGO,  # Can search for URLs too
    }
    valid_providers = [p for p in providers_order if p in url_providers]
    return resolve_with_order(url, valid_providers, max_chars)


def resolve_query_with_order(
    query: str,
    providers_order: list[ProviderType],
    max_chars: int = MAX_CHARS,
) -> dict[str, Any]:
    """
    Resolve a query using a custom provider order.

    Args:
        query: Search query to resolve
        providers_order: List of query providers to try in order
        max_chars: Maximum characters in output

    Returns:
        Resolution result dict
    """
    # Filter to only query-compatible providers
    query_providers = {
        ProviderType.EXA_MCP,
        ProviderType.EXA,
        ProviderType.TAVILY,
        ProviderType.DUCKDUCKGO,
        ProviderType.MISTRAL_WEBSEARCH,
    }
    valid_providers = [p for p in providers_order if p in query_providers]
    return resolve_with_order(query, valid_providers, max_chars)


def main():
    """Command-line interface for the resolver."""
    parser = argparse.ArgumentParser(
        description="Deep Research Resolver - Resolve queries or URLs into LLM-ready markdown"
    )
    parser.add_argument("input", nargs="?", help="URL or search query to resolve")
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
    parser.add_argument("--metrics-json", action="store_true", help="Output metrics as JSON")
    parser.add_argument("--metrics-file", type=str, help="Save metrics to file")
    parser.add_argument("--validate-links", action="store_true", help="Validate all returned links")
    parser.add_argument(
        "--skip",
        action="append",
        choices=["exa_mcp", "exa", "tavily", "duckduckgo", "mistral"],
        help="Skip specific providers (can be used multiple times). Options: exa_mcp, exa, tavily, duckduckgo, mistral",
    )
    parser.add_argument(
        "--provider",
        type=str,
        choices=[p.value for p in ProviderType],
        help="Use a specific provider directly (bypasses cascade). Options: llms_txt, jina, firecrawl, direct_fetch, mistral_browser, exa_mcp, exa, tavily, duckduckgo, mistral_websearch",
    )
    parser.add_argument(
        "--providers-order",
        type=str,
        help="Custom provider order (comma-separated). Example: 'llms_txt,jina,direct_fetch' for URLs or 'exa_mcp,duckduckgo' for queries",
    )
    parser.add_argument(
        "--profile",
        type=str,
        choices=[p.value for p in Profile],
        default="balanced",
        help="Execution profile (default: balanced)",
    )
    parser.add_argument(
        "--synthesize",
        action="store_true",
        help="Synthesize multiple results using AI",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    if not args.input:
        parser.error("Provide input argument or use - for stdin")

    skip_providers = set(args.skip) if args.skip else None

    # Parse provider order if specified
    providers_order = None
    if args.providers_order:
        provider_names = [p.strip() for p in args.providers_order.split(",")]
        try:
            providers_order = [ProviderType(p) for p in provider_names]
        except ValueError as e:
            parser.error(f"Invalid provider in --providers-order: {e}")

    # Parse single provider if specified
    single_provider = None
    if args.provider:
        single_provider = ProviderType(args.provider)

    profile = Profile(args.profile)

    def process_input(inp: str) -> dict[str, Any]:
        """Process a single input string."""
        if args.synthesize:
            # Simple aggregation for Python script
            results = []
            if is_url(inp):
                results.append(resolve_url(inp, args.max_chars, profile=profile))
            else:
                # Aggregate from multiple query providers
                for pt in [ProviderType.EXA_MCP, ProviderType.EXA, ProviderType.TAVILY]:
                    if skip_providers and pt.value in skip_providers:
                        continue
                    res = resolve_direct(inp, pt, args.max_chars)
                    if res.get("source") != "none":
                        results.append(res)
                    if len(results) >= 3:
                        break

            if not results:
                return {"source": "none", "content": "No results to synthesize", "error": "No results"}

            # AI synthesis if MISTRAL_API_KEY is available
            api_key = os.getenv("MISTRAL_API_KEY")
            model = os.getenv("WDR_SYNTHESIS_MODEL", "mistral-large-latest")
            if api_key:
                content = synthesize_results(inp, results, api_key, model)
                source = "synthesis"
            else:
                # Fallback to concatenated results
                content = "\n\n---\n\n".join([r.get("content", "") for r in results])
                source = "aggregated"

            return {
                "source": source,
                "content": content,
                "metadata": {"count": len(results)},
            }

        if single_provider:
            return resolve_direct(inp, single_provider, args.max_chars)
        elif providers_order:
            return resolve_with_order(inp, providers_order, args.max_chars)
        else:
            return resolve(inp, args.max_chars, skip_providers, profile=profile)

    if args.input == "-":
        inputs = [line.strip() for line in sys.stdin if line.strip()]
        for i, inp in enumerate(inputs):
            result = process_input(inp)
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(result.get("content", ""))
                if "error" in result:
                    print(f"\n---\nError: {result['error']}", file=sys.stderr)
                if result.get("validated_links"):
                    print(
                        f"\n---\nValidated links: {', '.join(result['validated_links'])}",
                        file=sys.stderr,
                    )
            if i < len(inputs) - 1:
                print("\n" + "=" * 40 + "\n")
    else:
        result = process_input(args.input)

        if args.metrics_json and result.get("metrics"):
            print(json.dumps(result["metrics"], indent=2))
        if args.metrics_file and result.get("metrics"):
            with open(args.metrics_file, "w") as f:
                json.dump(result["metrics"], f, indent=2)

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(result.get("content", ""))
            if "error" in result:
                print(f"\n---\nError: {result['error']}", file=sys.stderr)
            if result.get("validated_links"):
                print(
                    f"\n---\nValidated links: {', '.join(result['validated_links'])}",
                    file=sys.stderr,
                )


if __name__ == "__main__":
    main()
