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

Cascade order for queries: Exa → Tavily → DuckDuckGo → Mistral
Cascade order for URLs: llms.txt → Firecrawl → Direct HTTP fetch → Mistral browser → DuckDuckGo
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
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional, Dict, Any, List, Set
from urllib.parse import urlparse
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# Configuration Constants (configurable via environment variables)
MAX_CHARS = int(os.getenv("WEB_RESOLVER_MAX_CHARS", "8000"))
MIN_CHARS = int(os.getenv("WEB_RESOLVER_MIN_CHARS", "200"))
MAX_CONTENT_SIZE = int(os.getenv("WEB_RESOLVER_MAX_CONTENT_SIZE", str(10 * 1024 * 1024)))  # 10MB default
DEFAULT_TIMEOUT = int(os.getenv("WEB_RESOLVER_TIMEOUT", "30"))
EXA_RESULTS = int(os.getenv("WEB_RESOLVER_EXA_RESULTS", "5"))
TAVILY_RESULTS = int(os.getenv("WEB_RESOLVER_TAVILY_RESULTS", "5"))
DDG_RESULTS = int(os.getenv("WEB_RESOLVER_DDG_RESULTS", "5"))
CACHE_DIR = os.path.expanduser(os.getenv("WEB_RESOLVER_CACHE_DIR", "~/.cache/web-doc-resolver"))
CACHE_TTL = int(os.getenv("WEB_RESOLVER_CACHE_TTL", str(3600 * 24)))  # 24 hours

# HTTP Configuration
MAX_RETRIES = 3
RETRY_BACKOFF_FACTOR = 1.0
USER_AGENT = "Mozilla/5.0 (compatible; WebDocResolver/2.0; +https://github.com/d-oit/web-doc-resolver)"

# SSRF Protection - Blocked IP ranges
BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # Localhost
    ipaddress.ip_network("10.0.0.0/8"),       # Private Class A
    ipaddress.ip_network("172.16.0.0/12"),    # Private Class B
    ipaddress.ip_network("192.168.0.0/16"),   # Private Class C
    ipaddress.ip_network("169.254.0.0/16"),   # Link-local
    ipaddress.ip_network("::1/128"),          # IPv6 localhost
    ipaddress.ip_network("fc00::/7"),         # IPv6 private
    ipaddress.ip_network("fe80::/10"),        # IPv6 link-local
]

# Blocked URL schemes (SSRF protection)
BLOCKED_SCHEMES: Set[str] = {"file", "javascript", "data", "vbscript"}

# Rate limit tracking
_rate_limits: Dict[str, float] = {}

# Global session for connection pooling
_global_session: Optional[requests.Session] = None

# Module exports
__all__ = [
    "resolve",
    "resolve_url",
    "resolve_query",
    "ResolvedResult",
    "ValidationResult",
    "ErrorType",
    "is_url",
    "validate_url",
    "validate_links",
    "fetch_url_content",
    "fetch_llms_txt",
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


@dataclass
class ValidationResult:
    """Result of URL validation."""
    is_valid: bool
    status_code: Optional[int] = None
    content_type: Optional[str] = None
    final_url: Optional[str] = None
    error: Optional[str] = None
    redirect_chain: List[str] = field(default_factory=list)


@dataclass
class ResolvedResult:
    """Result of a successful resolution."""
    source: str
    content: str
    url: Optional[str] = None
    query: Optional[str] = None
    score: float = 0.0
    validated_links: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
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
    
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    })
    
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
        
        if parsed.scheme not in ('http', 'https'):
            logger.warning(f"Invalid scheme in URL: {url}")
            return False
        
        # Get hostname
        hostname = parsed.netloc.split(':')[0]  # Remove port if present
        
        # Check for localhost variations
        if hostname.lower() in ('localhost', 'localhost.localdomain', '127.0.0.1', '::1', '0.0.0.0'):
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
                    for family, socktype, proto, canonname, sockaddr in infos:
                        ip_str = sockaddr[0]
                        ip = ipaddress.ip_address(ip_str)
                        if any(ip in network for network in BLOCKED_NETWORKS):
                            logger.warning(f"Blocked resolved private IP in URL: {url}")
                            return False
                except (socket.gaierror, socket.timeout):
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


def _detect_error_type(error: Exception) -> ErrorType:
    """Detect the type of error from an exception."""
    error_msg = str(error).lower()
    
    if any(code in error_msg for code in ["429", "rate limit", "too many requests", "rate_limit"]):
        return ErrorType.RATE_LIMIT
    if any(code in error_msg for code in ["401", "403", "unauthorized", "forbidden", "invalid api key", "invalid_key", "authentication"]):
        return ErrorType.AUTH_ERROR
    if any(code in error_msg for code in ["402", "payment", "credit", "quota", "insufficient", "exhausted", "limit exceeded"]):
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


