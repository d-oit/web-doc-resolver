# LLM-Readable-Doc Standards (2026 Edition)

Synthesized outputs prioritize token efficiency and structural clarity for RAG and agent consumption.

## 1. YAML Frontmatter

Every synthesized document starts with a YAML block for metadata assessment.

```yaml
---
relevance_score: 0.0-1.0
intent_category: [Technical, Informational, Comparative, Debugging]
token_estimate: <int>
last_updated: YYYY-MM-DD
---
```

## 2. Structural Anchors

Standardized anchors facilitate content partitioning and citation mapping.

- `[ANCHOR: SUMMARY]`: High-level synthesis.
- `[ANCHOR: TECHNICAL_DETAILS]`: Specifications, code, and architecture.
- `[ANCHOR: COMPARISON]`: Trade-offs and alternatives.
- `[ANCHOR: CITATIONS]`: Source mapping for bracketed indices.

## 3. Formatting

- **CommonMark**: Strict adherence to CommonMark for parser compatibility.
- **Deduplication**: Redundant information is merged across sources.
- **Citations**: Claims must be followed by bracketed indices (e.g., [1]) matching the `CITATIONS` anchor.
