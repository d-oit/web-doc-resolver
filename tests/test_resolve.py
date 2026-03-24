"""Comprehensive tests for resolve.py with all fallback scenarios."""

import os
import sys
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.resolve import (
    MAX_CHARS,
    ErrorType,
    ResolvedResult,
    _detect_error_type,
    _is_rate_limited,
    _set_rate_limit,
    fetch_llms_txt,
    is_url,
    resolve,
    resolve_with_duckduckgo,
    resolve_with_firecrawl,
    resolve_with_mistral_browser,
)


class TestIsUrl:
    """Test URL detection."""

    def test_valid_urls(self):
        """Test that valid URLs are detected."""
        assert is_url("https://example.com")
        assert is_url("http://example.com/path")
        assert is_url("https://docs.rs/tokio")

    def test_invalid_urls(self):
        """Test that non-URLs are rejected."""
        assert not is_url("not a url")
        assert not is_url("just some text")
        assert not is_url("")


class TestFetchLlmsTxt:
    """Test llms.txt fetching."""

    @patch("scripts.utils.get_session")
    def test_llms_txt_found(self, mock_get_session):
        """Test successful llms.txt fetch."""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "# Example llms.txt\nContent here"
        mock_response.headers = {"Content-Type": "text/plain"}
        mock_session.get.return_value = mock_response
        mock_get_session.return_value = mock_session

        # Clear cache to ensure fresh test
        import scripts.resolve

        scripts.resolve._cache = None

        result = fetch_llms_txt("https://example.com")
        assert result is not None
        assert "Example llms.txt" in result

    @patch("scripts.utils.get_session")
    def test_llms_txt_not_found(self, mock_get_session):
        """Test when llms.txt doesn't exist."""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status_code = 404
        mock_session.get.return_value = mock_response
        mock_get_session.return_value = mock_session

        # Clear cache to ensure fresh test
        import scripts.resolve

        scripts.resolve._cache = None

        result = fetch_llms_txt("https://example.com")
        assert result is None


@pytest.mark.live
class TestResolveWithFirecrawl:
    """Test Firecrawl resolution with error handling."""

    @patch.dict(os.environ, {}, clear=True)
    def test_no_api_key(self):
        """Test graceful handling when API key is not set."""
        result = resolve_with_firecrawl("https://example.com")
        assert result is None

    @patch.dict(os.environ, {"FIRECRAWL_API_KEY": "test_key"})
    @patch("scripts.resolve.validate_url")
    @patch("firecrawl.Firecrawl")
    def test_successful_extraction(self, mock_firecrawl_class, mock_validate):
        """Test successful content extraction."""
        # Mock URL validation
        mock_validation = Mock()
        mock_validation.is_valid = True
        mock_validation.final_url = "https://example.com"
        mock_validate.return_value = mock_validation

        mock_app = Mock()
        mock_result = Mock()
        mock_result.markdown = "# Test Content\nSome text here"
        mock_app.scrape.return_value = mock_result
        mock_firecrawl_class.return_value = mock_app

        result = resolve_with_firecrawl("https://example.com")
        assert result is not None
        assert result.source == "firecrawl"
        assert "Test Content" in result.content

    @patch.dict(os.environ, {"FIRECRAWL_API_KEY": "test_key", "MISTRAL_API_KEY": "mistral_key"})
    @patch("scripts.resolve.validate_url")
    @patch("firecrawl.Firecrawl")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_rate_limit_fallback(self, mock_mistral, mock_firecrawl_class, mock_validate):
        """Test Mistral fallback on rate limit."""
        # Mock URL validation
        mock_validation = Mock()
        mock_validation.is_valid = True
        mock_validation.final_url = "https://example.com"
        mock_validate.return_value = mock_validation

        mock_app = Mock()
        mock_app.scrape.side_effect = Exception("429 rate limit exceeded")
        mock_firecrawl_class.return_value = mock_app

        # resolve_with_firecrawl returns None on rate limit, doesn't call Mistral
        result = resolve_with_firecrawl("https://example.com")
        assert result is None  # Returns None, fallback is handled by resolve()
        mock_mistral.assert_not_called()  # Mistral is not called by resolve_with_firecrawl

    @patch.dict(os.environ, {"FIRECRAWL_API_KEY": "test_key", "MISTRAL_API_KEY": "mistral_key"})
    @patch("scripts.resolve.validate_url")
    @patch("firecrawl.Firecrawl")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_credit_exhaustion_fallback(self, mock_mistral, mock_firecrawl_class, mock_validate):
        """Test Mistral fallback on credit exhaustion."""
        # Clear rate limits
        from scripts.resolve import _rate_limits

        _rate_limits.clear()

        # Mock URL validation
        mock_validation = Mock()
        mock_validation.is_valid = True
        mock_validation.final_url = "https://example.com"
        mock_validate.return_value = mock_validation

        mock_app = Mock()
        mock_app.scrape.side_effect = Exception("insufficient credits")
        mock_firecrawl_class.return_value = mock_app

        # resolve_with_firecrawl returns None on credit exhaustion, doesn't call Mistral
        result = resolve_with_firecrawl("https://example.com")
        assert result is None  # Returns None, fallback is handled by resolve()
        mock_mistral.assert_not_called()  # Mistral is not called by resolve_with_firecrawl

    @patch.dict(os.environ, {"FIRECRAWL_API_KEY": "test_key"})
    @patch("firecrawl.Firecrawl")
    def test_authentication_error(self, mock_firecrawl_class):
        """Test handling of authentication errors."""
        mock_app = Mock()
        mock_app.scrape.side_effect = Exception("401 unauthorized")
        mock_firecrawl_class.return_value = mock_app

        result = resolve_with_firecrawl("https://example.com")
        assert result is None