def _get_from_cache(input_str: str, source: str) -> Optional[Dict[str, Any]]:
    """Get result from cache."""
    cache = _get_cache()
    if not cache:
        return None
    try:
        key = _cache_key(input_str, source)
        result = cache.get(key)
        if result and isinstance(result, dict):
            logger.debug(f"Cache hit for {source}:{input_str[:30]}...")
            return result
    except Exception as e:
        logger.debug(f"Cache read error: {e}")
    return None


def _save_to_cache(input_str: str, source: str, result: Dict[str, Any]):
    """Save result to cache."""
    cache = _get_cache()
    if not cache:
        return
    try:
        key = _cache_key(input_str, source)
        cache.set(key, result, expire=CACHE_TTL)
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
        return all([result.scheme in ('http', 'https', 'ftp', 'ftps'), result.netloc])
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
        response = session.head(
            url,
            timeout=timeout,
            allow_redirects=True,
            verify=True
        )
        
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
                error=f"HTTP {response.status_code}"
            )
        
        content_type = response.headers.get('Content-Type', '')
        
        return ValidationResult(
            is_valid=True,
            status_code=response.status_code,
            content_type=content_type,
            final_url=response.url,
            redirect_chain=redirect_chain
        )
        
    except requests.exceptions.Timeout:
        return ValidationResult(is_valid=False, error="Request timed out")
    except requests.exceptions.SSLError:
        return ValidationResult(is_valid=False, error="SSL certificate error")
    except requests.exceptions.ConnectionError as e:
        return ValidationResult(is_valid=False, error=f"Connection error: {str(e)[:100]}")
    except Exception as e:
        return ValidationResult(is_valid=False, error=f"Validation error: {str(e)[:100]}")


def validate_links(links: List[str], timeout: int = 5) -> List[str]:
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
            if parsed.scheme not in ('http', 'https'):
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

