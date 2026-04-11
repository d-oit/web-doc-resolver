
import pytest
from scripts.utils import validate_links
from unittest.mock import patch, MagicMock

def test_validate_links_success():
    links = ["https://example.com/1", "https://example.com/2"]
    with patch("scripts.utils._safe_request") as mock_safe_request:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_safe_request.return_value = mock_response

        validated = validate_links(links)

        assert len(validated) == 2
        assert validated == links
        assert mock_safe_request.call_count == 2

def test_validate_links_some_fail():
    links = ["https://example.com/ok", "https://example.com/fail"]

    def side_effect(method, url, **kwargs):
        mock_response = MagicMock()
        if "fail" in url:
            mock_response.status_code = 404
        else:
            mock_response.status_code = 200
        return mock_response

    with patch("scripts.utils._safe_request", side_effect=side_effect):
        validated = validate_links(links)

        assert len(validated) == 1
        assert validated == ["https://example.com/ok"]

def test_validate_links_exception():
    links = ["https://example.com/error"]
    with patch("scripts.utils._safe_request", side_effect=Exception("Network error")):
        validated = validate_links(links)
        assert len(validated) == 0

def test_validate_links_empty():
    assert validate_links([]) == []
