import pytest

from do_web_doc_resolver.resolve import is_url, resolve, MAX_CHARS, MIN_CHARS


def test_is_url_detects_url():
    assert is_url("https://example.com") is True
    assert is_url("http://example.com") is True


def test_is_url_detects_query():
    assert is_url("hello world") is False
    assert is_url("") is False


def test_constants_exist():
    assert isinstance(MAX_CHARS, int)
    assert isinstance(MIN_CHARS, int)
    assert MAX_CHARS > 0
    assert MIN_CHARS > 0


@pytest.mark.live
def test_resolve_query_returns_dict(sample_query, max_chars):
    result = resolve(sample_query, max_chars=max_chars)
    assert isinstance(result, dict)
    assert "source" in result
    assert "content" in result
