# LLM-Readable-Doc Standards (2026 Edition)

Synthesized outputs from the Web Doc Resolver must prioritize token efficiency and structural clarity for downstream LLM consumption.

## 1. Token-Efficiency Headers

Every synthesized document must begin with a YAML frontmatter block. This allows consuming models to assess relevance without processing the entire body.

```yaml
---
relevance_score: 0.0-1.0
intent_category: [Technical, Informational, Comparative, Debugging]
token_estimate: <int>
last_updated: YYYY-MM-DD
---
```

## 2. Structural Anchors

Content must be partitioned using standardized structural anchors to facilitate RAG performance and citation mapping.

- `[ANCHOR: SUMMARY]` - High-level synthesis of findings.
- `[ANCHOR: TECHNICAL_DETAILS]` - Specs, code, or architecture details.
- `[ANCHOR: COMPARISON]` - Trade-offs and alternatives.
- `[ANCHOR: CITATIONS]` - Source URL mapping.

## 3. Formatting Requirements

- **CommonMark**: Use strict Markdown for maximum compatibility.
- **Deduplication**: Merge redundant information across sources.
- **Citation Precision**: Follow claims with bracketed citation indices (e.g., [1]) matching the CITATIONS anchor.
