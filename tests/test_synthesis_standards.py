import pytest

from scripts.models import ResolvedResult
from scripts.quality import score_content
from scripts.synthesis import deterministic_merge


def test_deterministic_merge_standards():
    results = [
        ResolvedResult(source="test", content="Some content here", url="https://example.com/1"),
        ResolvedResult(source="test2", content="Other content here", url="https://example.com/2"),
    ]
    output = deterministic_merge(results)

    # Check YAML frontmatter
    assert output.startswith("---")
    assert "relevance_score:" in output
    assert "intent_category:" in output
    assert "token_estimate:" in output
    assert "last_updated:" in output

    # Check Structural Anchors
    assert "[ANCHOR: SUMMARY]" in output
    assert "[ANCHOR: TECHNICAL_DETAILS]" in output
    assert "[ANCHOR: COMPARISON]" in output
    assert "[ANCHOR: CITATIONS]" in output

    # Check Citations
    assert "[1] https://example.com/1" in output
    assert "[2] https://example.com/2" in output


def test_quality_scoring_standards_bonus():
    # Compliant document
    compliant_doc = """---
relevance_score: 0.9
intent_category: Technical
token_estimate: 100
last_updated: 2026-01-01
---

[ANCHOR: SUMMARY]
Summary here.

[ANCHOR: TECHNICAL_DETAILS]
Details here.

[ANCHOR: COMPARISON]
Comparison here.

[ANCHOR: CITATIONS]
[1] https://example.com
"""
    # Create enough content and variability to avoid penalties
    lines = [f"This is unique line number {i} to avoid duplicate heavy penalty." for i in range(20)]
    compliant_doc += "\n" + "\n".join(lines)

    score_obj = score_content(compliant_doc, ["https://example.com"])
    # 1.0 + 0.05 (fm) + 0.05 (anchors) = 1.1 -> clamped to 1.0
    assert score_obj.score == 1.0

    # No links (-0.10)
    score_obj_no_links = score_content(compliant_doc, [])
    # 1.0 - 0.10 (no links) + 0.05 (fm) + 0.05 (anchors) = 1.0 -> clamped to 1.0
    assert score_obj_no_links.score == 1.0

    missing_anchors_doc = """---
relevance_score: 0.9
---
Just some text.
"""
    missing_anchors_doc += "\n" + "\n".join(lines)
    score_missing_no_links = score_content(missing_anchors_doc, [])
    # 1.0 - 0.10 (no links) + 0.05 (fm) = 0.95
    assert score_missing_no_links.score == pytest.approx(0.95)
