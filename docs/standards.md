# LLM-Readable-Doc Standards (2026 Edition)

As LLM context windows have expanded and RAG architectures have matured, "LLM-ready" documentation must prioritize token efficiency and structural clarity. These standards ensure that synthesized outputs from the Web Doc Resolver are optimized for downstream LLM consumption.

## 1. Token-Efficiency Headers

Every synthesized document MUST begin with a YAML frontmatter block containing metadata that allows the consuming LLM to quickly assess relevance without processing the entire body.

```yaml
---
relevance_score: 0.0-1.0
intent_category: [Technical, Informational, Comparative, Debugging]
token_estimate: <int>
last_updated: YYYY-MM-DD
---
```

## 2. Structural Anchors

To facilitate better RAG performance and citation mapping, content must be partitioned using standardized structural anchors. These anchors allow models to perform precise "needle-in-a-haystack" retrieval and cross-referencing.

- `[ANCHOR: SUMMARY]` - High-level synthesis of findings.
- `[ANCHOR: TECHNICAL_DETAILS]` - Deep dive into specs, code, or architecture.
- `[ANCHOR: COMPARISON]` - Trade-offs and alternatives (if applicable).
- `[ANCHOR: CITATIONS]` - Mapping of claims to source URLs.

## 3. Formatting Requirements

- **Markdown-Strict**: Use standard CommonMark for maximum compatibility.
- **Deduplication**: Aggressively merge redundant information across sources.
- **Citation Precision**: Every claim should ideally be followed by a bracketed citation index matching the CITATIONS anchor.
