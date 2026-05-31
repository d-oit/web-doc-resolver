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
    matches = list(re.finditer(r"(\bbase\b\s*=\s*\\[)([^\\]]+)(\\])", content, re.DOTALL))
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
            if "
" in providers_raw:
                # Naive multi-line reconstruction: use same indentation if possible
                indent_match = re.search(r"
(s+)", providers_raw)
                indent = indent_match.group(1) if indent_match else "        "
                new_providers_str = (
                    "
" + indent + (",
" + indent).join([f'"{p}"' for p in providers]) + ",
    "
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