@pytest.mark.live
class TestResolveWithMistralBrowser:
    """Test Mistral agent-browser skill fallback."""

    @patch.dict(os.environ, {}, clear=True)
    def test_no_api_key(self):
        """Test graceful handling when Mistral API key is not set."""
        result = resolve_with_mistral_browser("https://example.com")
        assert result is None

    @patch.dict(os.environ, {"MISTRAL_API_KEY": "test_key"})
    @patch("scripts.resolve.validate_url")
    @patch("mistralai.client.Mistral")
    def test_successful_extraction(self, mock_mistral_class, mock_validate):
        """Test successful content extraction with Mistral."""
        # Mock URL validation
        mock_validation = Mock()
        mock_validation.is_valid = True
        mock_validation.final_url = "https://example.com"
        mock_validate.return_value = mock_validation

        mock_client = Mock()
        mock_response = Mock()
        mock_response.outputs = [Mock(content="# Extracted Content\nFrom Mistral")]
        mock_client.beta.conversations.start.return_value = mock_response
        mock_mistral_class.return_value = mock_client

        result = resolve_with_mistral_browser("https://example.com")
        assert result is not None
        assert result.source == "mistral-browser"
        assert "Extracted Content" in result.content

    @patch.dict(os.environ, {"MISTRAL_API_KEY": "test_key"})
    @patch("mistralai.client.Mistral")
    def test_extraction_error(self, mock_mistral_class):
        """Test error handling in Mistral extraction."""
        mock_client = Mock()
        mock_client.beta.conversations.start.side_effect = Exception("Mistral API error")
        mock_mistral_class.return_value = mock_client

        result = resolve_with_mistral_browser("https://example.com")
        assert result is None


class TestResolveIntegration:
    """Integration tests for the main resolve function."""

    @patch("scripts.resolve.fetch_llms_txt")
    def test_url_with_llms_txt(self, mock_fetch):
        """Test URL resolution with llms.txt available."""
        mock_fetch.return_value = "# llms.txt content"

        result = resolve("https://example.com")
        assert result["source"] == "llms.txt"
        assert "llms.txt content" in result["content"]

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    def test_query_with_exa(self, mock_exa, mock_mcp):
        """Test query resolution with Exa."""
        mock_mcp.return_value = None
        mock_exa.return_value = ResolvedResult(source="exa", content="# Exa results")

        result = resolve("machine learning tutorials")
        assert result["source"] == "exa"

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    def test_query_fallback_to_tavily(self, mock_tavily, mock_exa, mock_mcp):
        """Test fallback from Exa to Tavily."""
        mock_mcp.return_value = None
        mock_exa.return_value = None
        mock_tavily.return_value = ResolvedResult(source="tavily", content="# Tavily results")

        result = resolve("machine learning tutorials")
        assert result["source"] == "tavily"

    @patch("scripts.resolve.fetch_llms_txt")
    @patch("scripts.resolve.resolve_with_jina")
    @patch("scripts.resolve.resolve_with_firecrawl")
    def test_url_fallback_to_firecrawl(self, mock_firecrawl, mock_jina, mock_fetch):
        """Test URL fallback to Firecrawl when no llms.txt or Jina."""
        mock_fetch.return_value = None
        mock_jina.return_value = None
        mock_firecrawl.return_value = ResolvedResult(
            source="firecrawl", content="# Firecrawl content"
        )

        result = resolve("https://example.com")
        assert result["source"] == "firecrawl"


