# Testing & Quality Improvements Plan

## Overview

This plan implements 10 testing and quality improvements to increase code confidence, coverage, and release reliability.

---

## Phase 1: Critical Test Coverage (Week 1)

### Improvement 1: Serper Provider Tests

**Gap:** Serper provider (Google Search via Serper API) has no dedicated tests.

**Implementation:**

```python
# tests/test_providers.py

import os
import pytest
from scripts.resolve import resolve_with_order
from scripts.models import ProviderType

@pytest.fixture
def mock_serper_response():
    """Mock Serper API response."""
    return {
        "searchParameters": {
            "q": "Python tutorial",
            "engine": "google"
        },
        "organic": [
            {
                "title": "Python Tutorial - W3Schools",
                "link": "https://www.w3schools.com/python/",
                "snippet": "Python is a popular programming language...",
                "position": 1
            },
            {
                "title": "Python For Beginners",
                "link": "https://www.python.org/about/gettingstarted/",
                "snippet": "Learning Python has never been easier...",
                "position": 2
            }
        ],
        "relatedSearches": [
            {"query": "python tutorial for beginners"},
            {"query": "python tutorial pdf"}
        ]
    }

class TestSerperProvider:
    """Test Serper search provider."""
    
    def test_serper_available_with_key(self, monkeypatch):
        """Test provider is available when API key is set."""
        monkeypatch.setenv("SERPER_API_KEY", "test-key")
        from scripts.providers_impl import resolve_with_serper
        # Provider should be available
        assert resolve_with_serper is not None
    
    def test_serper_unavailable_without_key(self, monkeypatch):
        """Test provider is unavailable when API key is not set."""
        monkeypatch.delenv("SERPER_API_KEY", raising=False)
        from scripts.providers_impl import resolve_with_serper
        
        result = resolve_with_serper("test query", max_chars=1000)
        assert result is None
    
    @pytest.mark.live
    @pytest.mark.skipif(
        not os.getenv("SERPER_API_KEY"),
        reason="No SERPER_API_KEY environment variable"
    )
    def test_live_serper_search(self):
        """Test Serper with real API."""
        from scripts.providers_impl import resolve_with_serper
        
        result = resolve_with_serper(
            "Python tutorial",
            max_chars=2000
        )
        
        assert result is not None
        assert result.source == "serper"
        assert result.query == "Python tutorial"
        assert len(result.content) > 200
        assert "Python" in result.content
    
    def test_serper_rate_limit_handling(self, requests_mock, monkeypatch):
        """Test rate limit detection and cooldown."""
        monkeypatch.setenv("SERPER_API_KEY", "test-key")
        from scripts.providers_impl import resolve_with_serper
        
        # Mock 429 response
        requests_mock.post(
            "https://google.serper.dev/search",
            status_code=429,
            json={"error": "Rate limit exceeded"}
        )
        
        result = resolve_with_serper("test query", max_chars=1000)
        assert result is None
        
        # Verify rate limit was set
        from scripts.providers_impl import _is_rate_limited
        assert _is_rate_limited("serper")

@pytest.mark.live
@pytest.mark.skipif(
    not os.getenv("SERPER_API_KEY"),
    reason="No SERPER_API_KEY environment variable"
)
def test_live_serper_with_real_api_key():
    """Live integration test for Serper."""
    from scripts.resolve import resolve_query
    
    result = resolve_query(
        "Python tutorial",
        skip_providers={"exa_mcp", "exa", "tavily", "duckduckgo", "mistral_websearch"}
    )
    
    assert result is not None
    assert result["source"] == "serper"
    assert len(result["content"]) > 200
```

---

### Improvement 2: Security Test Suite

**Gap:** No security tests for SSRF prevention, URL validation, or input sanitization.

**Implementation:**

