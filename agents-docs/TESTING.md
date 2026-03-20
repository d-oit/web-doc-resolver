# Testing Reference

Test structure and guidelines for `web-doc-resolver` (Python skill + Rust CLI).

## Python Skill Tests

### Location
```
tests/
├── conftest.py                    # Fixtures: mock HTTP, cache, quality scoring
├── test_resolve.py                # Main resolver unit tests (URL detection, cascade, cache, edge cases)
├── test_routing_foundation.py     # Routing, budget, negative cache, circuit breakers, routing memory
└── test_live_api_integrations.py  # Live integration tests (require API keys, marked @pytest.mark.live)
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

## Rust CLI Tests

### Location
```
cli/
├── src/
│   └── **/*.rs              # Unit tests in #[cfg(test)] modules
└── tests/                   # Integration tests (if present)
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

## Web UI Tests

### Location
```
web/
├── tests/
│   └── e2e/
│       └── app.spec.ts      # Playwright E2E tests (~30 tests, 8 suites)
└── playwright.config.ts     # 3 projects: desktop, mobile, dark-mode
```

### Running
```bash
cd web && npx playwright test --project=desktop
cd web && npx playwright test --ui  # Interactive UI mode
```

### Test Suites
- Page Load & Structure
- CSS & Theme (Tailwind, fonts)
- Form Interaction (input, submit, loading states)
- Error Handling
- Dark Mode
- Responsive Layout
- Keyboard Navigation
- Network Interception (mocked backend)
- Security Headers
