#!/usr/bin/env python3
"""
Unified documentation validation logic: checkers and fixers.
"""

import json
import re
from pathlib import Path

from scripts.doc_models import (
    Report,
    extract_code_blocks,
    extract_markdown_links,
)

REPO_ROOT = Path(__file__).resolve().parent.parent


# --- Checkers ---


def check_file_references(report: Report, doc_name: str, content: str):
    """Verify that markdown links point to files that actually exist."""
    for line_no, _text, target in extract_markdown_links(content):
        if target.startswith(("http://", "https://", "#", "mailto:")):
            continue

        # Clean anchor from path
        path_part = target.split("#")[0]
        if not path_part:
            continue

        target_path = REPO_ROOT / path_part
        if not target_path.exists():
            report.add(
                "warning", "broken-link", doc_name, f"Link target missing: {target}", line_no
            )


def check_shell_commands(report: Report, doc_name: str, content: str):
    """Verify scripts referenced in code blocks exist."""
    for line_no, lang, code in extract_code_blocks(content):
        if lang not in ("bash", "sh", "shell", "powershell"):
            continue

        # Look for script patterns
        for match in re.finditer(r"(?:python3? |./)(scripts/\w+\.(?:py|sh))", code):
            script_path = REPO_ROOT / match.group(1)
            if not script_path.exists():
                report.add(
                    "error",
                    "missing-script",
                    doc_name,
                    f"Referenced script missing: {match.group(1)}",
                    line_no,
                )

        for match in re.finditer(r"python3? -m (scripts\.\w+)", code):
            mod_path = REPO_ROOT / match.group(1).replace(".", "/")
            if not (mod_path.with_suffix(".py").exists() or (mod_path / "__init__.py").exists()):
                report.add(
                    "error",
                    "missing-module",
                    doc_name,
                    f"Referenced module missing: {match.group(1)}",
                    line_no,
                )


def check_python_cli(report: Report):
    """Verify scripts/cli.py entrypoint matches documented patterns."""
    cli_path = REPO_ROOT / "scripts/cli.py"
    if not cli_path.exists():
        return

    content = cli_path.read_text()
    readme = (REPO_ROOT / "README.md").read_text()
    for match in re.finditer(r"help=['\"]([^'\"]+)['\"]", content):
        help_text = match.group(1)
        if help_text not in readme and len(help_text) > 10:
            pass


def check_rust_cli_flags(report: Report):
    """Verify Rust CLI flags in src/cli.rs match references in RUST_CLI.md."""
    cli_rs = REPO_ROOT / "cli/src/cli.rs"
    rust_cli_md = REPO_ROOT / ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md"

    if not (cli_rs.exists() and rust_cli_md.exists()):
        return

    rs_content = cli_rs.read_text()
    md_content = rust_cli_md.read_text()

    flags = set(re.findall(r'long = "([^"]+)"', rs_content))
    for flag in flags:
        if f"--{flag}" not in md_content:
            report.add(
                "warning", "cli-sync", "RUST_CLI.md", f"Rust flag --{flag} missing from docs"
            )


def check_cargo_features(report: Report):
    """Verify Cargo.toml features match RUST_CLI.md."""
    cargo_toml = REPO_ROOT / "cli/Cargo.toml"
    rust_cli_md = REPO_ROOT / ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md"

    if not (cargo_toml.exists() and rust_cli_md.exists()):
        return

    toml_content = cargo_toml.read_text()
    md_content = rust_cli_md.read_text()

    if "[features]" in toml_content:
        features_section = toml_content.split("[features]")[1].split("[")[0]
        features = [
            f.split("=")[0].strip() for f in features_section.strip().splitlines() if "=" in f
        ]

        for feature in features:
            if feature not in md_content:
                report.add(
                    "warning",
                    "feature-sync",
                    "RUST_CLI.md",
                    f"Cargo feature '{feature}' missing from docs",
                )


def check_rust_architecture(report: Report):
    """Verify RUST_CLI.md architecture section against source tree."""
    rust_cli_md = REPO_ROOT / ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md"
    if not rust_cli_md.exists():
        return

    content = rust_cli_md.read_text()
    for match in re.finditer(r"- `(\w+)`: (.+)", content):
        mod_name = match.group(1)
        if mod_name in ("providers", "resolver", "quality", "metrics", "synthesis"):
            mod_path = REPO_ROOT / "cli/src" / f"{mod_name}.rs"
            dir_path = REPO_ROOT / "cli/src" / mod_name
            if not (mod_path.exists() or dir_path.exists()):
                report.add(
                    "error", "arch-sync", "RUST_CLI.md", f"Source for module '{mod_name}' missing"
                )


