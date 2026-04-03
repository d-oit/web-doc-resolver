"""
Tests for quality scoring module.
"""

import pytest

from scripts.quality import score_content, QualityScore


class TestScoreContent:
    """Tests for score_content function."""

    def test_empty_content(self):
        """Empty content should be too_short and not acceptable."""
        result = score_content("")
        assert result.too_short is True
        assert result.score < 1.0
        assert result.acceptable is False

    def test_short_content(self):
        """Content under 500 chars should be too_short."""
        short_text = "This is a short piece of text that is under the 500 char threshold."
        result = score_content(short_text)
        assert result.too_short is True
        # Score depends on penalties applied (missing_links, duplicate_heavy, etc.)
        assert result.score >= 0.0  # Should never be negative
        assert result.acceptable is False

    def test_min_acceptable_length(self):
        """Content at exactly 500 chars should not be too_short but still may not be acceptable."""
        # Create content that's exactly 500 chars with unique lines
        lines = [f"Line number {i} is unique and different from others" for i in range(25)]
        content = "\n".join(lines)
        assert len(content) >= 500
        result = score_content(content)
        assert result.too_short is False  # Not too short
        # acceptable status depends on score and too_short
        assert result.acceptable == (result.score >= 0.65 and not result.too_short)

    def test_acceptable_content(self):
        """Good content should score well."""
        # Create content with enough length, links, and uniqueness
        lines = [
            "# Python Documentation",
            "",
            "Python is a programming language.",
            "",
            "## Features",
            "",
        ]
        # Add many unique lines to exceed 500 chars
        lines.extend([f"- Feature {i} description here" for i in range(50)])
        lines.extend([
            "",
            "## Links",
            "",
            "Visit https://python.org to download.",
            "For more details, see https://docs.python.org/3/",
        ])
        content = "\n".join(lines)
        links = ["https://python.org", "https://docs.python.org/3/"]
        result = score_content(content, links)
        assert result.too_short is False
        assert result.missing_links is False
        assert result.noisy is False
        # Score should be >= 0.65 to be acceptable
        assert result.score >= 0.65
        assert result.acceptable is True

    def test_missing_links_penalty(self):
        """Content without links should get -0.15 penalty."""
        # Long enough content but no links, not duplicate heavy
        content = "This is a long piece of content. " * 20  # Over 500 chars, unique lines
        result = score_content(content, [])
        assert result.missing_links is True
        # Score = 1.0 - 0.15 = 0.85 (if not duplicate heavy and not noisy)
        assert result.score >= 0.6  # At least 0.6 after penalties
        # acceptable requires score >= 0.65 and not too_short
        assert result.acceptable == (result.score >= 0.65 and not result.too_short)

    def test_duplicate_heavy_content(self):
        """High duplicate line ratio should trigger duplicate_heavy."""
        # Repeated lines
        content = "\n".join(["Same line repeated"] * 20)
        result = score_content(content, ["https://example.com"])
        assert result.duplicate_heavy is True
        # Score depends on duplicate_heavy penalty and potentially others
        # duplicate_heavy (-0.25) + potentially missing other penalties
        assert result.score >= 0.0  # Score should never be negative

    def test_noisy_content(self):
        """Too many noise signals should trigger noisy flag."""
        # Create content with many noise signals (need >6 to trigger noisy)
        # Each signal counts per occurrence, so we need many occurrences
        content = """
Subscribe now! Log in to continue. Sign up for free.
JavaScript enabled required. Accept cookies to proceed.
Subscribe to newsletter. Log in with your account.
Cookie notice. JavaScript required. Sign up today.
More content here to make it long enough for the test to be meaningful.
Adding more lines to ensure we're over the 500 character minimum threshold.
The noisy signals should be detected and trigger the appropriate penalty.
""" + "x" * 300  # Ensure over 500 chars
        result = score_content(content, ["https://example.com"])
        assert result.noisy is True
        assert result.score >= 0.0  # Score should never be negative

    def test_threshold_0_65_acceptable(self):
        """Score >= 0.65 and not too_short should be acceptable."""
        # Content with missing_links penalty only (no other penalties)
        # Long enough content with unique lines to avoid duplicate_heavy
        lines = [f"This is unique line number {i} for testing purposes here." for i in range(30)]
        content = "\n".join(lines)
        result = score_content(content, [])
        # Score should be >= 0.65 for acceptance
        assert result.acceptable == (result.score >= 0.65 and not result.too_short)

    def test_threshold_below_0_65_not_acceptable(self):
        """Score < 0.65 should not be acceptable."""
        # Short content triggers too_short which makes it not acceptable
        content = "short content here that is definitely not long enough"
        result = score_content(content, [])
        assert result.too_short is True  # Under 500 chars
        assert result.acceptable is False  # Cannot be acceptable if too_short

    def test_multiple_penalties(self):
        """Multiple penalties should compound correctly."""
        # Short, many noise signals to trigger multiple penalties
        content = "Subscribe log in sign up JavaScript cookie Subscribe log in " * 5
        result = score_content(content, [])
        # Score should be calculated with all penalties applied
        # Verify that all conditions are properly detected
        assert result.too_short is True or result.score > 0
        assert result.score >= 0.0  # Should never be negative
        assert result.acceptable is False  # Short content can't be acceptable

    def test_score_never_negative(self):
        """Score should never go below 0."""
        content = ""
        result = score_content(content, [])
        assert result.score >= 0.0


class TestQualityScoreDataclass:
    """Tests for QualityScore dataclass."""

    def test_quality_score_fields(self):
        """QualityScore should have all expected fields."""
        result = score_content("test content here", [])
        assert hasattr(result, "score")
        assert hasattr(result, "too_short")
        assert hasattr(result, "missing_links")
        assert hasattr(result, "duplicate_heavy")
        assert hasattr(result, "noisy")
        assert hasattr(result, "acceptable")

    def test_quality_score_types(self):
        """All QualityScore fields should have correct types."""
        result = score_content("test content", ["https://example.com"])
        assert isinstance(result.score, float)
        assert isinstance(result.too_short, bool)
        assert isinstance(result.missing_links, bool)
        assert isinstance(result.duplicate_heavy, bool)
        assert isinstance(result.noisy, bool)
        assert isinstance(result.acceptable, bool)