def extract_text_from_html(html: str, base_url: str = "") -> str:
    """
    Extract clean text content from HTML.
    
    Uses simple regex-based extraction for reliability.
    """
    # Remove script and style elements
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    
    # Remove comments
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    
    # Convert common elements to markdown-like format
    html = re.sub(r'<h1[^>]*>(.*?)</h1>', r'# \1\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<h2[^>]*>(.*?)</h2>', r'## \1\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<h3[^>]*>(.*?)</h3>', r'### \1\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<h4[^>]*>(.*?)</h4>', r'#### \1\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<h5[^>]*>(.*?)</h5>', r'##### \1\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<h6[^>]*>(.*?)</h6>', r'###### \1\n', html, flags=re.IGNORECASE)
    
    # Convert paragraphs and breaks
    html = re.sub(r'<p[^>]*>(.*?)</p>', r'\1\n\n', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    
    # Convert links
    html = re.sub(r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', r'[\2](\1)', html, flags=re.IGNORECASE)
    
    # Convert lists
    html = re.sub(r'<li[^>]*>(.*?)</li>', r'- \1\n', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<ul[^>]*>(.*?)</ul>', r'\1', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<ol[^>]*>(.*?)</ol>', r'\1', html, flags=re.DOTALL | re.IGNORECASE)
    
    # Convert code blocks
    html = re.sub(r'<pre[^>]*>(.*?)</pre>', r'```\n\1\n```\n', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<code[^>]*>(.*?)</code>', r'`\1`', html, flags=re.IGNORECASE)
    
    # Remove remaining tags
    html = re.sub(r'<[^>]+>', '', html)
    
    # Decode HTML entities
    html = html_module.unescape(html)
    
    # Clean up whitespace
    html = re.sub(r'\n{3,}', '\n\n', html)
    html = re.sub(r' {2,}', ' ', html)
    
    return html.strip()


def fetch_url_content(url: str, timeout: int = DEFAULT_TIMEOUT, max_chars: int = MAX_CHARS) -> Optional[ResolvedResult]:
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
        response = session.get(
            url,
            timeout=timeout,
            allow_redirects=True,
            verify=True
        )
        
        if response.status_code >= 400:
            logger.warning(f"HTTP {response.status_code} for {url}")
            return None
        
        content_type = response.headers.get('Content-Type', '')
        
        # Handle different content types
        if 'application/json' in content_type:
            try:
                data = response.json()
                content = json.dumps(data, indent=2)
            except json.JSONDecodeError:
                content = response.text
        elif 'text/' in content_type or 'application/xml' in content_type:
            content = response.text
            # Extract text from HTML if needed
            if 'text/html' in content_type:
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
                "redirect_count": len(validation.redirect_chain)
            }
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

def fetch_llms_txt(url: str) -> Optional[str]:
    """
    Check for llms.txt file at the site root.
    
    llms.txt is a proposed standard for LLM-readable documentation.
    """
    try:
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        llms_url = f"{base_url}/llms.txt"

        logger.info(f"Checking for llms.txt at {llms_url}")
        
        session = get_session()
        response = session.get(llms_url, timeout=10, allow_redirects=True)
        # session is managed globally

        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            if 'text' in content_type or 'markdown' in content_type:
                logger.info(f"Found llms.txt at {llms_url}")
                return response.text
    except Exception as e:
        logger.debug(f"No llms.txt found: {e}")
    return None


# ============================================================================
# Provider Implementations
# ============================================================================

def resolve_with_exa_mcp(query: str, max_chars: int = MAX_CHARS, num_results: int = 8) -> Optional[ResolvedResult]:
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
                    "contextMaxCharacters": max_chars
                }
            }
        }
        
        headers = {
            "accept": "application/json, text/event-stream",
            "content-type": "application/json",
        }
        
        session = get_session()
        
        try:
            response = session.post(
                f"{MCP_BASE_URL}{MCP_ENDPOINT}",
                json=mcp_request,
                headers=headers,
                timeout=TIMEOUT
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
                        if (data.get("result") and 
                            data["result"].get("content") and 
                            len(data["result"]["content"]) > 0):
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
                validated_links=validated_links
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


def resolve_with_exa(query: str, max_chars: int = MAX_CHARS) -> Optional[ResolvedResult]:
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
            query,
            use_autoprompt=True,
            highlights=True,
            num_results=EXA_RESULTS
        )

        if not results or not results.results:
            return None

        content_parts = []
        urls = []
        for result in results.results:
            if hasattr(result, 'highlight') and result.highlight:
                content_parts.append(result.highlight)
            elif hasattr(result, 'text') and result.text:
                content_parts.append(result.text)
            if hasattr(result, 'url'):
                urls.append(result.url)

        content = "\n\n---\n\n".join(content_parts)[:max_chars]
        
        # Validate returned URLs
        validated_links = validate_links(urls[:5])

        result = ResolvedResult(
            source="exa",
            content=content,
            query=query,
            validated_links=validated_links
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


def resolve_with_tavily(query: str, max_chars: int = MAX_CHARS) -> Optional[ResolvedResult]:
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
            source="tavily",
            content=content,
            query=query,
            validated_links=validated_links
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


def resolve_with_duckduckgo(query: str, max_chars: int = MAX_CHARS, retries: int = 2) -> Optional[ResolvedResult]:
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
            from ddgs import DDGS
            
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
                source="duckduckgo",
                content=content,
                query=query,
                validated_links=validated_links
            )
            _save_to_cache(query, "duckduckgo", result.to_dict())
            return result

        except ImportError:
            logger.warning("duckduckgo_search not installed. Install with: pip install duckduckgo-search")
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
                    wait_time = 2 ** attempt  # Exponential backoff
                    logger.warning(f"DuckDuckGo transient error (attempt {attempt + 1}/{retries + 1}): {e}. Retrying in {wait_time}s...")
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


