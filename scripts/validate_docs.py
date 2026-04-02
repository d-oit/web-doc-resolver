#!/usr/bin/env python3
"""
Validate that documentation (README.md, AGENTS.md, reference docs) stays
in sync with the actual codebase.

Checks:
  1. File references in markdown → files actually exist
  2. Shell commands reference existing scripts
  3. Python CLI entrypoint consistency
  4. Rust CLI flags vs documented flags
  5. Cargo.toml features vs RUST_CLI.md
  6. Repository structure tree accuracy
  7. npm script existence in web/package.json
  8. Cross-doc consistency
  9. Version sync across pyproject.toml, Cargo.toml, package.json

Usage:
  python scripts/validate_docs.py              # full report
  python scripts/validate_docs.py --strict     # exit 1 on any warning
  python scripts/validate_docs.py --json       # output JSON report
  python scripts/validate_docs.py --fix        # print fix suggestions

Exit codes:
  0 = all checks passed
  1 = errors found (or warnings in --strict mode)
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Known external packages — not project modules
EXTERNAL_PACKAGES = frozenset({
    "pytest", "ruff", "black", "mypy", "pip", "setuptools", "wheel",
    "requests", "exa", "tavily", "firecrawl", "mistralai", "ddgs",
    "diskcache", "vitest", "playwright", "next", "eslint", "tsc",
    "cargo", "npm", "pnpx", "npx", "node", "gh",
})

# ── Data ──────────────────────────────────────────────────────────────────────


@dataclass
class Issue:
    severity: str  # "error" | "warning" | "info"
    category: str
    doc: str
    detail: str
    line: int | None = None

    def __str__(self):
        loc = f":{self.line}" if self.line else ""
        return f"[{self.severity.upper()}] {self.doc}{loc} ({self.category}): {self.detail}"

    @property
    def key(self):
        """Deduplicate by (category, doc, detail, line)."""
        return (self.category, self.doc, self.detail, self.line)


@dataclass
class Report:
    issues: list[Issue] = field(default_factory=list)
    _seen: set = field(default_factory=set)

    def add(self, severity, category, doc, detail, line=None):
        issue = Issue(severity, category, doc, detail, line)
        if issue.key not in self._seen:
            self._seen.add(issue.key)
            self.issues.append(issue)

    @property
    def errors(self):
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self):
        return [i for i in self.issues if i.severity == "warning"]

    @property
    def passed(self):
        return len(self.errors) == 0


# ── Helpers ───────────────────────────────────────────────────────────────────


def read_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def extract_markdown_links(content: str) -> list[tuple[int, str, str]]:
    """Return [(line_no, display_text, target)] for markdown links."""
    results = []
    for i, line in enumerate(content.splitlines(), 1):
        for m in re.finditer(r"\[([^\]]*)\]\(([^)]+)\)", line):
            results.append((i, m.group(1), m.group(2)))
    return results


def extract_code_blocks(content: str) -> list[tuple[int, str, str]]:
    """Return [(start_line, language, code)] for fenced code blocks."""
    results = []
    lines = content.splitlines()
    i = 0
    while i < len(lines):
        m = re.match(r"^```(\w*)", lines[i])
        if m:
            lang = m.group(1)
            start = i + 1
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code_lines.append(lines[i])
                i += 1
            results.append((start, lang, "\n".join(code_lines)))
        i += 1
    return results


# ── Check 1: File references ─────────────────────────────────────────────────


def check_file_references(report: Report, doc_name: str, content: str):
    """Verify that markdown links point to files that actually exist."""
    for line_no, _text, target in extract_markdown_links(content):
        if target.startswith(("http://", "https://", "#", "mailto:")):
            continue
        if target.startswith("$") or target.startswith("{{"):
            continue

        path_part = target.split("#")[0]
        if not path_part:
            continue

        full_path = REPO_ROOT / path_part
        if not full_path.exists():
            report.add("error", "file-ref", doc_name,
                        f"Linked file missing: {path_part}", line_no)


# ── Check 2: Shell commands ──────────────────────────────────────────────────


def check_shell_commands(report: Report, doc_name: str, content: str):
    """Verify shell commands reference existing scripts/binaries."""
    SCRIPT_PATTERN = re.compile(r"(?:^|\s)(\./scripts/\S+|scripts/\S+\.(?:sh|py))")
    MODULE_PATTERN = re.compile(r"python\s+-m\s+(\S+)")

    for line_no, lang, code in extract_code_blocks(content):
        if lang not in ("bash", "sh", "shell", ""):
            continue

        for cmd_line in code.splitlines():
            cmd_line = cmd_line.strip()
            if cmd_line.startswith("#") or not cmd_line:
                continue

            # Check script file references
            for m in SCRIPT_PATTERN.finditer(cmd_line):
                script = m.group(1).lstrip("./")
                full = REPO_ROOT / script
                if not full.exists():
                    report.add("error", "script-ref", doc_name,
                               f"Script referenced but missing: {script}", line_no)

            # Check python -m module references
            for m in MODULE_PATTERN.finditer(cmd_line):
                mod = m.group(1)
                # Skip known external packages
                top_level = mod.split(".")[0]
                if top_level in EXTERNAL_PACKAGES:
                    continue

                mod_path = mod.replace(".", "/")
                pkg = REPO_ROOT / mod_path / "__init__.py"
                mod_file = REPO_ROOT / f"{mod_path}.py"
                if not pkg.exists() and not mod_file.exists():
                    report.add("error", "module-ref", doc_name,
                               f"Python module '{mod}' referenced but missing", line_no)


# ── Check 3: Python CLI entrypoint ───────────────────────────────────────────


def check_python_cli(report: Report):
    """Verify documented Python CLI invocations work."""
    resolve_py = read_file(REPO_ROOT / "scripts" / "resolve.py")
    has_resolve_main = "__name__" in resolve_py and "__main__" in resolve_py

    for doc_name in ["README.md", ".agents/skills/do-web-doc-resolver/references/CLI.md"]:
        content = read_file(REPO_ROOT / doc_name)
        if not content:
            continue

        for line_no, lang, code in extract_code_blocks(content):
            if lang not in ("bash", "sh", "shell", ""):
                continue
            for cmd_line in code.splitlines():
                cmd_line = cmd_line.strip()
                if cmd_line.startswith("#"):
                    continue
                if "python -m scripts.resolve" in cmd_line and not has_resolve_main:
                    report.add("error", "python-cli", doc_name,
                               "'python -m scripts.resolve' documented but resolve.py has no "
                               "__main__ block. Use 'python -m scripts.cli' or 'do-wdr'.",
                               line_no)
                if (cmd_line.startswith("python scripts/resolve.py")
                        and not has_resolve_main):
                    report.add("error", "python-cli", doc_name,
                               "'python scripts/resolve.py' documented but resolve.py has no "
                               "__main__ block. Use 'python scripts/cli.py' or 'do-wdr'.",
                               line_no)


# ── Check 4: Rust CLI flags ──────────────────────────────────────────────────


def check_rust_cli_flags(report: Report):
    """Compare documented Rust CLI flags against cli/src/cli.rs."""
    cli_rs = read_file(REPO_ROOT / "cli" / "src" / "cli.rs")
    if not cli_rs:
        report.add("warning", "rust-cli", "cli/src/cli.rs",
                    "Cannot read cli.rs for flag validation")
        return

    # Extract actual flags from clap derive
    actual_flags = set()
    for m in re.finditer(r'long\s*=\s*"([\w-]+)"', cli_rs):
        actual_flags.add(m.group(1))

    # Extract subcommands
    actual_subcmds = set()
    # Parse Commands enum variants
    enum_match = re.search(r"enum\s+Commands\s*\{([^}]+)\}", cli_rs, re.DOTALL)
    if enum_match:
        for sm in re.finditer(r"(\w+)\s*\{", enum_match.group(1)):
            actual_subcmds.add(sm.group(1).lower())

    # Collect documented flags from docs
    doc_flags = set()
    for doc_file in ["README.md", ".agents/skills/do-web-doc-resolver/references/CLI.md"]:
        content = read_file(REPO_ROOT / doc_file)
        for m in re.finditer(r"--([\w-]+)", content):
            doc_flags.add(m.group(1))

    # Report flags in code but not documented
    undocumented = actual_flags - doc_flags
    for flag in sorted(undocumented):
        report.add("warning", "undoc-flag", "Rust CLI",
                    f"Rust CLI flag --{flag} exists in cli.rs but not documented")


# ── Check 5: Cargo.toml features ─────────────────────────────────────────────


def check_cargo_features(report: Report):
    """Verify RUST_CLI.md features section matches actual Cargo.toml."""
    cargo = read_file(REPO_ROOT / "cli" / "Cargo.toml")
    rust_cli_md = read_file(
        REPO_ROOT / ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md"
    )
    if not cargo or not rust_cli_md:
        return

    # Extract actual features from Cargo.toml
    actual_features = {}
    in_features = False
    for line in cargo.splitlines():
        if line.strip() == "[features]":
            in_features = True
            continue
        if in_features:
            if line.startswith("["):
                break
            m = re.match(r'(\w[\w-]*)\s*=\s*(.+)', line)
            if m:
                actual_features[m.group(1)] = m.group(2).strip()

    # Check RUST_CLI.md code blocks with [features]
    for line_no, lang, code in extract_code_blocks(rust_cli_md):
        if "toml" not in lang:
            continue
        if "[features]" not in code:
            continue
        for code_line in code.splitlines():
            m = re.match(r'(\w[\w-]*)\s*=\s*(.+)', code_line)
            if not m:
                continue
            feat_name = m.group(1)
            feat_val = m.group(2).strip()
            if feat_name not in actual_features:
                report.add(
                    "error", "cargo-feature", "RUST_CLI.md",
                    f"Feature '{feat_name}' documented but does not exist in Cargo.toml. "
                    f"Actual features: {sorted(actual_features.keys())}", line_no)
            elif actual_features[feat_name] != feat_val:
                report.add(
                    "error", "cargo-feature", "RUST_CLI.md",
                    f"Feature '{feat_name}' value mismatch: "
                    f"doc={feat_val!r} actual={actual_features[feat_name]!r}", line_no)


# ── Check 6: Rust architecture ───────────────────────────────────────────────


def check_rust_architecture(report: Report):
    """Verify RUST_CLI.md architecture diagram matches actual cli/src/ layout.

    Uses context-aware path resolution (tracks parent directories from tree).
    """
    rust_cli_md = read_file(
        REPO_ROOT / ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md"
    )
    if not rust_cli_md:
        return

    # Extract documented entries from tree blocks using context-aware resolution
    for start_line, lang, code in extract_code_blocks(rust_cli_md):
        if "├──" not in code and "└──" not in code:
            continue

        # Detect tree root (e.g., "cli/" on first line)
        first_line = code.splitlines()[0].strip()
        root_match = re.match(r"(\w[\w/._-]+)/?\s*$", first_line)
        if not root_match:
            continue
        tree_root = root_match.group(1).rstrip("/")

        dir_stack: list[tuple[int, str]] = []

        for offset, tree_line in enumerate(code.splitlines()):
            line_no = start_line + offset

            indent_match = re.match(r"^([│ ]*)(?:├──|└──)", tree_line)
            if not indent_match:
                continue

            indent = len(indent_match.group(1))
            entry_match = re.match(r"^[│ ]*(?:├──|└──)\s*(\S+)", tree_line)
            if not entry_match:
                continue

            entry = entry_match.group(1).rstrip("/")
            if entry in ("...", ""):
                continue

            # Pop stack if indent decreased
            while dir_stack and dir_stack[-1][0] >= indent:
                dir_stack.pop()

            # Build relative path from tree root
            if dir_stack:
                rel_path = dir_stack[-1][1] + "/" + entry
            else:
                rel_path = entry

            # Resolve full path from tree root
            full = REPO_ROOT / tree_root / rel_path

            if not full.exists():
                # Check if it's a dir instead of file or vice versa
                dir_candidate = REPO_ROOT / tree_root / rel_path.replace(".rs", "")
                if dir_candidate.is_dir():
                    report.add(
                        "error", "rust-arch", "RUST_CLI.md",
                        f"'{tree_root}/{rel_path}' documented as file but exists as directory: "
                        f"{tree_root}/{rel_path.replace('.rs', '')}/")
                else:
                    report.add(
                        "error", "rust-arch", "RUST_CLI.md",
                        f"'{tree_root}/{rel_path}' documented but does not exist")

            # Push directories onto stack
            is_dir = (
                full.is_dir()
                or entry in ("src", "providers", "resolver", "tests", "ui")
                or entry.replace(".rs", "") in ("providers", "resolver")
            )
            if is_dir:
                dir_stack.append((indent, rel_path))


# ── Check 7: Repo structure tree ─────────────────────────────────────────────


def check_repo_tree(report: Report, doc_name: str, content: str):
    """Verify entries in ASCII tree diagrams exist in the filesystem.

    Uses context-aware path resolution: tracks the parent directory stack
    implied by the tree indentation.
    """
    for start_line, lang, code in extract_code_blocks(content):
        if "├──" not in code and "└──" not in code:
            continue

        # Build parent stack by tracking indentation
        dir_stack: list[tuple[int, str]] = []  # (indent_level, relative_path)
        prev_indent = -1

        for offset, tree_line in enumerate(code.splitlines()):
            line_no = start_line + offset

            # Measure indentation by counting tree-drawing chars before ├──/└──
            indent_match = re.match(r"^([│ ]*)(?:├──|└──)", tree_line)
            if not indent_match:
                continue

            indent = len(indent_match.group(1))
            entry_match = re.match(r"^[│ ]*(?:├──|└──)\s*(\S+)", tree_line)
            if not entry_match:
                continue

            entry = entry_match.group(1).rstrip("/")

            # Skip comments, ellipsis
            if entry.startswith("#") or entry == "...":
                continue

            # Pop stack if indent decreased
            while dir_stack and dir_stack[-1][0] >= indent:
                dir_stack.pop()

            # Build full relative path
            if dir_stack:
                rel_path = dir_stack[-1][1] + "/" + entry
            else:
                rel_path = entry

            # If this entry is a directory (ends with / in original or has child content),
            # push onto stack
            is_dir = "/" not in entry and any(
                re.match(rf"^{' ' * (indent + 2)}[│ ]*(?:├──|└──)", l)
                for l in code.splitlines()[offset + 1:]
            )

            # Check existence
            full = REPO_ROOT / rel_path
            if not full.exists():
                # Also try without trailing / in case of directory
                if (REPO_ROOT / rel_path.rstrip("/")).is_dir():
                    continue
                report.add("warning", "repo-tree", doc_name,
                           f"Tree entry '{rel_path}' does not exist", line_no)

            if is_dir or entry in ("src", "app", "providers", "resolver", "tests",
                                    "scripts", "cli", "web", "assets", "capture",
                                    "skills", "references", "agents-docs",
                                    "do-web-doc-resolver", "do-wdr-cli",
                                    "do-wdr-assets", "do-wdr-release",
                                    "do-wdr-ui-component", "do-wdr-issue-swarm",
                                    "do-github-pr-sentinel", "agent-browser",
                                    "privacy-first", "skill-creator",
                                    "readme-best-practices", "anti-ai-slop",
                                    "vercel-cli", ".github", "workflows",
                                    ".agents", ".blackbox", ".claude", ".opencode",
                                    "public", "lib", "page.tsx", "layout.tsx",
                                    "globals.css", "postcss.config.mjs",
                                    "playwright.config.ts", "vercel.json",
                                    "ui", "components", "tokens",
                                    "screenshots", "plans", "samples", "videos"):
                dir_stack.append((indent, rel_path))

            prev_indent = indent


# ── Check 8: npm scripts ─────────────────────────────────────────────────────


def check_npm_scripts(report: Report):
    """Verify npm commands referenced in docs exist in web/package.json."""
    pkg = REPO_ROOT / "web" / "package.json"
    if not pkg.exists():
        return

    try:
        pkg_data = json.loads(pkg.read_text())
    except Exception:
        return

    available_scripts = set(pkg_data.get("scripts", {}).keys())

    for doc_name in ["README.md", "AGENTS.md"]:
        content = read_file(REPO_ROOT / doc_name)
        for line_no, lang, code in extract_code_blocks(content):
            for cmd_line in code.splitlines():
                m = re.search(r"npm\s+run\s+(\w[\w:.-]*)", cmd_line)
                if m:
                    script = m.group(1)
                    if script not in available_scripts:
                        report.add(
                            "error", "npm-script", doc_name,
                            f"npm script '{script}' not in web/package.json. "
                            f"Available: {sorted(available_scripts)}", line_no)


# ── Check 9: Cross-doc consistency ────────────────────────────────────────────


def check_cross_docs(report: Report):
    """Check consistency between docs."""
    readme = read_file(REPO_ROOT / "README.md")
    agents = read_file(REPO_ROOT / "AGENTS.md")

    # Check for duplicate links in README
    readme_links = extract_markdown_links(readme)
    seen = {}
    for line_no, text, target in readme_links:
        key = (text, target)
        if key in seen:
            report.add("warning", "duplicate-link", "README.md",
                        f"Duplicate link: [{text}]({target}) "
                        f"(first at line {seen[key]})", line_no)
        else:
            seen[key] = line_no

    # Check version consistency
    versions = {}

    pyproject = read_file(REPO_ROOT / "pyproject.toml")
    m = re.search(r'version\s*=\s*"([^"]+)"', pyproject)
    if m:
        versions["pyproject.toml"] = m.group(1)

    cargo = read_file(REPO_ROOT / "cli" / "Cargo.toml")
    m = re.search(r'^version\s*=\s*"([^"]+)"', cargo, re.MULTILINE)
    if m:
        versions["cli/Cargo.toml"] = m.group(1)

    try:
        pkg = json.loads((REPO_ROOT / "web" / "package.json").read_text())
        versions["web/package.json"] = pkg.get("version", "?")
    except Exception:
        pass

    if len(set(versions.values())) > 1:
        report.add("warning", "version-sync", "Cross-file",
                    f"Version mismatch: {versions}")


# ── Main ──────────────────────────────────────────────────────────────────────


def run_all_checks() -> Report:
    report = Report()

    docs = [
        "README.md",
        "AGENTS.md",
        ".agents/skills/do-web-doc-resolver/references/CLI.md",
        ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md",
        ".agents/skills/do-web-doc-resolver/references/CONFIG.md",
    ]

    # Per-doc checks
    for doc_name in docs:
        content = read_file(REPO_ROOT / doc_name)
        if not content:
            report.add("warning", "file-read", doc_name, "Document not found or empty")
            continue

        check_file_references(report, doc_name, content)
        check_shell_commands(report, doc_name, content)

    # Tree structure checks
    for doc_name in ["README.md", "AGENTS.md"]:
        content = read_file(REPO_ROOT / doc_name)
        if content:
            check_repo_tree(report, doc_name, content)

    # Code-level checks
    check_python_cli(report)
    check_rust_cli_flags(report)
    check_cargo_features(report)
    check_rust_architecture(report)
    check_npm_scripts(report)
    check_cross_docs(report)

    return report


def main():
    parser = argparse.ArgumentParser(description="Validate docs against codebase")
    parser.add_argument("--strict", action="store_true", help="Exit 1 on warnings")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument("--fix", action="store_true", help="Print fix suggestions")
    args = parser.parse_args()

    report = run_all_checks()

    if args.json:
        output = {
            "passed": report.passed and (not args.strict or len(report.warnings) == 0),
            "errors": len(report.errors),
            "warnings": len(report.warnings),
            "issues": [
                {"severity": i.severity, "category": i.category,
                 "doc": i.doc, "detail": i.detail, "line": i.line}
                for i in report.issues
            ],
        }
        print(json.dumps(output, indent=2))
    else:
        if not report.issues:
            print("\u2705 All documentation checks passed!")
        else:
            colors = {"error": "\033[91m", "warning": "\033[93m", "info": "\033[94m"}
            for issue in report.issues:
                c = colors.get(issue.severity, "")
                print(f"{c}{issue}\033[0m")

            print(f"\nSummary: {len(report.errors)} errors, {len(report.warnings)} warnings")

            if args.fix:
                print("\n--- Fix Suggestions ---")
                categories_seen = set()
                for issue in report.issues:
                    if issue.category in categories_seen:
                        continue
                    categories_seen.add(issue.category)
                    if issue.category == "python-cli":
                        print("  [python-cli] Replace 'python -m scripts.resolve' with "
                              "'python -m scripts.cli' or 'do-wdr' everywhere in docs.")
                    elif issue.category == "cargo-feature":
                        print("  [cargo-feature] Update RUST_CLI.md [features] block to:\n"
                              '        default = []\n'
                              '        semantic-cache = ["dep:chaotic_semantic_memory"]')
                    elif issue.category == "rust-arch":
                        print("  [rust-arch] Rewrite RUST_CLI.md architecture tree to match "
                              "actual cli/src/ layout (resolver/ is a dir, providers has "
                              "exa_sdk.rs not exa.rs, etc).")
                    elif issue.category == "repo-tree":
                        print("  [repo-tree] Update repo structure tree in "
                              f"{issue.doc} to reflect actual files.")
                    elif issue.category == "duplicate-link":
                        print("  [duplicate-link] Remove duplicate link entry in README.md "
                              "Related Files section.")
                    elif issue.category == "npm-script":
                        print("  [npm-script] Fix npm run command or add script to "
                              "web/package.json.")
                    elif issue.category == "undoc-flag":
                        print("  [undoc-flag] Document missing Rust CLI flags in "
                              "README.md and CLI.md.")

    if report.errors:
        sys.exit(1)
    if args.strict and report.warnings:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
