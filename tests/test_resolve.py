"""Comprehensive tests for resolve.py with all fallback scenarios."""

import sys
import os
import pytest
from unittest.mock import Mock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.resolve import (
    is_url,
    fetch_llms_txt,
    resolve_with_firecrawl,
    resolve_with_mistral_browser,
    resolve,
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

    @patch("scripts.resolve.requests.get")
    def test_llms_txt_found(self, mock_get):
        """Test successful llms.txt fetch."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "# Example llms.txt\nContent here"
        mock_get.return_value = mock_response

        result = fetch_llms_txt("https://example.com")
        assert result is not None
        assert "Example llms.txt" in result

    @patch("scripts.resolve.requests.get")
    def test_llms_txt_not_found(self, mock_get):
        """Test when llms.txt doesn't exist."""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        result = fetch_llms_txt("https://example.com")
        assert result is None


class TestResolveWithFirecrawl:
    """Test Firecrawl resolution with error handling."""

    @patch.dict(os.environ, {}, clear=True)
    def test_no_api_key(self):
        """Test graceful handling when API key is not set."""
        result = resolve_with_firecrawl("https://example.com")
        assert result is None

    @patch.dict(os.environ, {"FIRECRAWL_API_KEY": "test_key"})
    @patch("firecrawl.Firecrawl")
    def test_successful_extraction(self, mock_firecrawl_class):
        """Test successful content extraction."""
        mock_app = Mock()
        mock_app.scrape.return_value = {"markdown": "# Test Content\nSome text here"}
        mock_firecrawl_class.return_value = mock_app

        result = resolve_with_firecrawl("https://example.com")
        assert result is not None
        assert result["source"] == "firecrawl"
        assert "Test Content" in result["content"]

    @patch.dict(
        os.environ, {"FIRECRAWL_API_KEY": "test_key", "MISTRAL_API_KEY": "mistral_key"}
    )
    @patch("firecrawl.Firecrawl")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_rate_limit_fallback(self, mock_mistral, mock_firecrawl_class):
        """Test Mistral fallback on rate limit."""
        mock_app = Mock()
        mock_app.scrape.side_effect = Exception("429 rate limit exceeded")
        mock_firecrawl_class.return_value = mock_app

        mock_mistral.return_value = {
            "source": "mistral-browser",
            "content": "Mistral content",
        }

        resolve_with_firecrawl("https://example.com")
        mock_mistral.assert_called_once()

    @patch.dict(
        os.environ, {"FIRECRAWL_API_KEY": "test_key", "MISTRAL_API_KEY": "mistral_key"}
    )
    @patch("firecrawl.Firecrawl")
    @patch("scripts.resolve.resolve_with_mistral_browser")
    def test_credit_exhaustion_fallback(self, mock_mistral, mock_firecrawl_class):
        """Test Mistral fallback on credit exhaustion."""
        mock_app = Mock()
        mock_app.scrape.side_effect = Exception("insufficient credits")
        mock_firecrawl_class.return_value = mock_app

        mock_mistral.return_value = {
            "source": "mistral-browser",
            "content": "Mistral content",
        }

        resolve_with_firecrawl("https://example.com")
        mock_mistral.assert_called_once()

    @patch.dict(os.environ, {"FIRECRAWL_API_KEY": "test_key"})
    @patch("firecrawl.Firecrawl")
    def test_authentication_error(self, mock_firecrawl_class):
        """Test handling of authentication errors."""
        mock_app = Mock()
        mock_app.scrape.side_effect = Exception("401 unauthorized")
        mock_firecrawl_class.return_value = mock_app

        result = resolve_with_firecrawl("https://example.com")
        assert result is None


class TestResolveWithMistralBrowser:
    """Test Mistral agent-browser skill fallback."""

    @patch.dict(os.environ, {}, clear=True)
    def test_no_api_key(self):
        """Test graceful handling when Mistral API key is not set."""
        result = resolve_with_mistral_browser("https://example.com")
        assert result is None

    @patch.dict(os.environ, {"MISTRAL_API_KEY": "test_key"})
    @patch("mistralai.Mistral")
    def test_successful_extraction(self, mock_mistral_class):
        """Test successful content extraction with Mistral."""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.choices = [
            Mock(message=Mock(content="# Extracted Content\nFrom Mistral"))
        ]
        mock_client.agents.complete.return_value = mock_response
        mock_mistral_class.return_value = mock_client

        result = resolve_with_mistral_browser("https://example.com")
        assert result is not None
        assert result["source"] == "mistral-browser"
        assert "Extracted Content" in result["content"]

    @patch.dict(os.environ, {"MISTRAL_API_KEY": "test_key"})
    @patch("mistralai.Mistral")
    def test_extraction_error(self, mock_mistral_class):
        """Test error handling in Mistral extraction."""
        mock_client = Mock()
        mock_client.agents.complete.side_effect = Exception("Mistral API error")
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

    @patch("scripts.resolve.resolve_with_exa")
    def test_query_with_exa(self, mock_exa):
        """Test query resolution with Exa."""
        mock_exa.return_value = {"source": "exa", "content": "# Exa results"}

        result = resolve("machine learning tutorials")
        assert result["source"] == "exa"

    @patch("scripts.resolve.resolve_with_exa")
    @patch("scripts.resolve.resolve_with_tavily")
    def test_query_fallback_to_tavily(self, mock_tavily, mock_exa):
        """Test fallback from Exa to Tavily."""
        mock_exa.return_value = None
        mock_tavily.return_value = {"source": "tavily", "content": "# Tavily results"}

        result = resolve("machine learning tutorials")
        assert result["source"] == "tavily"

    @patch("scripts.resolve.fetch_llms_txt")
    @patch("scripts.resolve.resolve_with_firecrawl")
    def test_url_fallback_to_firecrawl(self, mock_firecrawl, mock_fetch):
        """Test URL fallback to Firecrawl when no llms.txt."""
        mock_fetch.return_value = None
        mock_firecrawl.return_value = {
            "source": "firecrawl",
            "content": "# Firecrawl content",
        }

        result = resolve("https://example.com")
        assert result["source"] == "firecrawl"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