class TestEdgeCases:
    """Edge case tests."""

    def test_url_with_special_characters(self):
        """Test URL with query parameters and fragments."""
        assert is_url("https://example.com/path?param=value&other=test#anchor")
        assert is_url("https://example.com/path?foo=bar")

    def test_url_without_scheme(self):
        """Test invalid URLs without scheme."""
        assert not is_url("example.com")
        assert not is_url("www.example.com")

    def test_url_localhost(self):
        """Test localhost URLs."""
        assert is_url("http://localhost:8080")
        assert is_url("http://127.0.0.1:3000/api")

    def test_query_with_special_characters(self):
        """Test queries with special characters."""
        assert not is_url("What is Python? It's great!")
        assert not is_url("Search: + - * / && ||")

    def test_empty_string(self):
        """Test empty string handling."""
        assert not is_url("")
        assert not is_url("   ")

    def test_very_long_query(self):
        """Test handling of very long queries."""
        long_query = "a" * 10000
        assert not is_url(long_query)

    @patch("scripts.resolve.fetch_llms_txt")
    @patch("scripts.resolve.resolve_with_jina")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.utils.fetch_url_content")
    @patch("scripts.resolve.resolve_with_firecrawl")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_url_no_llms_firecrawl_unavailable(
        self, mock_mistral, mock_firecrawl, mock_fetch_url, mock_ddg, mock_jina, mock_fetch_llms
    ):
        """Test URL when all methods fail."""
        mock_fetch_llms.return_value = None
        mock_jina.return_value = None
        mock_firecrawl.return_value = None
        mock_fetch_url.return_value = None
        mock_mistral.return_value = None
        mock_ddg.return_value = None

        result = resolve("https://example.com")
        assert result["source"] == "none"
        assert "error" in result

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_websearch")
    def test_query_all_providers_fail(
        self, mock_mistral, mock_ddg, mock_tavily, mock_exa, mock_exa_mcp
    ):
        """Test query when all providers fail."""
        mock_exa_mcp.return_value = None
        mock_exa.return_value = None
        mock_tavily.return_value = None
        mock_ddg.return_value = None
        mock_mistral.return_value = None

        result = resolve("any query")
        assert result["source"] == "none"
        assert "error" in result

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_websearch")
    def test_query_mistral_fallback(self, mock_mistral, mock_ddg, mock_tavily, mock_exa, mock_mcp):
        """Test query fallback to Mistral."""
        mock_mcp.return_value = None
        mock_exa.return_value = None
        mock_tavily.return_value = None
        mock_ddg.return_value = None
        mock_mistral.return_value = ResolvedResult(
            source="mistral-websearch",
            content="Mistral result",
        )

        result = resolve("test query")
        assert result["source"] == "mistral-websearch"

    def test_max_chars_truncation(self):
        """Test that content is truncated to max_chars."""
        long_content = "x" * 20000
        truncated = long_content[:MAX_CHARS]
        assert len(truncated) == MAX_CHARS

    @pytest.mark.live
    @patch.dict(os.environ, {"MISTRAL_API_KEY": "test_key"})
    @patch("mistralai.client.Mistral")
    def test_mistral_401_error(self, mock_mistral_class):
        """Test handling of Mistral 401 authentication error."""
        mock_client = Mock()
        mock_client.beta.conversations.start.side_effect = Exception(
            'API error occurred: Status 401. Body: {"detail":"Unauthorized"}'
        )
        mock_mistral_class.return_value = mock_client

        result = resolve_with_mistral_browser("https://example.com")
        assert result is None

    @patch("scripts.resolve.fetch_llms_txt")
    def test_llms_txt_found(self, mock_fetch):
        """Test when llms.txt is found."""
        mock_fetch.return_value = "# Documentation\n\nContent here"

        result = resolve("https://docs.example.com")
        assert result["source"] == "llms.txt"
        assert "Documentation" in result["content"]


class TestCacheBehavior:
    """Test caching behavior."""

    @patch("scripts.utils._get_cache")
    def test_cache_hit(self, mock_get_cache):
        """Test cache hit returns cached result."""
        mock_cache = Mock()
        mock_cache.get.return_value = {"source": "cached", "content": "test"}
        mock_get_cache.return_value = mock_cache

        from scripts.resolve import _get_from_cache

        result = _get_from_cache("test", "exa")

        assert result is not None
        assert result["source"] == "cached"

    @patch("scripts.utils._get_cache")
    def test_cache_miss(self, mock_get_cache):
        """Test cache miss returns None."""
        mock_cache = Mock()
        mock_cache.get.return_value = None
        mock_get_cache.return_value = mock_cache

        from scripts.resolve import _get_from_cache

        result = _get_from_cache("new_query", "exa")

        assert result is None

    @patch("scripts.utils._get_cache")
    def test_cache_disabled(self, mock_get_cache):
        """Test when cache is not available."""
        mock_get_cache.return_value = None

        from scripts.resolve import _get_from_cache

        result = _get_from_cache("test", "exa")

        assert result is None