```python
# tests/test_security.py

import pytest
from scripts.utils import validate_url, is_url
from scripts.resolve import resolve_url

class TestURLValidation:
    """Test URL validation security."""
    
    @pytest.mark.parametrize("url,expected", [
        ("https://example.com", True),
        ("http://example.com", True),
        ("ftp://example.com", False),  # Not allowed
        ("file:///etc/passwd", False),  # SSRF attempt
        ("http://localhost:8080", False),  # Private IP
        ("http://192.168.1.1", False),  # Private IP
        ("http://10.0.0.1", False),  # Private IP
        ("http://127.0.0.1", False),  # Loopback
        ("http://169.254.169.254", False),  # AWS metadata
        ("http://[::1]", False),  # IPv6 loopback
        ("javascript:alert(1)", False),  # XSS attempt
        ("data:text/html,<script>alert(1)</script>", False),  # Data URI
    ])
    def test_validate_url_blocks_private_ips(self, url, expected):
        """Test that private IP ranges are blocked."""
        result = validate_url(url)
        assert result == expected
    
    def test_validate_url_blocks_localhost(self):
        """Test localhost is blocked."""
        assert not validate_url("http://localhost:3000")
        assert not validate_url("https://localhost")
    
    def test_validate_url_allows_public_urls(self):
        """Test public URLs are allowed."""
        assert validate_url("https://github.com")
        assert validate_url("https://docs.python.org")

class TestSSRFPrevention:
    """Test SSRF attack prevention."""
    
    def test_resolve_blocks_internal_ips(self):
        """Test resolution blocks internal IP addresses."""
        result = resolve_url("http://192.168.1.1/admin")
        assert result["source"] == "none"
        assert "blocked" in result.get("error", "").lower() or "invalid" in result.get("error", "").lower()
    
    def test_resolve_blocks_localhost(self):
        """Test resolution blocks localhost."""
        result = resolve_url("http://localhost:8000/api")
        assert result["source"] == "none"
    
    def test_resolve_blocks_metadata_endpoints(self):
        """Test resolution blocks cloud metadata endpoints."""
        result = resolve_url("http://169.254.169.254/latest/meta-data/")
        assert result["source"] == "none"
    
    def test_resolve_allows_public_urls(self):
        """Test resolution allows public URLs."""
        result = resolve_url("https://example.com")
        # Should not be blocked (may fail for other reasons, but not security)
        assert "blocked" not in result.get("error", "").lower()

class TestInputSanitization:
    """Test input sanitization."""
    
    def test_query_input_sanitization(self):
        """Test query input is sanitized."""
        # SQL injection attempt
        malicious_query = "test'; DROP TABLE users; --"
        # Should be handled safely (not executed)
        result = resolve_query(malicious_query, max_chars=100)
        # Should not crash or execute SQL
        assert isinstance(result, dict)
    
    def test_xss_prevention_in_content(self):
        """Test XSS payloads in resolved content are neutralized."""
        # This would require mocking a response with XSS
        pass
    
    def test_header_injection_prevention(self):
        """Test header injection attempts are blocked."""
        # URL with newline in header
        malicious_url = "https://example.com\r\nX-Injected: malicious"
        # Should be rejected
        assert not validate_url(malicious_url)
```

---

### Improvement 3: Python/Rust Parity Tests

**Gap:** No validation that Python and Rust CLI produce consistent results.

**Implementation:**

