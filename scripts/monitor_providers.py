#!/usr/bin/env python3
import logging
import os
import re
import sys
import time
from datetime import datetime
from enum import Enum

import requests

# Add current directory to path
sys.path.insert(0, os.path.abspath(os.curdir))

from scripts.utils import get_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("monitor_providers")

TEST_URL = "https://docs.python.org/3/"
TEST_QUERY = "Latest Python 3.13 features"
ISSUES_FILE = "agents-docs/ISSUES.md"
ROUTING_FILE = "scripts/routing.py"

# Retry configuration
MAX_RETRIES = 2
RETRY_BACKOFF = 3  # seconds between retries


class CheckResult(Enum):
    HEALTHY = "healthy"
    FAILED = "failed"
    SKIPPED = "skipped"


def _get_workflow_url() -> str:
    """Build a link to the current GitHub Actions run, if available."""
    server = os.getenv("GITHUB_SERVER_URL", "https://github.com")
    repo = os.getenv("GITHUB_REPOSITORY", "")
    run_id = os.getenv("GITHUB_RUN_ID", "")
    if repo and run_id:
        return f"{server}/{repo}/actions/runs/{run_id}"
    return "local run (not in GitHub Actions)"


def update_routing_priority(provider_name: str):
    """Move failing provider to the absolute end of the routing list in routing.py."""
    if not os.path.exists(ROUTING_FILE):
        logger.error(f"{ROUTING_FILE} not found")
        return

    with open(ROUTING_FILE) as f:
        content = f.read()

    # Find ALL base = [...] lists, potentially multi-line. Use word boundary for 'base'.
    matches = list(re.finditer(r"(\bbase\b\s*=\s*\[)([^\]]+)(\])", content, re.DOTALL))
    if not matches:
        logger.error("Could not find any provider base list in routing.py")
        return

    new_content = content
    found_any = False

    # Process in reverse to keep offsets valid
    for match in reversed(matches):
        prefix, providers_raw, suffix = match.groups()
        # Clean up and split
        providers = []
        for p in providers_raw.split(","):
            p_strip = p.strip().strip('"').strip("'")
            if p_strip:
                providers.append(p_strip)

        if provider_name in providers:
            # Check if it's already at the end
            if providers[-1] == provider_name:
                continue

            found_any = True
            providers.remove(provider_name)
            providers.append(provider_name)

            # Reconstruct the list string, trying to maintain one-line vs multi-line
            if "\n" in providers_raw:
                # Naive multi-line reconstruction: use same indentation if possible
                indent_match = re.search(r"\n(\s+)", providers_raw)
                indent = indent_match.group(1) if indent_match else "        "
                new_providers_str = (
                    "\n" + indent + (",\n" + indent).join([f'"{p}"' for p in providers]) + ",\n    "
                )
            else:
                new_providers_str = ", ".join([f'"{p}"' for p in providers])

            new_match_str = f"{prefix}{new_providers_str}{suffix}"
            new_content = new_content[: match.start()] + new_match_str + new_content[match.end() :]

    if found_any:
        with open(ROUTING_FILE, "w") as f:
            f.write(new_content)
        logger.info(f"Deprioritized {provider_name} in {ROUTING_FILE}")
    else:
        logger.info(f"Provider {provider_name} already deprioritized or not found in routing lists")


