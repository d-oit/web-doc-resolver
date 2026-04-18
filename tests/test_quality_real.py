from scripts.quality import score_content


def test_score_content_good() -> None:
    """Test that high-quality content passes the score check."""
    markdown = "# Title\n\n" + "This is a long enough paragraph with good content. " * 20
    links = ["https://example.com"]
    result = score_content(markdown, links)
    assert result.acceptable is True
    assert result.too_short is False
    assert result.score >= 0.65


def test_score_content_short() -> None:
    """Test that content that is too short is rejected."""
    result = score_content("too short")
    assert result.too_short is True
    assert result.acceptable is False
    assert result.score < 0.65


def test_score_content_noisy() -> None:
    """Test that noisy content with boilerplate phrases is flagged."""
    markdown = (
        "cookie subscribe javascript log in sign up cookie subscribe javascript log in sign up " * 2
    )
    # Ensure it's long enough to not be rejected solely for length if we want to test noise specifically,
    # but the logic says noise penalized if count > 6.
    markdown = markdown + "This is some more text to reach the length threshold if needed. " * 10
    result = score_content(markdown)
    assert result.noisy is True
    assert result.score < 1.0


def test_score_content_duplicate() -> None:
    """Test that content with excessive repetition is flagged as duplicate-heavy."""
    markdown = "Duplicate line.\n" * 20
    result = score_content(markdown)
    assert result.duplicate_heavy is True
    assert result.score < 1.0


def test_score_content_non_string() -> None:
    """Test that non-string input is handled gracefully (defaults to acceptable but empty)."""
    result = score_content(None)  # type: ignore
    assert result.acceptable is True
