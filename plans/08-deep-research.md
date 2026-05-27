# Deep Research & Evaluation (Condensed Status)

## Original Overview

Multi-step research engine, evaluation framework, and performance benchmarking
suite.

## Status

None of the proposed code has been implemented. This plan is deprioritized due
to the current focus on correctness, CI, and architecture consolidation.

## What's Done

- None. All 947 lines (deep research engine, evaluation framework, performance
  suite) are aspirational.

## What Remains

All tasks remain unimplemented:

- Multi-step research engine (`scripts/deep_research.py`)
- Evaluation framework with 6 metrics (`scripts/evaluation.py`)
- Performance benchmarking suite (`scripts/performance_suite.py`)
- Test files for all three modules
- `psutil` dependency (not yet in `requirements.txt`)

## References

- [AUDIT.md](AUDIT.md) — Priority overview
- [ADR-009](009-cross-runtime-analysis.md) — Cross-runtime deep research parity
- [scripts/synthesis.py](../scripts/synthesis.py) — Related synthesis logic