def open_github_issue(provider_name: str, issue_desc: str):
    """Open an issue on GitHub if running in CI."""
    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("GITHUB_REPOSITORY")
    if not token or not repo:
        logger.info(
            "Not running in GitHub Actions or GITHUB_TOKEN not set, skipping actual issue creation."
        )
        return

    title = f"Provider Alert: {provider_name} unstable"

    # Check for existing open issues with same title to avoid duplicates
    url_list = f"https://api.github.com/repos/{repo}/issues"
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
    params = {"state": "open", "labels": "provider-alert"}

    try:
        list_resp = requests.get(url_list, headers=headers, params=params, timeout=10)
        if list_resp.status_code == 200:
            existing_issues = list_resp.json()
            if any(issue["title"] == title for issue in existing_issues):
                logger.info(f"Open issue already exists: {title}. Skipping creation.")
                return
    except Exception as e:
        logger.warning(f"Failed to check for existing issues: {e}")

    workflow_url = _get_workflow_url()
    body = f"""
### Provider Instability Detected

- **Provider**: {provider_name}
- **Date**: {datetime.now().strftime("%Y-%m-%d %H:%M UTC")}
- **Error**: {issue_desc}
- **Workflow Run**: [{workflow_url}]({workflow_url})

Automated routing has deprioritized this provider. Please check:
- [ ] Connectivity to the provider API
- [ ] API key presence and validity in GitHub Actions secrets
- [ ] Whether this is a transient timeout or a persistent failure
"""

    data = {"title": title, "body": body, "labels": ["provider-alert", "automated"]}

    try:
        resp = requests.post(url_list, headers=headers, json=data, timeout=10)
        if resp.status_code == 201:
            logger.info(f"Successfully opened GitHub issue: {title}")
        else:
            logger.error(f"Failed to open GitHub issue: {resp.status_code} {resp.text}")
    except Exception as e:
        logger.error(f"Error opening GitHub issue: {e}")


def log_issue(provider_name: str, issue_desc: str, api_key_present: bool = True):
    """Log the alert in ISSUES.md and open GitHub issue."""
    date_str = datetime.now().strftime("%Y-%m-%d")
    workflow_url = _get_workflow_url()
    key_status = "present" if api_key_present else "MISSING"

    # Check if this alert already exists in ISSUES.md to avoid duplicates
    should_append = True
    if os.path.exists(ISSUES_FILE):
        with open(ISSUES_FILE) as f:
            existing_content = f.read()
            if (
                f"# Provider Alert: {provider_name} unstable" in existing_content
                and date_str in existing_content
            ):
                logger.info(
                    f"Issue for {provider_name} already logged today in {ISSUES_FILE}, skipping local log."
                )
                should_append = False

    if should_append:
        alert_text = f"""
# Provider Alert: {provider_name} unstable

- **Date**: {date_str}
- **Issue**: {issue_desc}
- **API Key**: {key_status}
- **Action Taken**: Deprioritized {provider_name} in the routing logic.
- **Status**: Monitoring for stability.
- **Workflow Run**: {workflow_url}
"""
        with open(ISSUES_FILE, "a") as f:
            f.write(alert_text)
        logger.info(f"Logged issue for {provider_name} in {ISSUES_FILE}")

    open_github_issue(provider_name, issue_desc)


def _check_with_retry(check_func, provider_name: str) -> tuple[CheckResult, str | None]:
    """Run a check function with retry logic and backoff."""
    last_result, last_error = CheckResult.FAILED, "Unknown error"
    for attempt in range(1, MAX_RETRIES + 2):  # +2 = initial try + MAX_RETRIES
        last_result, last_error = check_func()
        if last_result != CheckResult.FAILED:
            return last_result, last_error
        if attempt <= MAX_RETRIES:
            logger.warning(
                f"{provider_name} attempt {attempt} failed: {last_error}. "
                f"Retrying in {RETRY_BACKOFF}s..."
            )
            time.sleep(RETRY_BACKOFF)
        else:
            logger.error(
                f"{provider_name} failed after {MAX_RETRIES + 1} attempts. Last error: {last_error}"
            )
    return last_result, last_error


def check_jina() -> tuple[CheckResult, str | None]:
    logger.info("Checking Jina...")
    url = f"https://r.jina.ai/{TEST_URL}"
    try:
        session = get_session()
        resp = session.get(url, headers={"Accept": "text/markdown"}, timeout=15)
        if resp.status_code != 200:
            return CheckResult.FAILED, f"HTTP {resp.status_code}"
        if not resp.text.strip():
            return CheckResult.FAILED, "Empty response content"
        return CheckResult.HEALTHY, None
    except Exception as e:
        return CheckResult.FAILED, str(e)