def resolve_with_firecrawl(url: str, max_chars: int = MAX_CHARS) -> Optional[ResolvedResult]:
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
        if result and hasattr(result, 'markdown'):
            markdown = result.markdown or ""

        result = ResolvedResult(
            source="firecrawl",
            content=markdown[:max_chars],
            url=validation.final_url or url,
            metadata={"original_url": url}
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


def resolve_with_mistral_browser(url: str, max_chars: int = MAX_CHARS) -> Optional[ResolvedResult]:
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
        from mistralai import Mistral

        client = Mistral(api_key=api_key)
        logger.info(f"Using Mistral agent-browser to extract: {url}")

        # Use Mistral's agent-browser capability for content extraction
        response = client.beta.conversations.start(
            messages=[{
                "role": "user",
                "content": f"Extract and summarize the main content from this URL: {url}. Return the content in markdown format."
            }],
            tools=[{"type": "web_search"}],
        )

        if response and hasattr(response, 'outputs') and response.outputs:
            content = response.outputs[0].content if response.outputs[0] else ""
        else:
            content = ""

        result = ResolvedResult(
            source="mistral-browser",
            content=content[:max_chars],
            url=validation.final_url or url,
            metadata={"original_url": url}
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


def resolve_with_mistral_websearch(query: str, max_chars: int = MAX_CHARS) -> Optional[ResolvedResult]:
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
        from mistralai import Mistral

        client = Mistral(api_key=api_key)
        logger.info(f"Using Mistral web search for: {query}")

        # Use Mistral's web search capability
        response = client.beta.conversations.start(
            messages=[{
                "role": "user",
                "content": f"Search for: {query}. Provide comprehensive results with sources."
            }],
            tools=[{"type": "web_search"}],
        )

        if response and hasattr(response, 'outputs') and response.outputs:
            content = response.outputs[0].content if response.outputs[0] else ""
        else:
            content = ""

        result = ResolvedResult(
            source="mistral-websearch",
            content=content[:max_chars],
            query=query,
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

def resolve_url(url: str, max_chars: int = MAX_CHARS) -> Dict[str, Any]:
    """
    Resolve a URL using the cascade: llms.txt → Firecrawl → Direct fetch → Mistral browser → DuckDuckGo search.
    """
    logger.info(f"Resolving URL: {url}")
    
    # Step 1: Check for llms.txt
    llms_content = fetch_llms_txt(url)
    if llms_content:
        return {
            "source": "llms.txt",
            "url": url,
            "content": llms_content[:max_chars],
            "validated_links": [],
        }

    # Step 2: Try Firecrawl (if API key available)
    firecrawl_result = resolve_with_firecrawl(url, max_chars)
    if firecrawl_result:
        return firecrawl_result.to_dict()

    # Step 3: Try direct HTTP fetch
    direct_result = fetch_url_content(url, max_chars=max_chars)
    if direct_result:
        return direct_result.to_dict()

    # Step 4: Try Mistral browser (if API key available)
    mistral_result = resolve_with_mistral_browser(url, max_chars)
    if mistral_result:
        return mistral_result.to_dict()

    # Step 5: Fall back to DuckDuckGo search for the URL
    ddg_result = resolve_with_duckduckgo(url, max_chars)
    if ddg_result:
        return ddg_result.to_dict()

    # All methods failed
    return {
        "source": "none",
        "url": url,
        "content": f"# Unable to resolve URL: {url}\n\nAll resolution methods failed. The URL may be inaccessible or require authentication.\n",
        "error": "No resolution method available",
        "validated_links": [],
    }


def resolve_query(query: str, max_chars: int = MAX_CHARS) -> Dict[str, Any]:
    """
    Resolve a search query using the cascade: Exa MCP (free) → Exa SDK → Tavily → DuckDuckGo → Mistral websearch.
    """
    logger.info(f"Resolving query: {query}")
    
    # Step 1: Try Exa MCP (FREE, no API key required)
    exa_mcp_result = resolve_with_exa_mcp(query, max_chars)
    if exa_mcp_result:
        return exa_mcp_result.to_dict()

    # Step 2: Try Exa SDK (if API key available)
    exa_result = resolve_with_exa(query, max_chars)
    if exa_result:
        return exa_result.to_dict()

    # Step 3: Try Tavily (if API key available)
    tavily_result = resolve_with_tavily(query, max_chars)
    if tavily_result:
        return tavily_result.to_dict()

    # Step 4: DuckDuckGo (always available, no API key required)
    ddg_result = resolve_with_duckduckgo(query, max_chars)
    if ddg_result:
        return ddg_result.to_dict()

    # Step 5: Try Mistral websearch (if API key available)
    mistral_result = resolve_with_mistral_websearch(query, max_chars)
    if mistral_result:
        return mistral_result.to_dict()

    # All methods failed
    return {
        "source": "none",
        "query": query,
        "content": f"# Unable to resolve query: {query}\n\nAll search methods failed. DuckDuckGo should always work - check your network connection.\n",
        "error": "No resolution method available",
        "validated_links": [],
    }


def resolve(input_str: str, max_chars: int = MAX_CHARS) -> Dict[str, Any]:
    """
    Main entry point - resolve a URL or query into LLM-ready markdown.
    
    Automatically detects if input is a URL or search query and uses
    the appropriate resolution cascade.
    """
    if is_url(input_str):
        return resolve_url(input_str, max_chars)
    else:
        return resolve_query(input_str, max_chars)


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
    parser.add_argument("--validate-links", action="store_true", help="Validate all returned links")

    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    if not args.input:
        parser.error("Provide input argument or use - for stdin")

    if args.input == "-":
        inputs = [line.strip() for line in sys.stdin if line.strip()]
        for i, inp in enumerate(inputs):
            result = resolve(inp, args.max_chars)
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(result.get("content", ""))
                if "error" in result:
                    print(f"\n---\nError: {result['error']}", file=sys.stderr)
                if result.get("validated_links"):
                    print(f"\n---\nValidated links: {', '.join(result['validated_links'])}", file=sys.stderr)
            if i < len(inputs) - 1:
                print("\n" + "=" * 40 + "\n")
    else:
        result = resolve(args.input, args.max_chars)

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(result.get("content", ""))
            if "error" in result:
                print(f"\n---\nError: {result['error']}", file=sys.stderr)
            if result.get("validated_links"):
                print(f"\n---\nValidated links: {', '.join(result['validated_links'])}", file=sys.stderr)


if __name__ == "__main__":
    main()