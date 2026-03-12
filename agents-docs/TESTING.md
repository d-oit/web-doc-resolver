# Testing Reference

Test structure and guidelines for `web-doc-resolver` (Python skill + Rust `wdr` CLI).

## Python Skill Tests

### Location
```
tests/
├── test_resolve.py       # Unit tests for resolve logic
├── test_providers.py     # Per-provider mock tests
├── test_cascade.py       # Cascade order + skip logic
└── conftest.py           # Fixtures, mock HTTP server
```

### Running
```bash
pip install pytest pytest-asyncio
pytest tests/ -v
```

### Key Test Cases
- Provider skip via `--skip` flag
- Custom cascade order via `--providers-order`
- 429 rate limit → skip to next provider
- 401/403 auth error → skip provider
- Content too short → try next
- All providers fail → return error JSON
- Missing API key → provider silently skipped

## Rust CLI Tests (wdr)

### Location
```
wdr/
├── src/
│   └── **/*.rs              # Unit tests in #[cfg(test)] modules
└── tests/
    ├── integration/
    │   ├── cascade_test.rs  # End-to-end cascade tests
    │   ├── cli_test.rs      # CLI flag parsing tests
    │   └── output_test.rs   # JSON output format tests
    └── providers/
        ├── jina_test.rs     # Jina provider with mock
        ├── exa_test.rs      # Exa provider with mock
        └── ...              # One file per provider
```

### Running
```bash
cargo test
cargo test -- --nocapture   # Show log output
cargo test --test integration  # Integration only
```

### Mock HTTP Server
Use `wiremock` or `httpmock` crate for provider tests:
```rust
let server = MockServer::start().await;
Mock::given(method("GET"))
    .and(path("/"))
    .respond_with(ResponseTemplate::new(200).set_body_string("content"))
    .mount(&server)
    .await;
```

### Required Test Coverage

| Module | Min Coverage |
|--------|--------------|
| `config.rs` | 90% |
| `resolver.rs` | 85% |
| `error.rs` | 80% |
| `providers/*.rs` | 80% each |
| `cli.rs` | 75% |

### CI Test Matrix
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    rust: [stable, beta]
```

## Test Naming Convention

- Unit: `test_<function>_<scenario>` (e.g., `test_resolve_skips_on_rate_limit`)
- Integration: `test_<feature>_<end_to_end_scenario>`
- Mock files: `<provider>_mock.json` in `tests/fixtures/`

## Lint & Quality
```bash
# Rust
cargo clippy -- -D warnings
cargo fmt --check

# Python
ruff check scripts/ tests/
mypy scripts/
```
