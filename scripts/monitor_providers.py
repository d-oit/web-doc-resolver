#!/usr/bin/env python3
import logging
import os
import re
import sys
from datetime import datetime

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

            # Reconstruct the list string. Keep it on one line for simplicity as per repo style.
            new_providers_str = ", ".join([f'"{p}"' for p in providers])

            new_match_str = f"{prefix}{new_providers_str}{suffix}"
            new_content = new_content[: match.start()] + new_match_str + new_content[match.end() :]

    if found_any:
        # Also update the comment date if possible
        date_match = re.search(r"#.*Alert (\d{4}-\d{2}-\d{2})", new_content)
        if date_match:
            today = datetime.now().strftime("%Y-%m-%d")
            new_content = new_content.replace(date_match.group(1), today)

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

    body = f"""
### Provider Instability Detected

- **Provider**: {provider_name}
- **Date**: {datetime.now().strftime("%Y-%m-%d")}
- **Error**: {issue_desc}

Automated routing has deprioritized this provider. Please check connectivity or API key status.
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


def log_issue(provider_name: str, issue_desc: str):
    """Log the alert in ISSUES.md and open GitHub issue."""
    date_str = datetime.now().strftime("%Y-%m-%d")

    # Check if this alert already exists in ISSUES.md to avoid duplicates
    if os.path.exists(ISSUES_FILE):
        with open(ISSUES_FILE) as f:
            existing_content = f.read()
            if (
                f"# Provider Alert: {provider_name} unstable" in existing_content
                and date_str in existing_content
            ):
                logger.info(
                    f"Issue for {provider_name} already logged today in {ISSUES_FILE}, skipping."
                )
            else:
                alert_text = f"""
# Provider Alert: {provider_name} unstable

- **Date**: {date_str}
- **Issue**: {issue_desc}
- **Action Taken**: Deprioritized {provider_name} in the routing logic.
- **Status**: Monitoring for stability.
"""
                with open(ISSUES_FILE, "a") as f:
                    f.write(alert_text)
                logger.info(f"Logged issue for {provider_name} in {ISSUES_FILE}")

    open_github_issue(provider_name, issue_desc)


def check_jina():
    logger.info("Checking Jina...")
    url = f"https://r.jina.ai/{TEST_URL}"
    try:
        session = get_session()
        resp = session.get(url, headers={"Accept": "text/markdown"}, timeout=15)
        if resp.status_code != 200:
            return False, f"Status code {resp.status_code}"
        if not resp.text.strip():
            return False, "Empty response content"
        return True, None
    except Exception as e:
        return False, str(e)


def check_firecrawl():
    logger.info("Checking Firecrawl...")
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        return True, "Skipped: No API Key"
    try:
        session = get_session()
        resp = session.post(
            "https://api.firecrawl.dev/v1/scrape",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"url": TEST_URL, "formats": ["markdown"]},
            timeout=20,
        )
        if resp.status_code != 200:
            return False, f"Status code {resp.status_code}: {resp.text}"
        data = resp.json()
        if "data" not in data or "markdown" not in data["data"]:
            return False, "Response schema changed: 'data.markdown' missing"
        return True, None
    except Exception as e:
        return False, str(e)


def check_tavily():
    logger.info("Checking Tavily...")
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return True, "Skipped: No API Key"
    try:
        session = get_session()
        resp = session.post(
            "https://api.tavily.com/search",
            json={"api_key": api_key, "query": TEST_QUERY, "max_results": 1},
            timeout=15,
        )
        if resp.status_code != 200:
            return False, f"Status code {resp.status_code}: {resp.text}"
        data = resp.json()
        if "results" not in data:
            return False, "Response schema changed: 'results' missing"
        return True, None
    except Exception as e:
        return False, str(e)


def check_serper():
    logger.info("Checking Serper...")
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return True, "Skipped: No API Key"
    try:
        session = get_session()
        resp = session.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": TEST_QUERY, "num": 1},
            timeout=15,
        )
        if resp.status_code != 200:
            return False, f"Status code {resp.status_code}: {resp.text}"
        data = resp.json()
        if "organic" not in data:
            return False, "Response schema changed: 'organic' missing"
        return True, None
    except Exception as e:
        return False, str(e)


def check_exa():
    logger.info("Checking Exa...")
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        return True, "Skipped: No API Key"
    try:
        session = get_session()
        resp = session.post(
            "https://api.exa.ai/search",
            headers={"x-api-key": api_key, "Content-Type": "application/json"},
            json={"query": TEST_QUERY, "numResults": 1},
            timeout=15,
        )
        if resp.status_code != 200:
            return False, f"Status code {resp.status_code}: {resp.text}"
        data = resp.json()
        if "results" not in data:
            return False, "Response schema changed: 'results' missing"
        return True, None
    except Exception as e:
        return False, str(e)


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

    for name, check_func in checks.items():
        success, error = check_func()
        if not success:
            logger.error(f"{name} failed: {error}")
            failing_providers.append((name, error))
        else:
            logger.info(f"{name} is healthy")

    if not failing_providers:
        logger.info("All providers are healthy.")
        return

    for name, error in failing_providers:
        update_routing_priority(name)
        log_issue(name, error)


if __name__ == "__main__":
    main()
