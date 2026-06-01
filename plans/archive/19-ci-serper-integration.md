# CI: Serper Integration + CLI Smoke Test + DB Coverage (2026-05-18)

> Generated 2026-05-18 after executing serper provider CI integration, CLI smoke test, and semantic cache DB coverage.
> Orchestrator: sequential agent dispatch with handoff coordination.

## Goal

Integrate serper provider into CI pipeline with a CLI smoke test and semantic cache database coverage, remove `.opencode/skills` symlink, and fix the `llms_txt` provider call signature in `resolve_direct`.

## Preconditions

- Main branch with all prior features merged
- Serper provider implemented in Python resolver & Rust CLI
- `.opencode/skills` symlink pointing to `.agents/skills/` (no longer needed — opencode now reads `.agents/skills/` directly)

## Actions Executed

### Wave 1 — CI Integration & Smoke Tests

| ID | Action | Result |
|----|--------|--------|
| A1 | Add serper CI job with CLI smoke test | `ci(integration): add serper CI job` |
| A2 | Fix Rust CLI subcommand for serper smoke test | `fix(ci): use correct Rust CLI subcommand` |
| A3 | Verify Rust CLI resolves query via serper | ✅ Working |
| A4 | Verify semantic cache DB is populated after resolve | ✅ `semantic_cache.db` present & tested |

### Wave 2 — Provider Testing & Bugfixes

| ID | Action | Result |
|----|--------|--------|
| B1 | Test all 5 free providers (exa_mcp, duckduckgo, jina, direct_fetch, llms_txt) | ✅ All working |
| B2 | Fix `llms_txt` signature mismatch in `resolve_direct` | `chore: remove .opencode/skills symlink, fix llms_txt signature` |
| B3 | Fix: `fetch_llms_txt(url)` was called with 2 args (`url, max_chars`) — wrapped in lambda returning `ResolvedResult` | ✅ `scripts/resolve.py:190` |
| B4 | Verify `quality_gate.sh` passes after fix | ✅ All checks passed |

### Wave 3 — .opencode/skills Cleanup

| ID | Action | Result |
|----|--------|--------|
| C1 | Remove `.opencode/skills` symlink | ✅ Done |
| C2 | Update symlink validation test (`tests/test_resolve.py`) — remove `.opencode/skills` entry | ✅ Done |
| C3 | Update `scripts/validate_skill_symlink.py` — remove `.opencode` from symlink dirs list | ✅ Done |
| C4 | Update `pyproject.toml` exclude patterns | ✅ Done |
| C5 | Scan all `.md` files for stale `.opencode/skills` refs | ✅ Clean (only CHANGELOG.md historical entry) |

### Wave 4 — Full Stack Verification

| ID | Component | Result |
|----|-----------|--------|
| D1 | Python unit tests (187 passed) | ✅ |
| D2 | Rust CLI build + resolve (query & URL) | ✅ |
| D3 | Rust `cargo test` (9 passed) | ✅ |
| D4 | Rust CLI JSON output | ✅ Valid |
| D5 | API providers (free tier) | ✅ All 5 working |
| D6 | `agent-browser` CLI | ✅ Installed, tested open/snapshot/close |
| D7 | Semantic cache DB + negative cache | ✅ Both working |
| D8 | Next.js web build | ✅ Clean build (0 errors) |
| D9 | Playwright tests (75 available) | ✅ Listed |
| D10 | CSS UI components (38 files) | ✅ Present |
| D11 | Quality gate | ✅ Passed |

## Key Bugfix: `llms_txt` Signature Mismatch

**Root cause**: In `scripts/resolve.py`, the `resolve_direct` function called every provider with `(input_str, max_chars)` (2 args), but `fetch_llms_txt(url)` only accepts 1 arg. The `ProviderType.LLMS_TXT` entry was mapped directly to `fetch_llms_txt`, causing a `TypeError` at runtime.

**Fix**: Wrapped in a lambda that accepts both args but only passes the URL to `fetch_llms_txt`, returning a `ResolvedResult` object:

```python
ProviderType.LLMS_TXT: lambda url, mc: (
    ResolvedResult(source="llms_txt", content=fetch_llms_txt(url) or "", url=url)
    if fetch_llms_txt(url)
    else None
),
```

## Key Finding: Skill Path Migration

- `.opencode/skills` was a symlink → `.agents/skills`
- opencode (the CLI tool) now reads skills directly from `.agents/skills/` — the symlink in `.opencode/skills/` is no longer needed
- All documentation already referenced `.agents/skills/` correctly — no doc updates needed
- Only test and validation code needed updating (they checked the symlink existed)

## Postconditions

1. **Serper CI job** added with CLI smoke test and DB coverage
2. **`.opencode/skills` symlink** removed, all references cleaned up
3. **`llms_txt` provider** fixed — no longer crashes when used via `resolve_direct`
4. **All free providers** verified working
5. **PR created** from `ci/serper-integration-db-cli` → `main`
6. **plans/ updated** with this document