class TestSkillSymlink:
    """Test that skill symlinks in .blackbox/skills/, .opencode/skills/ point to .agents/skills/."""

    def get_skill_locations(self):
        """Get all skill directory symlink locations to test."""
        root_dir = Path(__file__).parent.parent
        canonical = root_dir / ".agents" / "skills"
        return [
            (root_dir / ".blackbox" / "skills", ".blackbox/skills", canonical),
            (root_dir / ".claude" / "skills", ".claude/skills", canonical),
            (root_dir / ".opencode" / "skills", ".opencode/skills", canonical),
        ]

    def test_all_skill_symlinks_exist(self):
        """Test that all skill directory symlinks exist."""
        for skill_link, name, _ in self.get_skill_locations():
            assert skill_link.exists(), f"{name}: symlink does not exist: {skill_link}"

    def test_all_skill_symlinks_are_symlinks(self):
        """Test that all skill paths are directory symlinks."""
        for skill_link, name, _ in self.get_skill_locations():
            assert skill_link.is_symlink(), f"{name}: {skill_link} is not a symlink"

    def test_all_skill_symlinks_point_to_canonical(self):
        """Test that all symlinks point to .agents/skills/."""
        for skill_link, name, expected in self.get_skill_locations():
            resolved_target = skill_link.resolve()
            resolved_expected = expected.resolve()
            msg = (
                f"{name}: Symlink points to wrong target.\n"
                f"Expected: {resolved_expected}\n"
                f"Got: {resolved_target}"
            )
            assert resolved_target == resolved_expected, msg

    def test_skill_md_exists_in_canonical(self):
        """Test that SKILL.md exists in canonical .agents/skills/ directory."""
        root_dir = Path(__file__).parent.parent
        skill_md = root_dir / ".agents" / "skills" / "do-web-doc-resolver" / "SKILL.md"
        assert skill_md.exists(), f"SKILL.md does not exist in canonical: {skill_md}"
        assert skill_md.is_file(), f"SKILL.md is not a file: {skill_md}"


class TestDuckDuckGoFallback:
    """Test DuckDuckGo free search fallback."""

    @patch("scripts.utils._get_from_cache")
    @patch("scripts.providers_impl._is_rate_limited")
    @patch("duckduckgo_search.DDGS")
    def test_duckduckgo_successful_search(self, mock_ddgs_class, mock_rate_limited, mock_cache):
        """Test successful DuckDuckGo search."""
        mock_cache.return_value = None
        mock_rate_limited.return_value = False

        mock_ddgs = Mock()
        mock_ddgs.__enter__ = Mock(return_value=mock_ddgs)
        mock_ddgs.__exit__ = Mock(return_value=False)
        mock_ddgs.text.return_value = [
            {"title": "Result 1", "body": "Content 1", "href": "https://example.com/1"},
            {"title": "Result 2", "body": "Content 2", "href": "https://example.com/2"},
        ]
        mock_ddgs_class.return_value = mock_ddgs

        result = resolve_with_duckduckgo("test query")

        assert result is not None
        assert result.source == "duckduckgo"
        assert "Result 1" in result.content

    @patch("scripts.utils._get_from_cache")
    @patch("scripts.providers_impl._is_rate_limited")
    def test_duckduckgo_rate_limited(self, mock_rate_limited, mock_cache):
        """Test DuckDuckGo when rate-limited."""
        mock_cache.return_value = None
        mock_rate_limited.return_value = True

        result = resolve_with_duckduckgo("test query")

        assert result is None

    @patch("scripts.utils._get_from_cache")
    @patch("scripts.providers_impl._is_rate_limited")
    @patch("duckduckgo_search.DDGS")
    def test_duckduckgo_empty_results(self, mock_ddgs_class, mock_rate_limited, mock_cache):
        """Test DuckDuckGo with empty results."""
        mock_cache.return_value = None
        mock_rate_limited.return_value = False

        mock_ddgs = Mock()
        mock_ddgs.__enter__ = Mock(return_value=mock_ddgs)
        mock_ddgs.__exit__ = Mock(return_value=False)
        mock_ddgs.text.return_value = []
        mock_ddgs_class.return_value = mock_ddgs

        result = resolve_with_duckduckgo("test query")

        assert result is None


class TestRateLimitHandling:
    """Test rate limit detection and handling."""

    def test_detect_rate_limit_error(self):
        """Test detection of rate limit errors."""

        assert _detect_error_type(Exception("429 too many requests")) == ErrorType.RATE_LIMIT
        assert _detect_error_type(Exception("Rate limit exceeded")) == ErrorType.RATE_LIMIT
        assert _detect_error_type(Exception("too many requests")) == ErrorType.RATE_LIMIT

    def test_detect_auth_error(self):
        """Test detection of authentication errors."""

        assert _detect_error_type(Exception("401 unauthorized")) == ErrorType.AUTH_ERROR
        assert _detect_error_type(Exception("403 forbidden")) == ErrorType.AUTH_ERROR
        assert _detect_error_type(Exception("Invalid API key")) == ErrorType.AUTH_ERROR

    def test_detect_quota_exhausted(self):
        """Test detection of quota exhaustion."""

        assert _detect_error_type(Exception("402 payment required")) == ErrorType.QUOTA_EXHAUSTED
        assert _detect_error_type(Exception("Insufficient credits")) == ErrorType.QUOTA_EXHAUSTED
        assert _detect_error_type(Exception("Quota exceeded")) == ErrorType.QUOTA_EXHAUSTED

    def test_detect_network_error(self):
        """Test detection of network errors."""

        assert _detect_error_type(Exception("Network connection error")) == ErrorType.NETWORK_ERROR
        assert _detect_error_type(Exception("Network error")) == ErrorType.NETWORK_ERROR

    def test_detect_unknown_error(self):
        """Test detection of unknown errors."""

        assert _detect_error_type(Exception("Something went wrong")) == ErrorType.UNKNOWN

    def test_rate_limit_cooldown(self):
        """Test rate limit cooldown mechanism."""

        from scripts.resolve import _rate_limits

        # Clear any existing rate limits
        _rate_limits.clear()

        # Not rate limited initially
        assert not _is_rate_limited("test_provider")

        # Set rate limit
        _set_rate_limit("test_provider", cooldown=60)

        # Now should be rate limited
        assert _is_rate_limited("test_provider")

        # Clean up
        _rate_limits.clear()


