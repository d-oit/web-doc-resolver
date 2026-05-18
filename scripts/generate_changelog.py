#!/usr/bin/env python3
"""Generate a clean, grouped changelog from conventional commits.

Reads git log since a tag, parses conventional commits
(type(scope): description), and outputs Keep a Changelog format
with deduplication and trivial-commit filtering.

Usage:
    python scripts/generate_changelog.py --version 1.2.3
    python scripts/generate_changelog.py --version 1.2.3 --from-tag v1.2.2
"""

import argparse
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date

SCOPE_LABELS = {
    "web": "Web",
    "ux": "Web",
    "ui": "Web",
    "cli": "CLI",
    "security": "Security",
    "semantic": "Performance",
    "cache": "Performance",
    "scripts": "Scripts",
    "synthesis": "Synthesis",
    "docs": "Docs",
    "config": "Config",
    "deps": None,
}


def parse_commit(line):
    raw = line.strip().lstrip("- ")
    m = re.match(
        r"^(\w+)(?:\(([^)]+)\))?:\s*(.+?)\s*(?:\(([a-f0-9]+)\))?\s*$",
        raw,
    )
    if not m:
        m = re.match(r"^(\w+)(?:\(([^)]+)\))?:\s*(.+)$", raw)
        if not m:
            return None
        return m.group(1), m.group(2) or "", m.group(3).strip(), ""
    return m.group(1), m.group(2) or "", m.group(3).strip(), m.group(4) or ""


def should_skip(commit_type, scope, description):
    desc_lower = description.lower()
    if "nightly" in desc_lower or "automated format" in desc_lower:
        return True
    if commit_type in ("style", "test"):
        return True
    if commit_type == "ci" and not scope:
        return True
    if commit_type == "chore" and scope not in ("config", "deps", "security"):
        return True
    if commit_type == "revert":
        return True
    if scope == "release":
        return True
    return False


def categorize(commit_type, scope, description):
    """Map conventional commit to (section, label)."""
    label = SCOPE_LABELS.get(scope)
    desc_lower = description.lower()

    if scope == "deps":
        return "Dependencies", label
    if "bump " in desc_lower:
        return "Dependencies", label

    if commit_type == "feat":
        return "Added", label
    if commit_type == "fix":
        return "Fixed", label
    if commit_type == "perf":
        return "Changed", label
    if commit_type == "refactor":
        return "Changed", label
    if commit_type == "docs":
        label = label or "Docs"
        return "Changed", label
    if commit_type == "build":
        return "Changed", label
    if commit_type == "ci":
        label = label or "CI"
        return "Changed", label

    if commit_type == "chore":
        if scope == "config" and ("remove" in desc_lower or "delete" in desc_lower):
            return "Removed", "Config"
        return "Changed", label

    return "Changed", label


def deduplicate(entries):
    seen = set()
    result = []
    for entry in entries:
        clean = re.sub(r"\s+", " ", entry).lower().strip().rstrip(".")
        if clean not in seen:
            seen.add(clean)
            result.append(entry)
    return result


def generate_changelog(from_tag, version):
    if from_tag:
        result = subprocess.run(
            ["git", "log", f"{from_tag}..HEAD", "--oneline", "--no-merges", "--format=- %s (%h)"],
            capture_output=True,
            text=True,
        )
    else:
        result = subprocess.run(
            ["git", "log", "--oneline", "--no-merges", "--max-count=30", "--format=- %s (%h)"],
            capture_output=True,
            text=True,
        )

    if result.returncode != 0:
        print(f"error: git log failed — {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)

    raw_lines = result.stdout.strip().split("\n")
    if not raw_lines or (len(raw_lines) == 1 and not raw_lines[0]):
        print(f"No commits since {from_tag or 'beginning'}")
        return ""

    sections = defaultdict(list)

    for line in raw_lines:
        line = line.strip()
        if not line:
            continue
        parsed = parse_commit(line)
        if not parsed:
            sections["Changed"].append(line)
            continue

        commit_type, scope, description, _ = parsed
        if should_skip(commit_type, scope, description):
            continue
        section, label = categorize(commit_type, scope, description)

        if label:
            entry = f"- **{label}**: {description}"
        else:
            entry = f"- {description}"
        sections[section].append(entry)

    lines_out = []
    lines_out.append(f"## [{version}] - {date.today().isoformat()}")
    lines_out.append("")

    for section in ("Added", "Changed", "Fixed", "Removed", "Dependencies"):
        entries = sections.get(section, [])
        if not entries:
            continue
        entries = deduplicate(entries)
        lines_out.append(f"### {section}")
        lines_out.append("")
        lines_out.extend(entries)
        lines_out.append("")

    return "\n".join(lines_out).rstrip() + "\n"


def main():
    parser = argparse.ArgumentParser(
        description="Generate a clean changelog from conventional commits"
    )
    parser.add_argument("--version", default="unreleased")
    parser.add_argument("--from-tag", help="Git tag to start from (default: latest)")
    args = parser.parse_args()

    if not args.from_tag:
        r = subprocess.run(
            ["git", "describe", "--tags", "--abbrev=0"],
            capture_output=True,
            text=True,
        )
        args.from_tag = r.stdout.strip() if r.returncode == 0 else None

    output = generate_changelog(args.from_tag, args.version)
    if output:
        print(output, end="")


if __name__ == "__main__":
    main()