def check_firecrawl() -> tuple[CheckResult, str | None]:
    logger.info("Checking Firecrawl...")
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        logger.warning("FIRECRAWL_API_KEY is not set in environment / GitHub Actions secrets")
        return CheckResult.SKIPPED, "No API Key (FIRECRAWL_API_KEY secret not found)"
    logger.info("FIRECRAWL_API_KEY is present, proceeding with health check")
    try:
        session = get_session()
        resp = session.post(
            "https://api.firecrawl.dev/v1/scrape",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"url": TEST_URL, "formats": ["markdown"]},
            timeout=35,  # increased from 20s — scrape endpoint can be slow on cold start
        )
        if resp.status_code == 401:
            return CheckResult.FAILED, "HTTP 401 Unauthorized - API key may be invalid or expired"
        if resp.status_code != 200:
            return CheckResult.FAILED, f"HTTP {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        if "data" not in data or "markdown" not in data["data"]:
            return CheckResult.FAILED, f"Response schema changed: 'data.markdown' missing. Keys: {list(data.keys())}"
        return CheckResult.HEALTHY, None
    except requests.exceptions.Timeout:
        return CheckResult.FAILED, "Read timeout after 35s (api.firecrawl.dev unreachable or overloaded)"
    except Exception as e:
        return CheckResult.FAILED, f"{type(e).__name__}: {e}"


def check_tavily() -> tuple[CheckResult, str | None]:
    logger.info("Checking Tavily...")
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return CheckResult.SKIPPED, "No API Key (TAVILY_API_KEY secret not found)"
    try:
        session = get_session()
        resp = session.post(
            "https://api.tavily.com/search",
            json={"api_key": api_key, "query": TEST_QUERY, "max_results": 1},
            timeout=15,
        )
        if resp.status_code != 200:
            return CheckResult.FAILED, f"HTTP {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        if "results" not in data:
            return CheckResult.FAILED, "Response schema changed: 'results' missing"
        return CheckResult.HEALTHY, None
    except Exception as e:
        return CheckResult.FAILED, f"{type(e).__name__}: {e}"


def check_serper() -> tuple[CheckResult, str | None]:
    logger.info("Checking Serper...")
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return CheckResult.SKIPPED, "No API Key (SERPER_API_KEY secret not found)"
    try:
        session = get_session()
        resp = session.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": TEST_QUERY, "num": 1},
            timeout=15,
        )
        if resp.status_code != 200:
            return CheckResult.FAILED, f"HTTP {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        if "organic" not in data:
            return CheckResult.FAILED, "Response schema changed: 'organic' missing"
        return CheckResult.HEALTHY, None
    except Exception as e:
        return CheckResult.FAILED, f"{type(e).__name__}: {e}"


def check_exa() -> tuple[CheckResult, str | None]:
    logger.info("Checking Exa...")
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        return CheckResult.SKIPPED, "No API Key (EXA_API_KEY secret not found)"
    try:
        session = get_session()
        resp = session.post(
            "https://api.exa.ai/search",
            headers={"x-api-key": api_key, "Content-Type": "application/json"},
            json={"query": TEST_QUERY, "numResults": 1},
            timeout=15,
        )
        if resp.status_code != 200:
            return CheckResult.FAILED, f"HTTP {resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        if "results" not in data:
            return CheckResult.FAILED, "Response schema changed: 'results' missing"
        return CheckResult.HEALTHY, None
    except Exception as e:
        return CheckResult.FAILED, f"{type(e).__name__}: {e}"


def main():
    checks = {
        "jina": check_jina,
        "firecrawl": check_firecrawl,
        "tavily": check_tavily,
        "serper": check_serper,
        "exa": check_exa,
        "exa_mcp": check_exa,
    }

    failing_providers = []
    skipped_providers = []

    for name, check_func in checks.items():
        result, error = _check_with_retry(check_func, name)
        if result == CheckResult.FAILED:
            logger.error(f"[FAIL] {name}: {error}")
            failing_providers.append((name, error))
        elif result == CheckResult.SKIPPED:
            logger.warning(f"[SKIP] {name}: {error}")
            skipped_providers.append((name, error))
        else:
            logger.info(f"[OK]   {name} is healthy")

    if skipped_providers:
        logger.info(f"Skipped providers (missing API keys): {[n for n, _ in skipped_providers]}")

    if not failing_providers:
        logger.info("All checked providers are healthy.")
        return

    logger.error(f"Failing providers: {[n for n, _ in failing_providers]}")
    for name, error in failing_providers:
        # Determine if failure is key-related (SKIPPED) or runtime
        api_key_present = name not in [n for n, _ in skipped_providers]
        update_routing_priority(name)
        log_issue(name, error, api_key_present=api_key_present)


if __name__ == "__main__":
    main()