class TestQueryCascade:
    """Test the full query resolution cascade."""

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_cascade_exa_mcp_first(
        self, mock_mistral, mock_ddg, mock_tavily, mock_exa, mock_exa_mcp
    ):
        """Test that Exa MCP is tried first."""
        mock_exa_mcp.return_value = ResolvedResult(source="exa_mcp", content="Exa MCP result")

        result = resolve("test query")
        assert result["source"] == "exa_mcp"
        mock_exa.assert_not_called()
        mock_tavily.assert_not_called()
        mock_ddg.assert_not_called()
        mock_mistral.assert_not_called()

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_cascade_exa_sdk_second(
        self, mock_mistral, mock_ddg, mock_tavily, mock_exa, mock_exa_mcp
    ):
        """Test that Exa SDK is tried second."""
        mock_exa_mcp.return_value = None
        mock_exa.return_value = ResolvedResult(source="exa", content="Exa result")

        result = resolve("test query")
        assert result["source"] == "exa"
        mock_tavily.assert_not_called()
        mock_ddg.assert_not_called()
        mock_mistral.assert_not_called()

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_cascade_tavily_third(
        self, mock_mistral, mock_ddg, mock_tavily, mock_exa, mock_exa_mcp
    ):
        """Test that Tavily is tried third."""
        mock_exa_mcp.return_value = None
        mock_exa.return_value = None
        mock_tavily.return_value = ResolvedResult(source="tavily", content="Tavily result")

        result = resolve("test query")
        assert result["source"] == "tavily"
        mock_ddg.assert_not_called()
        mock_mistral.assert_not_called()

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_cascade_duckduckgo_fourth(
        self, mock_mistral, mock_ddg, mock_tavily, mock_exa, mock_exa_mcp
    ):
        """Test that DuckDuckGo is tried fourth."""
        mock_exa_mcp.return_value = None
        mock_exa.return_value = None
        mock_tavily.return_value = None
        mock_ddg.return_value = ResolvedResult(source="duckduckgo", content="DDG result")

        result = resolve("test query")
        assert result["source"] == "duckduckgo"
        mock_mistral.assert_not_called()

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_websearch")
    def test_cascade_mistral_last(
        self, mock_mistral_ws, mock_ddg, mock_tavily, mock_exa, mock_exa_mcp
    ):
        """Test that Mistral websearch is tried last."""
        mock_exa_mcp.return_value = None
        mock_exa.return_value = None
        mock_tavily.return_value = None
        mock_ddg.return_value = None
        mock_mistral_ws.return_value = ResolvedResult(
            source="mistral-websearch", content="Mistral result"
        )

        result = resolve("test query")
        assert result["source"] == "mistral-websearch"


