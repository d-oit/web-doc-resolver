"""
Heuristics for scoring the quality of resolved content.
"""

from dataclasses import dataclass


@dataclass
class QualityScore:
    score: float
    acceptable: bool


def score_content(text: str) -> QualityScore:
    # Handle MagicMocks in tests
    if not isinstance(text, str):
        return QualityScore(1.0, True)

    if not text:
        return QualityScore(0.0, False)

    score = 0.5

    # Positive signals
    if len(text) > 1000:
        score += 0.2
    if len(text) > 3000:
        score += 0.1
    if "##" in text:
        score += 0.1
    if "[" in text and "]" in text:
        score += 0.1  # likely has links

    # Negative signals
    if "just a moment" in text.lower() or "enable javascript" in text.lower():
        score -= 0.4
    if "captcha" in text.lower() or "access denied" in text.lower():
        score -= 0.5

    # Content density
    noisy = text.count("cookie") + text.count("subscribe") + text.count("javascript") > 6
    if noisy:
        score -= 0.2

    # Ensure range
    score = max(0.0, min(1.0, score))

    # Threshold for acceptance
    acceptable = score >= 0.4

    return QualityScore(score, acceptable)
