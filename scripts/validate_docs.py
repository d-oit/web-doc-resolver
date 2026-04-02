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
  python scripts/validate_docs.py --fix        # auto-fix issues + re-validate + git add

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
EXTERNAL_PACKAGES = frozenset(
    {
        "pytest",
        "ruff",
        "black",
        "mypy",
        "pip",
        "setuptools",
        "wheel",
        "requests",
        "exa",
        "tavily",
        "firecrawl",
        "mistralai",
        "ddgs",
        "diskcache",
        "vitest",
        "playwright",
        "next",
        "eslint",
        "tsc",
        "cargo",
        "npm",
        "pnpx",
        "npx",
        "node",
        "gh",
    }
)

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
            report.add("error", "file-ref", doc_name, f"Linked file missing: {path_part}", line_no)


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
                    report.add(
                        "error",
                        "script-ref",
                        doc_name,
                        f"Script referenced but missing: {script}",
                        line_no,
                    )

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
                    report.add(
                        "error",
                        "module-ref",
                        doc_name,
                        f"Python module '{mod}' referenced but missing",
                        line_no,
                    )


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
                    report.add(
                        "error",
                        "python-cli",
                        doc_name,
                        "'python -m scripts.resolve' documented but resolve.py has no "
                        "__main__ block. Use 'python -m scripts.cli' or 'do-wdr'.",
                        line_no,
                    )
                if cmd_line.startswith("python scripts/resolve.py") and not has_resolve_main:
                    report.add(
                        "error",
                        "python-cli",
                        doc_name,
                        "'python scripts/resolve.py' documented but resolve.py has no "
                        "__main__ block. Use 'python scripts/cli.py' or 'do-wdr'.",
                        line_no,
                    )


# ── Check 4: Rust CLI flags ──────────────────────────────────────────────────


def check_rust_cli_flags(report: Report):
    """Compare documented Rust CLI flags against cli/src/cli.rs."""
    cli_rs = read_file(REPO_ROOT / "cli" / "src" / "cli.rs")
    if not cli_rs:
        report.add(
            "warning", "rust-cli", "cli/src/cli.rs", "Cannot read cli.rs for flag validation"
        )
        return

    # Extract actual flags from clap derive (both `long = "name"` and bare `long`)
    actual_flags = set()
    for m in re.finditer(r'long\s*=\s*"([\w-]+)"', cli_rs):
        actual_flags.add(m.group(1))
    # Handle bare `#[arg(...long...)]` where flag name comes from the Rust field name
    # Pattern: `#[arg(short, long)]` followed by `pub field_name: Type,`
    for m in re.finditer(r"#\[arg\([^)]*\blong\b[^\]]*\]\s*\n\s*(?:pub\s+)?(\w+)\s*:", cli_rs):
        field_name = m.group(1)
        actual_flags.add(field_name.replace("_", "-"))

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
        report.add(
            "warning",
            "undoc-flag",
            "Rust CLI",
            f"Rust CLI flag --{flag} exists in cli.rs but not documented",
        )


# ── Check 5: Cargo.toml features ─────────────────────────────────────────────


