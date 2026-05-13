# New Provider Integration (Condensed Status)

## Original Overview

Integration of 7 new providers (Tavily Extract, ScrapingAnt, ScrapeGraph AI,
SearchAPI.io, ScrapingBee, You.com, Perplexity) to expand coverage and free
tier options.

## Status

None of the 7 providers have been integrated. This plan is deprioritized in
favor of correctness, CI, and architecture consolidation (ADRs 012-014).

## What's Done

- None. All 655 lines of implementation code are aspirational.

## What Remains

All 7 providers remain to be implemented. When work resumes, priority order
should follow the original P1→P4 matrix — Tavily Extract first (reuses existing
TAVILY_API_KEY), then ScrapingAnt (10K free tier).

## References

- [AUDIT.md](AUDIT.md) — Priority overview
- [scripts/providers_impl.py](../scripts/providers_impl.py) — Existing providers
- [PROVIDERS.md](../.agents/skills/do-web-doc-resolver/references/PROVIDERS.md)