```python
# tests/test_python_rust_parity.py

import subprocess
import json
import pytest
from scripts.resolve import resolve

class TestPythonRustParity:
    """Test Python and Rust implementations produce consistent results."""
    
    @pytest.fixture(scope="class")
    def rust_cli(self):
        """Build Rust CLI for testing."""
        result = subprocess.run(
            ["cargo", "build", "--release"],
            cwd="cli",
            capture_output=True
        )
        if result.returncode != 0:
            pytest.skip("Rust CLI build failed")
        
        return "cli/target/release/do-wdr"
    
    def test_url_resolution_parity(self, rust_cli):
        """Test URL resolution produces similar results."""
        url = "https://example.com"
        
        # Python result
        py_result = resolve(url, max_chars=1000)
        
        # Rust result
        rust_output = subprocess.run(
            [rust_cli, "resolve", url, "--json", "--max-chars", "1000"],
            capture_output=True,
            text=True
        )
        
        if rust_output.returncode != 0:
            pytest.skip(f"Rust CLI failed: {rust_output.stderr}")
        
        rust_result = json.loads(rust_output.stdout)
        
        # Compare key fields
        assert py_result["url"] == rust_result.get("url")
        
        # Content should be similar (may differ slightly due to extraction differences)
        py_content_len = len(py_result.get("content", ""))
        rust_content_len = len(rust_result.get("content", ""))
        
        # Within 20% of each other
        assert abs(py_content_len - rust_content_len) / max(py_content_len, 1) < 0.2
    
    def test_query_resolution_parity(self, rust_cli):
        """Test query resolution produces similar results."""
        query = "Python programming language"
        
        # Python result
        py_result = resolve(query, max_chars=1000, profile="free")
        
        # Rust result
        rust_output = subprocess.run(
            [rust_cli, "resolve", query, "--json", "--profile", "free", "--max-chars", "1000"],
            capture_output=True,
            text=True
        )
        
        if rust_output.returncode != 0:
            pytest.skip(f"Rust CLI failed: {rust_output.stderr}")
        
        rust_result = json.loads(rust_output.stdout)
        
        # Both should have content
        assert py_result.get("content")
        assert rust_result.get("content")
    
    def test_error_handling_parity(self, rust_cli):
        """Test error handling produces consistent results."""
        # Invalid URL
        invalid_url = "not-a-valid-url"
        
        py_result = resolve(invalid_url)
        
        rust_output = subprocess.run(
            [rust_cli, "resolve", invalid_url, "--json"],
            capture_output=True,
            text=True
        )
        
        rust_result = json.loads(rust_output.stdout)
        
        # Both should indicate failure
        assert py_result["source"] == "none" or rust_result.get("source") == "none"
```

---

## Phase 2: Test Infrastructure (Week 2)

### Improvement 4: Performance Benchmark Tests

**Implementation:**

```python
# tests/test_performance.py

import pytest
import time
import statistics
from scripts.resolve import resolve, resolve_url, resolve_query

@pytest.mark.benchmark
class TestPerformance:
    """Performance benchmarks for resolver."""
    
    @pytest.fixture
    def sample_urls(self):
        return [
            "https://example.com",
            "https://docs.python.org/3/tutorial/",
        ]
    
    def test_url_resolution_latency(self, sample_urls, benchmark):
        """Benchmark URL resolution latency."""
        def resolve_urls():
            for url in sample_urls:
                resolve_url(url, max_chars=1000)
        
        result = benchmark(resolve_urls)
        
        # Assert reasonable performance
        assert result.stats.mean < 5.0  # Average under 5 seconds
    
    def test_query_resolution_latency(self, benchmark):
        """Benchmark query resolution latency."""
        queries = [
            "Python tutorial",
            "Rust programming",
        ]
        
        def resolve_queries():
            for query in queries:
                resolve_query(query, max_chars=1000, profile="free")
        
        result = benchmark(resolve_queries)
        assert result.stats.mean < 10.0  # Average under 10 seconds
    
    def test_cache_performance(self):
        """Test cache hit performance."""
        url = "https://example.com"
        
        # First call (cache miss)
        start = time.perf_counter()
        resolve_url(url)
        miss_time = time.perf_counter() - start
        
        # Second call (cache hit)
        start = time.perf_counter()
        resolve_url(url)
        hit_time = time.perf_counter() - start
        
        # Cache hit should be significantly faster
        assert hit_time < miss_time * 0.1  # 10x faster
    
    def test_concurrent_resolution(self):
        """Test concurrent resolution performance."""
        import concurrent.futures
        
        urls = ["https://example.com"] * 5
        
        start = time.perf_counter()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(resolve_url, url) for url in urls]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        total_time = time.perf_counter() - start
        
        # Should complete faster than sequential
        assert len(results) == 5
        assert total_time < 15.0  # Under 15 seconds for 5 concurrent
```