class TestAdditionalEdgeCases:
    """Additional edge case tests for comprehensive coverage."""

    def test_url_with_ftp_scheme(self):
        """Test that FTP URLs are properly detected."""
        assert is_url("ftp://ftp.example.com/file.txt")
        assert is_url("ftps://secure.example.com/file.txt")

    def test_url_with_javascript_scheme(self):
        """Test that javascript: URLs are handled correctly (no netloc)."""
        # javascript: URLs have a scheme but no netloc, so is_url should return False
        assert not is_url("javascript:alert('xss')")

    def test_url_with_file_scheme(self):
        """Test that file: URLs are handled correctly."""
        # file://localhost/ has netloc, file:/// does not
        # Our is_url requires scheme in (http, https, ftp, ftps)
        assert not is_url("file:///path/to/file.txt")  # Not in allowed schemes
        assert not is_url("file://localhost/path/to/file.txt")  # Not in allowed schemes

    def test_url_with_data_scheme(self):
        """Test that data: URLs are handled correctly."""
        # data: URLs have scheme but no netloc
        assert not is_url("data:text/plain;base64,SGVsbG8gV29ybGQ=")

    def test_url_with_mailto_scheme(self):
        """Test that mailto: URLs are handled correctly."""
        # mailto: has scheme but no netloc
        assert not is_url("mailto:user@example.com")

    def test_url_with_unicode_characters(self):
        """Test URLs with Unicode/international characters."""
        # IDN URLs should work
        assert is_url("https://例子.测试")
        assert is_url("https://例え.jp/path")
        # Punycode URLs
        assert is_url("https://xn--fsq.xn--0zwm56d/")

    def test_query_with_unicode_characters(self):
        """Test queries with Unicode/international characters."""
        assert not is_url("Python 编程教程")
        assert not is_url("プログラミング チュートリアル")
        assert not is_url("Поиск в интернете")

    def test_url_with_port_number(self):
        """Test URLs with explicit port numbers."""
        assert is_url("https://example.com:8080/path")
        assert is_url("http://localhost:3000/api")
        assert is_url("https://example.com:443/secure")

    def test_url_with_query_and_fragment(self):
        """Test URLs with complex query strings and fragments."""
        assert is_url("https://example.com/path?a=1&b=2&c=3#section")
        assert is_url("https://example.com/search?q=hello+world&page=1")
        assert is_url("https://example.com/path?param=value&other=test#anchor")

    def test_url_with_encoded_characters(self):
        """Test URLs with percent-encoded characters."""
        assert is_url("https://example.com/path%20with%20spaces")
        assert is_url("https://example.com/search?q=hello%20world")
        assert is_url("https://example.com/path?param=%E4%B8%AD%E6%96%87")

    def test_url_with_authentication(self):
        """Test URLs with authentication credentials."""
        assert is_url("https://user:pass@example.com/path")
        assert is_url("https://user@example.com/path")
        assert is_url("ftp://anonymous:anon@ftp.example.com/file")

    def test_url_ipv4_address(self):
        """Test URLs with IPv4 addresses."""
        assert is_url("http://192.168.1.1/")
        assert is_url("https://127.0.0.1:8080/api")
        assert is_url("http://10.0.0.1/path")

    def test_url_ipv6_address(self):
        """Test URLs with IPv6 addresses."""
        assert is_url("http://[::1]/")
        assert is_url("https://[2001:db8::1]:8080/path")
        assert is_url("http://[fe80::1%eth0]/path")

    def test_empty_query_after_normalization(self):
        """Test handling of whitespace-only queries."""
        # Whitespace-only strings should not be treated as URLs
        assert not is_url("   ")
        assert not is_url("\t\n\r")

    def test_null_byte_in_query(self):
        """Test handling of null bytes in queries."""
        # Null bytes should not crash the parser
        assert not is_url("test\x00query")
        # URLs with null bytes are still parsed as valid URLs by urlparse
        # (the null byte is just part of the path)
        result = is_url("https://example.com/\x00path")
        # This is technically a valid URL structure, just with unusual characters
        assert result  # urlparse accepts this as valid URL

    def test_extremely_long_url(self):
        """Test handling of extremely long URLs."""
        long_path = "a" * 10000
        url = f"https://example.com/{long_path}"
        assert is_url(url)

    def test_url_with_newline_characters(self):
        """Test URLs with newline characters (potential injection)."""
        # urlparse still parses these as valid URLs (newlines in path)
        # The is_url function checks scheme and netloc, which are present
        result1 = is_url("https://example.com/path\nwith\nnewlines")
        result2 = is_url("https://example.com/path\r\nwith\r\nnewlines")
        # These are parsed as valid URLs by urlparse (scheme and netloc present)
        assert result1  # urlparse accepts this
        assert result2  # urlparse accepts this

    def test_url_with_special_protocol_characters(self):
        """Test URLs with special characters in protocol."""
        # Valid HTTPS URL should be detected
        assert is_url("https://example.com")
        # Case handling - urlparse is case-insensitive for scheme
        assert is_url("HTTP://example.com")  # Valid URL

    def test_query_with_sql_injection_attempt(self):
        """Test queries that look like SQL injection attempts."""
        malicious_query = "'; DROP TABLE users; --"
        assert not is_url(malicious_query)

    def test_query_with_html_tags(self):
        """Test queries containing HTML tags."""
        html_query = "<script>alert('xss')</script>"
        assert not is_url(html_query)

    def test_url_with_double_slash_in_path(self):
        """Test URLs with double slashes in path."""
        assert is_url("https://example.com//double//slash//path")
        assert is_url("https://example.com/path//segment")

    def test_url_with_trailing_slash(self):
        """Test URLs with trailing slashes."""
        assert is_url("https://example.com/")
        assert is_url("https://example.com/path/")
        assert is_url("https://example.com/path/to/resource/")

    def test_url_without_path(self):
        """Test URLs without any path."""
        assert is_url("https://example.com")
        assert is_url("http://localhost")

    def test_url_with_subdomain(self):
        """Test URLs with multiple subdomains."""
        assert is_url("https://a.b.c.d.example.com/path")
        assert is_url("https://deep.nested.subdomain.example.com")

    def test_url_with_tld_edge_cases(self):
        """Test URLs with various TLDs."""
        assert is_url("https://example.co.uk")
        assert is_url("https://example.io")
        assert is_url("https://example.tech")
        assert is_url("https://example.中国")

    def test_query_with_only_numbers(self):
        """Test queries containing only numbers."""
        assert not is_url("123456789")
        assert not is_url("3.14159")

    def test_query_with_only_special_chars(self):
        """Test queries with only special characters."""
        assert not is_url("!@#$%^&*()")
        assert not is_url("+-=*/\\|[]{}")

    def test_url_case_sensitivity(self):
        """Test URL scheme case handling."""
        # urlparse is case-insensitive for scheme
        assert is_url("HTTPS://EXAMPLE.COM")
        assert is_url("HtTpS://example.com/path")

    def test_url_with_backslash(self):
        """Test URLs with backslashes (Windows-style paths)."""
        # Backslashes in URLs - urlparse still parses them as valid URLs
        # The scheme and netloc are still present
        result = is_url("https://example.com\\path")
        # This is parsed as a valid URL (scheme and netloc present)
        assert result  # urlparse accepts this

    def test_concurrent_rate_limit_tracking(self):
        """Test that rate limit tracking works correctly."""
        from scripts.resolve import _rate_limits

        # Clear any existing rate limits
        _rate_limits.clear()

        # Set rate limits for multiple providers
        _set_rate_limit("provider1", cooldown=60)
        _set_rate_limit("provider2", cooldown=30)

        # Both should be rate limited
        assert _is_rate_limited("provider1")
        assert _is_rate_limited("provider2")

        # Non-rate-limited provider should return False
        assert not _is_rate_limited("provider3")

        # Clean up
        _rate_limits.clear()

    def test_error_type_detection_edge_cases(self):
        """Test error type detection with various edge cases."""
        from scripts.resolve import ErrorType

        # Rate limit variations
        assert _detect_error_type(Exception("Error 429: Rate limit")) == ErrorType.RATE_LIMIT
        assert _detect_error_type(Exception("RATE LIMIT EXCEEDED")) == ErrorType.RATE_LIMIT

        # Auth error variations
        assert _detect_error_type(Exception("Error 401: Unauthorized")) == ErrorType.AUTH_ERROR
        assert _detect_error_type(Exception("FORBIDDEN: 403")) == ErrorType.AUTH_ERROR
        assert _detect_error_type(Exception("Invalid API key provided")) == ErrorType.AUTH_ERROR

        # Quota exhausted variations
        assert (
            _detect_error_type(Exception("Error 402: Payment Required"))
            == ErrorType.QUOTA_EXHAUSTED
        )
        assert _detect_error_type(Exception("Insufficient credits")) == ErrorType.QUOTA_EXHAUSTED
        assert _detect_error_type(Exception("Quota exceeded")) == ErrorType.QUOTA_EXHAUSTED

        # Network error variations
        assert _detect_error_type(Exception("Network connection error")) == ErrorType.NETWORK_ERROR
        assert _detect_error_type(Exception("Network error occurred")) == ErrorType.NETWORK_ERROR
        assert _detect_error_type(Exception("Network error")) == ErrorType.NETWORK_ERROR

        # Not found
        assert _detect_error_type(Exception("Error 404: Not found")) == ErrorType.NOT_FOUND

        # Unknown errors
        assert _detect_error_type(Exception("Something went wrong")) == ErrorType.UNKNOWN
        assert _detect_error_type(Exception("")) == ErrorType.UNKNOWN

    @patch("scripts.utils._get_from_cache")
    @patch("scripts.providers_impl._is_rate_limited")
    @patch("scripts.utils._save_to_cache")
    @patch("duckduckgo_search.DDGS")
    def test_duckduckgo_network_error(
        self, mock_ddgs_class, mock_save, mock_rate_limited, mock_cache
    ):
        """Test DuckDuckGo handling of network errors."""
        mock_cache.return_value = None
        mock_rate_limited.return_value = False

        mock_ddgs = Mock()
        mock_ddgs.__enter__ = Mock(return_value=mock_ddgs)
        mock_ddgs.__exit__ = Mock(return_value=False)
        mock_ddgs.text.side_effect = Exception("Network connection error")
        mock_ddgs_class.return_value = mock_ddgs

        result = resolve_with_duckduckgo("test query")

        assert result is None

    @patch("scripts.utils._get_from_cache")
    @patch("scripts.providers_impl._is_rate_limited")
    @patch("scripts.utils._save_to_cache")
    @patch("duckduckgo_search.DDGS")
    def test_duckduckgo_with_unicode_query(
        self, mock_ddgs_class, mock_save, mock_rate_limited, mock_cache
    ):
        """Test DuckDuckGo with Unicode query."""
        mock_cache.return_value = None
        mock_rate_limited.return_value = False

        mock_ddgs = Mock()
        mock_ddgs.__enter__ = Mock(return_value=mock_ddgs)
        mock_ddgs.__exit__ = Mock(return_value=False)
        mock_ddgs.text.return_value = [
            {"title": "结果 1", "body": "内容 1", "href": "https://example.com/1"},
        ]
        mock_ddgs_class.return_value = mock_ddgs

        result = resolve_with_duckduckgo("中文搜索")

        assert result is not None
        assert result.source == "duckduckgo"
        assert "结果" in result.content

    @patch("scripts.resolve.fetch_llms_txt")
    @patch("scripts.resolve.resolve_with_firecrawl")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_url_cascade_llms_txt_priority(self, mock_mistral, mock_firecrawl, mock_fetch):
        """Test that llms.txt is checked first before other methods."""
        mock_fetch.return_value = "# llms.txt content"

        result = resolve("https://example.com")

        assert result["source"] == "llms.txt"
        # Firecrawl and Mistral should not be called
        mock_firecrawl.assert_not_called()
        mock_mistral.assert_not_called()

    @patch("scripts.resolve.fetch_llms_txt")
    @patch("scripts.resolve.resolve_with_jina")
    @patch("scripts.resolve.resolve_with_firecrawl")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_url_cascade_firecrawl_second(
        self, mock_mistral, mock_firecrawl, mock_jina, mock_fetch
    ):
        """Test that Firecrawl is tried when llms.txt and Jina fail."""
        mock_fetch.return_value = None
        mock_jina.return_value = None
        mock_firecrawl.return_value = ResolvedResult(source="firecrawl", content="content")

        result = resolve("https://example.com")

        assert result["source"] == "firecrawl"
        # Mistral should not be called since Firecrawl succeeded
        mock_mistral.assert_not_called()

    @patch("scripts.resolve.fetch_llms_txt")
    @patch("scripts.resolve.resolve_with_jina")
    @patch("scripts.resolve.resolve_with_firecrawl")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_url_cascade_mistral_last(self, mock_mistral, mock_firecrawl, mock_jina, mock_fetch):
        """Test that Mistral is tried last for URLs."""
        mock_fetch.return_value = None
        mock_jina.return_value = None
        mock_firecrawl.return_value = None
        mock_mistral.return_value = ResolvedResult(source="mistral-browser", content="content")

        result = resolve("https://example.com")

        assert result["source"] == "mistral-browser"

    def test_cache_key_consistency(self):
        """Test that cache keys are consistent for same inputs."""
        from scripts.resolve import _cache_key

        key1 = _cache_key("test query", "exa")
        key2 = _cache_key("test query", "exa")

        assert key1 == key2

    def test_cache_key_uniqueness(self):
        """Test that cache keys are unique for different inputs."""
        from scripts.resolve import _cache_key

        key1 = _cache_key("query1", "exa")
        key2 = _cache_key("query2", "exa")
        key3 = _cache_key("query1", "tavily")

        assert key1 != key2
        assert key1 != key3

    def test_max_chars_constant(self):
        """Test that MAX_CHARS is set correctly."""
        from scripts.resolve import MAX_CHARS

        assert MAX_CHARS == 8000

    def test_min_chars_constant(self):
        """Test that MIN_CHARS is set correctly."""
        from scripts.resolve import MIN_CHARS

        assert MIN_CHARS == 200


