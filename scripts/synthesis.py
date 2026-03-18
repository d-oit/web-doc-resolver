"""
Two-stage synthesis gating logic for the Research Resolver.
"""

import logging

from scripts.models import ResolvedResult

logger = logging.getLogger(__name__)


def should_call_llm_synthesis(results: list[ResolvedResult], threshold: float = 0.8) -> bool:
    """
    Decide whether to call LLM synthesis based on result quality and conflicts.
    """
    if not results:
        return False

    # If we only have one result and it's high quality, skip LLM
    if len(results) == 1:
        score = results[0].score
        if score >= threshold:
            logger.info(f"Skipping LLM synthesis: single high-quality result (score={score:.2f})")
            return False
        logger.info(f"Calling LLM synthesis: single low-quality result (score={score:.2f})")
        return True

    # If we have multiple results, check for length and diversity
    total_len = sum(len(r.content) for r in results if r.content)
    if total_len < 1000:
        logger.info("Calling LLM synthesis: fragmented/short results")
        return True

    # Check if results are too similar (might not need synthesis)
    # Simplified: always synthesize if multiple results to merge them properly
    logger.info("Calling LLM synthesis: reconciling multiple results")
    return True


def deterministic_merge(results: list[ResolvedResult]) -> str:
    """
    Deterministically merge multiple results without an LLM.
    """
    if not results:
        return ""
    if len(results) == 1:
        return results[0].content

    merged = []
    for i, res in enumerate(results):
        merged.append(f"### Source {i+1}: {res.source}\n{res.content}")

    return "\n\n---\n\n".join(merged)