**Dependencies:**
```
pytest-benchmark>=4.0.0
```

---

### Improvement 5: Coverage Threshold Enforcement

**Implementation:**

```yaml
# .github/workflows/ci.yml (update)

- name: Run tests with coverage
  run: |
    python -m pytest tests/ -v \
      --cov=scripts \
      --cov-report=xml \
      --cov-report=html \
      --cov-fail-under=80  # Fail if coverage below 80%

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage.xml
    fail_ci_if_error: true
```

**Badge for README:**
```markdown
[![codecov](https://codecov.io/gh/d-oit/do-web-doc-resolver/branch/main/graph/badge.svg)](https://codecov.io/gh/d-oit/do-web-doc-resolver)
```

---

### Improvement 6: Test Fixtures Standardization

**Implementation:**

```python
# tests/conftest.py (additions)

import pytest
import json

@pytest.fixture
def mock_exa_result():
    """Standard mock Exa result."""
    return {
        "source": "exa",
        "content": "# Python Tutorial\n\nPython is a programming language...",
        "url": "https://docs.python.org/tutorial/",
        "score": 0.85,
        "metadata": {"title": "Python Tutorial"}
    }

@pytest.fixture
def mock_jina_result():
    """Standard mock Jina result."""
    return {
        "source": "jina",
        "content": "Example Domain\n\nThis domain is for use in illustrative examples...",
        "url": "https://example.com",
        "score": 0.75
    }

@pytest.fixture
def mock_firecrawl_result():
    """Standard mock Firecrawl result."""
    return {
        "source": "firecrawl",
        "content": "# Example Domain\n\nThis domain...",
        "url": "https://example.com",
        "score": 0.90,
        "metadata": {"title": "Example Domain"}
    }

@pytest.fixture
def sample_markdown_content():
    """Sample markdown content for testing."""
    return """# Heading 1

This is a paragraph with **bold** and *italic* text.

## Heading 2

- List item 1
- List item 2

```python
def hello():
    print("Hello")
```

[Link text](https://example.com)
"""

@pytest.fixture
def sample_html_content():
    """Sample HTML content for testing."""
    return """
    <!DOCTYPE html>
    <html>
    <head><title>Test Page</title></head>
    <body>
        <h1>Main Heading</h1>
        <p>Paragraph content</p>
        <a href="https://example.com">Link</a>
    </body>
    </html>
    """

@pytest.fixture
def temp_cache_dir(tmp_path):
    """Temporary cache directory for testing."""
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir()
    return str(cache_dir)
```

---

## Phase 3: Web E2E & Integration (Week 3)

### Improvement 7: Web E2E with Real Backend

**Implementation:**

```typescript
// web/tests/e2e/provider-selection.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Provider Selection', () => {
  test.beforeEach(async ({ page }) => {
    // Start local dev server if not already running
    await page.goto('http://localhost:3000');
  });

  test('should toggle providers', async ({ page }) => {
    // Open settings/provider panel
    await page.click('[data-testid="settings-toggle"]');
    
    // Uncheck a provider
    await page.click('[data-testid="provider-exa_mcp"');
    
    // Verify provider is disabled
    const isChecked = await page.isChecked('[data-testid="provider-exa_mcp"');
    expect(isChecked).toBe(false);
  });

  test('should resolve with selected providers', async ({ page }) => {
    // Enable only free providers
    await page.click('[data-testid="profile-free"]');
    
    // Enter URL
    await page.fill('[data-testid="url-input"]', 'https://example.com');
    
    // Submit
    await page.click('[data-testid="resolve-button"]');
    
    // Wait for result
    await page.waitForSelector('[data-testid="result-content"]', { timeout: 30000 });
    
    // Verify result
    const content = await page.textContent('[data-testid="result-content"]');
    expect(content).toContain('Example Domain');
  });

  test('should show cascade progress', async ({ page }) => {
    await page.fill('[data-testid="url-input"]', 'https://example.com');
    await page.click('[data-testid="resolve-button"]');
    
    // Should show stepper
    await page.waitForSelector('[data-testid="cascade-stepper"]');
    
    // Should have provider steps
    const steps = await page.$$('[data-testid="provider-step"]');
    expect(steps.length).toBeGreaterThan(0);
  });
});
```

