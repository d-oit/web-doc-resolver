# Implementation Plans Master Index

## Overview

This directory contains comprehensive implementation plans for improving the do-web-doc-resolver project. Each plan covers a specific domain with detailed tasks, code examples, and timelines.

**Note:** Brave Search API integration has been excluded as requested.

---

## Plan Directory

| Plan | File | Priority | Duration | Key Outcomes |
|------|------|----------|----------|--------------|
| **Architecture** | [01-architecture-improvements.md](01-architecture-improvements.md) | P0 | 6 weeks | PyO3 bindings, async optimization, unified provider trait |
| **Performance** | [03-performance-optimization.md](03-performance-optimization.md) | P1 | 4 weeks | 30-50% latency reduction, L1 cache, HTTP/2 |
| **New Features** | [04-new-features.md](04-new-features.md) | P2 | 8 weeks | Batch API, streaming, webhooks, metrics dashboard |
| **UI/UX** | [05-ui-ux-improvements.md](05-ui-ux-improvements.md) | P2 | 4 weeks | Stepper, streaming UI, syntax highlighting, accessibility, result dedupe |
| **Testing** | [06-testing-improvements.md](06-testing-improvements.md) | P1 | 4 weeks | Security tests, parity tests, performance benchmarks |
| **Documentation** | [07-documentation-improvements.md](07-documentation-improvements.md) | P2 | 4 weeks | Tutorial, ADRs, dev container, OpenAPI spec |
| **Deep Research** | [08-deep-research.md](08-deep-research.md) | P0 | 2 weeks | Deep research capabilities, evaluation framework |

---

## Quick Start by Priority

### P0 - Critical (Immediate)

1. **Async Mutex Migration** ([Architecture Plan](01-architecture-improvements.md))
   - Replace `std::sync::Mutex` with `tokio::sync::RwLock`
   - Eliminates blocking in async context
   - 10-20% throughput improvement

2. **Deep Research & Evaluation** ([Deep Research Plan](08-deep-research.md))
   - Multi-step research capabilities
   - Comprehensive evaluation framework
   - Performance benchmarking suite

### P1 - High Priority (Next 4-6 weeks)

3. **Performance Optimizations** ([Performance Plan](03-performance-optimization.md))
   - ThreadPool reuse (5-50ms reduction)
   - L1 in-memory cache (10-20ms hits)
   - HTTP/2 + keep-alive (20-40% latency)

4. **Deep Research & Evaluation Framework** ([Deep Research Plan](08-deep-research.md))
   - Multi-step research capabilities
   - Comprehensive evaluation metrics
   - Performance benchmarking

5. **Security Test Suite** ([Testing Plan](06-testing-improvements.md))
   - SSRF prevention tests
   - URL validation tests
   - Input sanitization tests

6. **Python/Rust Parity Tests** ([Testing Plan](06-testing-improvements.md))
   - Cross-implementation validation
   - Ensures feature parity
   - Consistent behavior

### P2 - Medium Priority (Next 8 weeks)

8. **Structured JSON Output** ([Features Plan](04-new-features.md))
   - Parse markdown into sections
   - Extract metadata, links, images
   - API and CLI support

9. **Batch Resolution API** ([Features Plan](04-new-features.md))
   - Process 20 URLs/queries in parallel
   - Max 5 concurrent requests
   - Consolidated results

10. **Cascade Progress Stepper** ([UI/UX Plan](05-ui-ux-improvements.md))
    - Real-time provider visibility
    - Visual progress indication
    - Success/failure states

11. **Streaming Response UI** ([UI/UX Plan](05-ui-ux-improvements.md))
    - Server-Sent Events (SSE)
    - Real-time content display
    - Provider status updates

12. **Getting Started Tutorial** ([Documentation Plan](07-documentation-improvements.md))
    - 5-minute walkthrough
    - Common issues guide
    - Next steps

---

## Implementation Dependencies

### Cross-Plan Dependencies