def check_cargo_features(report: Report):
    """Verify RUST_CLI.md features section matches actual Cargo.toml."""
    cargo = read_file(REPO_ROOT / "cli" / "Cargo.toml")
    rust_cli_md = read_file(REPO_ROOT / ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md")
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
            m = re.match(r"(\w[\w-]*)\s*=\s*(.+)", line)
            if m:
                actual_features[m.group(1)] = m.group(2).strip()

    # Check RUST_CLI.md code blocks with [features]
    for line_no, lang, code in extract_code_blocks(rust_cli_md):
        if "toml" not in lang:
            continue
        if "[features]" not in code:
            continue
        for code_line in code.splitlines():
            m = re.match(r"(\w[\w-]*)\s*=\s*(.+)", code_line)
            if not m:
                continue
            feat_name = m.group(1)
            feat_val = m.group(2).strip()
            if feat_name not in actual_features:
                report.add(
                    "error",
                    "cargo-feature",
                    "RUST_CLI.md",
                    f"Feature '{feat_name}' documented but does not exist in Cargo.toml. "
                    f"Actual features: {sorted(actual_features.keys())}",
                    line_no,
                )
            elif actual_features[feat_name] != feat_val:
                report.add(
                    "error",
                    "cargo-feature",
                    "RUST_CLI.md",
                    f"Feature '{feat_name}' value mismatch: "
                    f"doc={feat_val!r} actual={actual_features[feat_name]!r}",
                    line_no,
                )


# ── Check 6: Rust architecture ───────────────────────────────────────────────


def check_rust_architecture(report: Report):
    """Verify RUST_CLI.md architecture diagram matches actual cli/src/ layout.

    Uses context-aware path resolution (tracks parent directories from tree).
    """
    rust_cli_md = read_file(REPO_ROOT / ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md")
    if not rust_cli_md:
        return

    # Extract documented entries from tree blocks using context-aware resolution
    for start_line, _lang, code in extract_code_blocks(rust_cli_md):
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
            _line_no = start_line + offset

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
                        "error",
                        "rust-arch",
                        "RUST_CLI.md",
                        f"'{tree_root}/{rel_path}' documented as file but exists as directory: "
                        f"{tree_root}/{rel_path.replace('.rs', '')}/",
                    )
                else:
                    report.add(
                        "error",
                        "rust-arch",
                        "RUST_CLI.md",
                        f"'{tree_root}/{rel_path}' documented but does not exist",
                    )

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
    implied by the tree indentation. Detects root path lines (e.g., '.agents/skills/')
    that appear before tree-indented entries.
    """
    for start_line, _lang, code in extract_code_blocks(content):
        if "├──" not in code and "└──" not in code:
            continue

        lines = code.splitlines()

        # Detect tree root: a line before the first tree-char line that looks like a path
        tree_root = ""
        for line in lines:
            stripped = re.sub(r"\s*#.*$", "", line).strip()
            if re.match(r"^[│ ]*(?:├──|└──)", line):
                break  # hit tree lines, stop
            if stripped and re.match(r"^[\w.][\w/._-]*/?$", stripped):
                candidate = stripped.rstrip("/")
                # Skip if it's the repo's own directory name or a variant
                # (e.g., tree says "do-web-doc-resolver/" but repo is "web-doc-resolver")
                repo_name = REPO_ROOT.name
                if candidate == repo_name:
                    continue
                if candidate.removeprefix("do-") == repo_name or ("do-" + candidate) == repo_name:
                    continue
                tree_root = candidate

        dir_stack: list[tuple[int, str]] = []  # (indent_level, relative_path)

        for offset, tree_line in enumerate(lines):
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

            # If this entry is a directory, push onto stack.
            # Check via: (a) heuristic child-content scan, (b) filesystem existence.
            # Removed "/" not in entry check — entries like ".agents/skills/" need detection.
            is_dir = any(
                re.match(rf"^{' ' * (indent + 2)}[│ ]*(?:├──|└──)", line)
                for line in lines[offset + 1 :]
            )

            # Check existence (prepend tree_root if set)
            if tree_root:
                full = REPO_ROOT / tree_root / rel_path
            else:
                full = REPO_ROOT / rel_path

            if not full.exists():
                if (full.parent / rel_path.rstrip("/")).is_dir():
                    continue
                display_path = f"{tree_root}/{rel_path}" if tree_root else rel_path
                report.add(
                    "warning",
                    "repo-tree",
                    doc_name,
                    f"Tree entry '{display_path}' does not exist",
                    line_no,
                )

            if (
                is_dir
                or full.is_dir()
                or entry
                in (
                    "src",
                    "app",
                    "providers",
                    "resolver",
                    "tests",
                    "scripts",
                    "cli",
                    "web",
                    "assets",
                    "capture",
                    "skills",
                    "references",
                    "agents-docs",
                    "do-web-doc-resolver",
                    "do-wdr-cli",
                    "do-wdr-assets",
                    "do-wdr-release",
                    "do-wdr-ui-component",
                    "do-wdr-issue-swarm",
                    "do-github-pr-sentinel",
                    "agent-browser",
                    "privacy-first",
                    "skill-creator",
                    "readme-best-practices",
                    "anti-ai-slop",
                    "vercel-cli",
                    ".github",
                    "workflows",
                    ".agents",
                    ".blackbox",
                    ".claude",
                    ".opencode",
                    "public",
                    "lib",
                    "page.tsx",
                    "layout.tsx",
                    "globals.css",
                    "postcss.config.mjs",
                    "playwright.config.ts",
                    "vercel.json",
                    "ui",
                    "components",
                    "tokens",
                    "screenshots",
                    "plans",
                    "samples",
                    "videos",
                )
            ):
                dir_stack.append((indent, rel_path))


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
        for line_no, _lang, code in extract_code_blocks(content):
            for cmd_line in code.splitlines():
                m = re.search(r"npm\s+run\s+(\w[\w:.-]*)", cmd_line)
                if m:
                    script = m.group(1)
                    if script not in available_scripts:
                        report.add(
                            "error",
                            "npm-script",
                            doc_name,
                            f"npm script '{script}' not in web/package.json. "
                            f"Available: {sorted(available_scripts)}",
                            line_no,
                        )


# ── Check 9: Cross-doc consistency ────────────────────────────────────────────


def check_cross_docs(report: Report):
    """Check consistency between docs."""
    readme = read_file(REPO_ROOT / "README.md")
    _agents = read_file(REPO_ROOT / "AGENTS.md")

    # Check for duplicate links in README
    readme_links = extract_markdown_links(readme)
    seen = {}
    for line_no, text, target in readme_links:
        key = (text, target)
        if key in seen:
            report.add(
                "warning",
                "duplicate-link",
                "README.md",
                f"Duplicate link: [{text}]({target}) " f"(first at line {seen[key]})",
                line_no,
            )
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
        report.add("warning", "version-sync", "Cross-file", f"Version mismatch: {versions}")


# ── Auto-fixers ───────────────────────────────────────────────────────────────


def fix_python_cli(report: Report) -> int:
    """Fix python -m scripts.resolve → scripts.cli in all docs + CI."""
    fixes = 0
    targets = [
        "README.md",
        ".agents/skills/do-web-doc-resolver/references/CLI.md",
        ".github/workflows/ci.yml",
        ".github/workflows/mistral-test.yml",
        ".github/workflows/firecrawl-test.yml",
        ".github/workflows/tavily-test.yml",
    ]
    for target in targets:
        path = REPO_ROOT / target
        content = read_file(path)
        if not content:
            continue
        original = content
        content = content.replace("python -m scripts.resolve", "python -m scripts.cli")
        content = content.replace("python scripts/resolve.py", "python scripts/cli.py")
        if content != original:
            path.write_text(content, encoding="utf-8")
            fixes += 1
    return fixes


def fix_cargo_features(report: Report) -> int:
    """Fix RUST_CLI.md Cargo.toml features section to match actual Cargo.toml."""
    cargo = read_file(REPO_ROOT / "cli" / "Cargo.toml")
    rust_cli_path = REPO_ROOT / ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md"
    rust_cli_md = read_file(rust_cli_path)
    if not cargo or not rust_cli_md:
        return 0

    # Extract actual features
    actual_features = {}
    in_features = False
    for line in cargo.splitlines():
        if line.strip() == "[features]":
            in_features = True
            continue
        if in_features:
            if line.startswith("["):
                break
            m = re.match(r"(\w[\w-]*)\s*=\s*(.+)", line)
            if m:
                actual_features[m.group(1)] = m.group(2).strip()

    # Build correct features block
    correct_lines = ["# Cargo.toml features", "[features]"]
    for name, val in actual_features.items():
        correct_lines.append(f"{name} = {val}")
    correct_block = "\n".join(correct_lines)

    # Replace the block in the doc
    lines = rust_cli_md.splitlines()
    new_lines = []
    i = 0
    replaced = False
    while i < len(lines):
        if lines[i].strip() == "# Cargo.toml features" and not replaced:
            # Skip old features block
            new_lines.append(correct_block)
            i += 1
            while i < len(lines) and lines[i].startswith("["):
                if lines[i].startswith("#"):
                    break
                i += 1
            # Skip feature lines
            while i < len(lines) and re.match(r"^\w", lines[i]) and "=" in lines[i]:
                i += 1
            replaced = True
        else:
            new_lines.append(lines[i])
            i += 1

    new_content = "\n".join(new_lines)
    if new_content != rust_cli_md:
        rust_cli_path.write_text(new_content, encoding="utf-8")
        return 1
    return 0


def fix_duplicate_links(report: Report) -> int:
    """Remove duplicate markdown links from README.md."""
    path = REPO_ROOT / "README.md"
    content = read_file(path)
    if not content:
        return 0

    links = extract_markdown_links(content)
    seen = {}
    dupes = set()
    for line_no, text, target in links:
        key = (text, target)
        if key in seen:
            dupes.add(line_no)
        else:
            seen[key] = line_no

    if not dupes:
        return 0

    lines = content.splitlines()
    new_lines = [line for i, line in enumerate(lines, 1) if i not in dupes]
    new_content = "\n".join(new_lines)
    if new_content != content:
        path.write_text(new_content, encoding="utf-8")
        return 1
    return 0


def fix_repo_trees(report: Report) -> int:
    """Fix known tree issues in README.md and AGENTS.md."""
    fixes = 0
    for doc_name in ["README.md", "AGENTS.md"]:
        path = REPO_ROOT / doc_name
        content = read_file(path)
        if not content:
            continue
        original = content

        # Fix 1: Remove SKILL.md from repo root tree (doesn't exist)
        content = re.sub(r"\n.*SKILL\.md\s*#.*skill definition.*\n", "\n", content)

        # Fix 2: resolver.rs → resolver/ (it's a directory)
        content = content.replace(
            "resolver.rs    # Cascade orchestrator",
            "resolver/       # Cascade orchestrator",
        )

        # Fix 3: Fix .agents/skills/ tree prefix
        content = content.replace(
            "└── web-doc-resolver/",
            "└── do-web-doc-resolver/",
        )

        if content != original:
            path.write_text(content, encoding="utf-8")
            fixes += 1
    return fixes


def fix_rust_architecture(report: Report) -> int:
    """Rewrite RUST_CLI.md architecture tree to match actual cli/src/ layout."""
    rust_cli_path = REPO_ROOT / ".agents/skills/do-web-doc-resolver/references/RUST_CLI.md"
    content = read_file(rust_cli_path)
    if not content:
        return 0

    cli_src = REPO_ROOT / "cli" / "src"
    if not cli_src.is_dir():
        return 0

    # Build actual tree
    def build_tree(path: Path, prefix: str = "") -> list[str]:
        entries = sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name))
        lines = []
        for i, entry in enumerate(entries):
            if entry.name.startswith(".") or entry.name == "__pycache__":
                continue
            connector = "└── " if i == len(entries) - 1 else "├── "
            if entry.is_dir():
                lines.append(f"{prefix}{connector}{entry.name}/")
                ext = "    " if i == len(entries) - 1 else "│   "
                lines.extend(build_tree(entry, prefix + ext))
            else:
                comment = ""
                if entry.name == "main.rs":
                    comment = "  # Entry point"
                elif entry.name == "lib.rs":
                    comment = "  # Library exports"
                lines.append(f"{prefix}{connector}{entry.name}{comment}")
        return lines

    tree_lines = ["cli/", "├── Cargo.toml", "└── src/"]
    src_entries = sorted(cli_src.iterdir(), key=lambda p: (not p.is_dir(), p.name))
    for i, entry in enumerate(src_entries):
        if entry.name.startswith("."):
            continue
        connector = "└── " if i == len(src_entries) - 1 else "├── "
        if entry.is_dir():
            tree_lines.append(f"    {connector}{entry.name}/")
            ext = "        " if i == len(src_entries) - 1 else "    │   "
            sub_entries = sorted(entry.iterdir(), key=lambda p: (not p.is_dir(), p.name))
            for j, sub in enumerate(sub_entries):
                if sub.name.startswith("."):
                    continue
                sub_conn = "└── " if j == len(sub_entries) - 1 else "├── "
                tree_lines.append(f"{ext}{sub_conn}{sub.name}")
        else:
            comment = ""
            if entry.name == "main.rs":
                comment = "  # Entry point, CLI parsing"
            elif entry.name == "lib.rs":
                comment = "  # Library exports"
            elif entry.name == "cli.rs":
                comment = "  # Clap CLI definition"
            elif entry.name == "config.rs":
                comment = "  # Configuration loading"
            tree_lines.append(f"    {connector}{entry.name}{comment}")

    new_tree = "\n".join(tree_lines)

    # Replace old architecture block
    lines = content.splitlines()
    new_lines = []
    i = 0
    while i < len(lines):
        if lines[i].strip() == "## Architecture":
            new_lines.append(lines[i])
            i += 1
            # Skip blank lines
            while i < len(lines) and lines[i].strip() == "":
                new_lines.append(lines[i])
                i += 1
            # Skip old code block
            if i < len(lines) and lines[i].strip().startswith("```"):
                i += 1
                while i < len(lines) and not lines[i].strip().startswith("```"):
                    i += 1
                i += 1  # skip closing ```
            # Insert new tree
            new_lines.append("")
            new_lines.append("```")
            new_lines.append(new_tree)
            new_lines.append("```")
        else:
            new_lines.append(lines[i])
            i += 1

    new_content = "\n".join(new_lines)
    if new_content != content:
        rust_cli_path.write_text(new_content, encoding="utf-8")
        return 1
    return 0


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


def run_fixers(report: Report) -> int:
    """Apply auto-fixes for known issue categories. Returns count of files fixed."""
    total = 0
    categories = {i.category for i in report.issues}

    if "python-cli" in categories:
        total += fix_python_cli(report)
    if "cargo-feature" in categories:
        total += fix_cargo_features(report)
    if "duplicate-link" in categories:
        total += fix_duplicate_links(report)
    if "repo-tree" in categories:
        total += fix_repo_trees(report)
    if "rust-arch" in categories:
        total += fix_rust_architecture(report)

    return total


def main():
    parser = argparse.ArgumentParser(description="Validate docs against codebase")
    parser.add_argument("--strict", action="store_true", help="Exit 1 on warnings")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Auto-fix issues in-place, re-validate, stage fixed files",
    )
    args = parser.parse_args()

    report = run_all_checks()

    if args.fix and report.issues:
        categories = {i.category for i in report.issues}
        fixable = {"python-cli", "cargo-feature", "duplicate-link", "repo-tree", "rust-arch"}
        fixable_found = categories & fixable

        if fixable_found:
            print(f"\033[96mAuto-fixing: {', '.join(sorted(fixable_found))}...\033[0m")
            files_fixed = run_fixers(report)
            print(f"\033[96mFixed {files_fixed} file(s). Re-validating...\033[0m")

            # Re-run checks
            report = run_all_checks()

            # Stage fixed files
            if files_fixed > 0:
                import subprocess

                subprocess.run(
                    ["git", "add", "-u"],
                    cwd=str(REPO_ROOT),
                    capture_output=True,
                )
                print("\033[96mFixed files staged for commit.\033[0m")

    if args.json:
        output = {
            "passed": report.passed and (not args.strict or len(report.warnings) == 0),
            "errors": len(report.errors),
            "warnings": len(report.warnings),
            "issues": [
                {
                    "severity": i.severity,
                    "category": i.category,
                    "doc": i.doc,
                    "detail": i.detail,
                    "line": i.line,
                }
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

    if report.errors:
        sys.exit(1)
    if args.strict and report.warnings:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