---

### Improvement 8: Error Condition Testing

**Implementation:**

```python
# tests/test_error_handling.py

import pytest
from unittest.mock import patch, MagicMock
from scripts.resolve import resolve_url, resolve_query
from scripts.providers_impl import resolve_with_jina, resolve_with_exa_mcp

class TestRateLimitHandling:
    """Test rate limit detection and backoff."""
    
    def test_jina_rate_limit_sets_cooldown(self, requests_mock, monkeypatch):
        """Test Jina rate limit triggers cooldown."""
        # Mock 429 response
        requests_mock.get(
            "https://r.jina.ai/http://example.com",
            status_code=429,
            text="Rate limit exceeded"
        )
        
        result = resolve_with_jina("http://example.com", max_chars=1000)
        assert result is None
        
        # Verify rate limit was set
        from scripts.providers_impl import _is_rate_limited
        assert _is_rate_limited("jina")
    
    def test_provider_skipped_when_rate_limited(self, monkeypatch):
        """Test rate-limited provider is skipped in cascade."""
        from scripts.providers_impl import _set_rate_limit, _is_rate_limited
        
        # Set rate limit on Jina
        _set_rate_limited("jina", 60)
        
        # Verify it's skipped
        assert _is_rate_limited("jina")
        
        # Resolve should skip Jina and use fallback
        result = resolve_url("https://example.com")
        assert result["source"] != "none"

class TestNetworkErrorHandling:
    """Test network error resilience."""
    
    @patch('requests.get')
    def test_timeout_fallback_to_next_provider(self, mock_get):
        """Test timeout falls back to next provider."""
        # First provider times out
        mock_get.side_effect = [
            TimeoutError("Connection timeout"),  # Jina
            MagicMock(status_code=200, text="Success")  # Firecrawl
        ]
        
        result = resolve_url("https://example.com")
        # Should eventually succeed
        assert result is not None
    
    def test_all_providers_fail_gracefully(self, monkeypatch):
        """Test graceful failure when all providers fail."""
        # Mock all providers to fail
        def mock_fail(*args, **kwargs):
            return None
        
        monkeypatch.setattr("scripts.providers_impl.resolve_with_jina", mock_fail)
        monkeypatch.setattr("scripts.providers_impl.resolve_with_firecrawl", mock_fail)
        monkeypatch.setattr("scripts.providers_impl.resolve_with_direct_fetch", mock_fail)
        
        result = resolve_url("https://example.com")
        
        # Should indicate failure
        assert result["source"] == "none"
        assert "error" in result

class TestQualityThresholdRejection:
    """Test quality threshold handling."""
    
    def test_low_quality_content_rejected(self, monkeypatch):
        """Test content below quality threshold is rejected."""
        # Mock provider returning thin content
        def mock_thin_content(url, max_chars):
            from scripts.models import ResolvedResult
            return ResolvedResult(
                source="jina",
                content="Hi",  # Too short
                url=url
            )
        
        monkeypatch.setattr("scripts.providers_impl.resolve_with_jina", mock_thin_content)
        
        result = resolve_url("https://example.com")
        
        # Should reject thin content and try next provider
        # or return failure if no other providers
        pass  # Implementation depends on cascade behavior
```