```
Architecture (Weeks 1-6)
├── Enables: Performance optimization (shared client)
├── Enables: Deep research (core capabilities)
└── Enables: Testing parity (unified core)

Deep Research (Weeks 1-2)
├── Enables: New features (research capabilities)
└── Enables: Testing improvements (evals framework)

Performance (Weeks 1-4)
├── Enables: UI streaming (fast endpoints)
└── Enables: Batch API (parallel processing)

UI/UX (Weeks 5-8)
├── Depends on: Streaming backend
└── Depends on: Provider status APIs

Testing (Weeks 1-4)
├── Validates: All other plans
└── Blocks: Release if failing
```

---

## Resource Requirements

### Personnel

| Plan | Frontend | Backend | DevOps | QA |
|------|----------|---------|--------|-----|
| Architecture | 0 | 2 | 0 | 1 |
| Deep Research | 0 | 2 | 0 | 1 |
| Performance | 0 | 2 | 1 | 1 |
| Features | 1 | 2 | 1 | 1 |
| UI/UX | 2 | 1 | 0 | 1 |
| Testing | 0 | 1 | 1 | 2 |
| Documentation | 1 | 1 | 0 | 1 |

### Infrastructure

- **Dev containers**: Docker with Python 3.12, Rust, Node.js 22
- **CI/CD**: GitHub Actions with test matrix
- **Staging environment**: For integration testing
- **Monitoring**: For performance benchmarks

---

## Success Metrics by Plan

### Architecture
- [ ] 10-30% throughput improvement
- [ ] Zero blocking operations in async context
- [ ] ~200 lines of code reduction via unified trait
- [ ] Python bindings functional

### Deep Research
- [ ] Multi-step research capability
- [ ] Evaluation framework with >90% accuracy
- [ ] Performance benchmarking suite
- [ ] Research quality metrics defined

### Performance
- [ ] 30-50% latency reduction overall
- [ ] 5x improvement for cache hits
- [ ] 20-40% reduction for repeated domains
- [ ] Benchmark suite passing

### Features
- [ ] Batch API processes 20 requests
- [ ] Streaming delivers first chunk < 2s
- [ ] Webhooks deliver within 30s of completion
- [ ] Dashboard displays real-time metrics

### UI/UX
- [ ] WCAG 2.2 AA compliance
- [ ] Mobile-friendly history
- [ ] Syntax highlighting for all code blocks
- [ ] Reduced motion support

### Testing
- [ ] 80%+ code coverage
- [ ] 200+ total tests
- [ ] 95%+ live test reliability
- [ ] 100% security test coverage

### Documentation
- [ ] Tutorial completion rate > 80%
- [ ] 6 ADRs published
- [ ] Dev container adoption > 50%
- [ ] OpenAPI spec complete

---

## Risk Mitigation

| Risk | Plan | Mitigation |
|------|------|------------|
| PyO3 complexity | Architecture | Start simple, expand incrementally |
| API rate limits | Providers | Extensive mocking, staggered live tests |
| Performance regression | Performance | Benchmark before/after each change |
| UI/backend coupling | Features | API-first development, mocks |
| Test flakiness | Testing | Retry logic, provider health checks |
| Doc drift | Documentation | Link validation in CI |

---

## Recommended Execution Order

### Month 1: Foundation
1. Week 1-2: Async mutex migration + Performance quick wins + Deep research framework
2. Week 3-4: Evaluation suite + Security tests + Python/Rust parity

### Month 2: Expansion
3. Week 5-6: Batch API + Streaming backend
4. Week 7-8: UI stepper + Performance monitoring

### Month 3: Polish
5. Week 9-10: PyO3 bindings + Documentation
6. Week 11-12: Remaining features + Final testing

---

## Plan Selection Guide

### "I want quick wins" → Performance Plan (Week 1)
- ThreadPool reuse
- L1 cache
- HTTP/2

### "I want more free providers" → Providers Plan
- ScrapingAnt (10K free)
- Tavily Extract (reuses key)

### "I want better UX" → UI/UX Plan
- Stepper component
- Syntax highlighting
- Error recovery

### "I want enterprise features" → Features Plan
- Batch API
- Webhooks
- Metrics dashboard

### "I want reliability" → Testing Plan
- Security tests
- Provider tests
- Parity tests

### "I want contributors" → Documentation Plan
- Tutorial
- Dev container
- Contributing guide

---

## Questions?

- Review individual plan files for detailed implementation
- Check AGENTS.md for project conventions
- Open an issue for plan clarifications