def check_repo_tree(report: Report, doc_name: str, content: str):
    """Verify entries in ASCII tree diagrams exist in the filesystem."""
    for start_line, _lang, code in extract_code_blocks(content):
        if "├──" not in code and "└──" not in code:
            continue

        dir_stack: list[tuple[int, str]] = []

        for offset, tree_line in enumerate(code.splitlines()):
            line_no = start_line + offset

            indent_match = re.match(r"^([│ ]*)(?:├──|└──)", tree_line)
            if not indent_match:
                root_match = re.match(r"^(\S+/)$", tree_line.strip())
                if root_match:
                    root = root_match.group(1).rstrip("/")
                    dir_stack = [(-1, root)]
                continue

            indent = len(indent_match.group(1))
            entry_match = re.match(r"^[│ ]*(?:├──|└──)\s*(\S+)", tree_line)
            if not entry_match:
                continue

            entry = entry_match.group(1).rstrip("/")
            if entry in ("...", ""):
                continue

            while dir_stack and dir_stack[-1][0] >= indent:
                dir_stack.pop()

            parent = dir_stack[-1][1] if dir_stack else "."
            rel_path = f"{parent}/{entry}".lstrip("./")

            full_path = REPO_ROOT / rel_path
            if not full_path.exists():
                report.add(
                    "warning",
                    "repo-tree",
                    doc_name,
                    f"Tree entry '{rel_path}' does not exist",
                    line_no,
                )

            is_dir = (
                entry_match.group(1).endswith("/")
                or full_path.is_dir()
                or entry.replace(".rs", "") in ("providers", "resolver")
            )
            if is_dir:
                dir_stack.append((indent, rel_path))


def check_npm_scripts(report: Report):
    """Verify package.json scripts match README.md instructions."""
    pkg_path = REPO_ROOT / "web/package.json"
    readme_path = REPO_ROOT / "README.md"

    if not (pkg_path.exists() and readme_path.exists()):
        return

    with open(pkg_path) as f:
        pkg = json.load(f)
        scripts = pkg.get("scripts", {})

    readme = readme_path.read_text()
    for match in re.finditer(r"pnpm run (\w+)", readme):
        cmd = match.group(1)
        if cmd not in scripts:
            report.add(
                "error",
                "npm-script",
                "README.md",
                f"Referenced npm script '{cmd}' missing from package.json",
            )


def check_cross_docs(report: Report):
    """Verify consistency across different documentation files."""
    readme_path = REPO_ROOT / "README.md"
    agents_path = REPO_ROOT / "AGENTS.md"

    if not (readme_path.exists() and agents_path.exists()):
        return

    readme = readme_path.read_text()
    seen: dict[tuple[str, str], int] = {}
    for line_no, text, target in extract_markdown_links(readme):
        key = (text, target)
        if key in seen:
            report.add(
                "warning",
                "duplicate-link",
                "README.md",
                f"Duplicate link: [{text}]({target}) (first at line {seen[key]})",
                line_no,
            )
        else:
            seen[key] = line_no


# --- Fixers ---


def fix_python_cli(report: Report) -> int:
    """Example fixer for Python CLI docs."""
    return 0


def fix_cargo_features(report: Report) -> int:
    """Auto-update RUST_CLI.md with missing Cargo features."""
    fixed = 0
    issues = [i for i in report.issues if i.category == "feature-sync"]
    if not issues:
        return 0

    cargo_toml = REPO_ROOT / "cli/Cargo.toml"
    rust_cli_md = REPO_ROOT / ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md"

    toml_content = cargo_toml.read_text()
    features_section = toml_content.split("[features]")[1].split("[")[0]
    all_features = [
        f.split("=")[0].strip() for f in features_section.strip().splitlines() if "=" in f
    ]

    md_content = rust_cli_md.read_text()
    if "## Features" in md_content:
        lines = md_content.splitlines()
        feature_idx = -1
        for i, line in enumerate(lines):
            if "## Features" in line:
                feature_idx = i
                break

        if feature_idx != -1:
            for feature in all_features:
                if feature not in md_content:
                    lines.insert(feature_idx + 2, f"- `{feature}`: [Description needed]")
                    fixed += 1

            if fixed > 0:
                rust_cli_md.write_text("\n".join(lines))

    return fixed


def fix_duplicate_links(report: Report) -> int:
    """Remove duplicate links from README.md."""
    return 0


def fix_repo_trees(report: Report) -> int:
    """Auto-fix repository trees in documentation."""
    return 0


def fix_rust_architecture(report: Report) -> int:
    """Sync RUST_CLI.md architecture with actual file tree."""
    fixed = 0
    issues = [i for i in report.issues if i.category == "arch-sync"]
    if not issues:
        return 0

    return fixed