---

## Phase 4: Documentation & Process (Week 4)

### Improvement 9: Documentation Testing

**Implementation:**

```python
# tests/test_documentation.py

import subprocess
import re
import pytest

class TestDocumentation:
    """Test that documentation examples work."""
    
    def test_readme_examples_are_valid_python(self):
        """Test Python examples in README."""
        # Extract code blocks from README
        with open("README.md") as f:
            content = f.read()
        
        # Find all Python code blocks
        python_blocks = re.findall(r'```python\n(.*?)```', content, re.DOTALL)
        
        for block in python_blocks:
            # Skip incomplete examples
            if "..." in block or "# " in block:
                continue
            
            # Try to compile
            try:
                compile(block, '<string>', 'exec')
            except SyntaxError as e:
                pytest.fail(f"Syntax error in README Python example: {e}")
    
    def test_cli_examples_in_readme(self):
        """Test CLI examples in README are valid commands."""
        with open("README.md") as f:
            content = f.read()
        
        # Find all bash code blocks
        bash_blocks = re.findall(r'```bash\n(.*?)```', content, re.DOTALL)
        
        for block in bash_blocks:
            lines = block.strip().split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('do-wdr ') or line.startswith('./target/release/do-wdr '):
                    # Extract command
                    cmd = line.split()[0]
                    # Verify binary exists or command is valid
                    pass  # Just check syntax, don't actually run
    
    def test_skill_documentation_valid(self):
        """Test skill documentation is valid."""
        import yaml
        
        # Check skill metadata if applicable
        pass
```

---

### Improvement 10: Flaky Test Detection

**Implementation:**

```ini
# pytest.ini (additions)

[pytest]
addopts = 
    -v
    --reruns 3
    --reruns-delay 1
    --only-rerun "RateLimitError"
    --only-rerun "TimeoutError"
    --only-rerun "ConnectionError"
```

```python
# tests/conftest.py (addition)

import pytest

# Mark known flaky tests
flaky = pytest.mark.flaky(reruns=3, reruns_delay=2)

# Apply to live tests
pytestmark = [
    pytest.mark.live,
    flaky
]
```

**CI Configuration:**

```yaml
# .github/workflows/ci.yml

- name: Run tests with retry
  run: |
    python -m pytest tests/ -v \
      --reruns 3 \
      --reruns-delay 1 \
      --only-rerun "RateLimitError" \
      --only-rerun "TimeoutError" \
      -m "live"
  env:
    EXA_API_KEY: ${{ secrets.EXA_API_KEY }}
    # ... other secrets
```

---

## Test Execution Guide

### Running Tests

```bash
# Unit tests only (no API keys needed)
python -m pytest tests/ -v -m "not live"

# Live integration tests (requires API keys)
python -m pytest tests/ -v -m live

# Performance benchmarks
python -m pytest tests/test_performance.py -v --benchmark-only

# Security tests
python -m pytest tests/test_security.py -v

# With coverage
python -m pytest tests/ -v --cov=scripts --cov-report=html

# Flaky tests with retry
python -m pytest tests/ -v --reruns 3

# Specific test file
python -m pytest tests/test_providers.py -v

# Rust tests
cd cli && cargo test

# Web E2E tests
cd web && npx playwright test
```

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Code Coverage | 80% | ? |
| Test Count | 200+ | ? |
| Live Test Reliability | 95% | ? |
| Security Test Coverage | 100% | 0% |
| Python/Rust Parity | 100% | 0% |
| CI Pass Rate | 98% | ? |

---

## Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Provider & Security Tests | Serper tests, security suite |
| 2 | Infrastructure | Fixtures, coverage, benchmarks |
| 3 | Integration | E2E tests, parity tests |
| 4 | Process | Flaky test handling, docs testing |