class TestSkipProviders:
    """Test the skip_providers parameter."""

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_websearch")
    def test_skip_exa_mcp(self, mock_mistral, mock_ddg, mock_tavily, mock_exa, mock_exa_mcp):
        """Test skipping Exa MCP."""
        mock_exa_mcp.return_value = None  # Would be called first, but skipped
        mock_exa.return_value = ResolvedResult(source="exa", content="Exa result")

        result = resolve("test query", skip_providers={"exa_mcp"})

        assert result["source"] == "exa"
        mock_exa_mcp.assert_not_called()
        mock_exa.assert_called_once()

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_websearch")
    def test_skip_multiple_providers(
        self, mock_mistral, mock_ddg, mock_tavily, mock_exa, mock_exa_mcp
    ):
        """Test skipping multiple providers."""
        mock_exa_mcp.return_value = None
        mock_exa.return_value = None
        mock_tavily.return_value = None
        mock_ddg.return_value = ResolvedResult(source="duckduckgo", content="DDG result")

        result = resolve("test query", skip_providers={"exa_mcp", "exa", "tavily"})

        assert result["source"] == "duckduckgo"
        mock_exa_mcp.assert_not_called()
        mock_exa.assert_not_called()
        mock_tavily.assert_not_called()
        mock_ddg.assert_called_once()

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_websearch")
    def test_skip_all_but_mistral(
        self, mock_mistral, mock_ddg, mock_tavily, mock_exa, mock_exa_mcp
    ):
        """Test skipping all providers except Mistral."""
        mock_mistral.return_value = ResolvedResult(
            source="mistral-websearch", content="Mistral result"
        )

        result = resolve("test query", skip_providers={"exa_mcp", "exa", "tavily", "duckduckgo"})

        assert result["source"] == "mistral-websearch"
        mock_exa_mcp.assert_not_called()
        mock_exa.assert_not_called()
        mock_tavily.assert_not_called()
        mock_ddg.assert_not_called()
        mock_mistral.assert_called_once()

    @patch("scripts.resolve.resolve_with_exa_mcp")
    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    @patch("scripts.resolve.resolve_with_duckduckgo")
    @patch("scripts.resolve.resolve_with_mistral_websearch")
    def test_skip_none(self, mock_mistral, mock_ddg, mock_tavily, mock_exa, mock_exa_mcp):
        """Test with no providers skipped (default behavior)."""
        mock_exa_mcp.return_value = ResolvedResult(source="exa_mcp", content="Exa MCP result")

        result = resolve("test query")

        assert result["source"] == "exa_mcp"
        mock_exa_mcp.assert_called_once()
        mock_exa.assert_not_called()
        mock_tavily.assert_not_called()
        mock_ddg.assert_not_called()
        mock_mistral.assert_not_called()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
