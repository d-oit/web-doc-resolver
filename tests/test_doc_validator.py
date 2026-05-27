"""Tests for scripts/doc_validator.py checkers using temporary directories."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.doc_models import Report
from scripts.doc_validator import (
    check_cross_docs,
    check_file_references,
    check_npm_scripts,
    check_shell_commands,
)

# ─── File References ──────────────────────────────────────────────────────


class TestCheckFileReferences(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _patch(self):
        return patch("scripts.doc_validator.REPO_ROOT", new=self.repo_root)

    def test_valid_link_passes(self):
        """Link pointing to an existing file does not produce an issue."""
        (self.repo_root / "existing.md").write_text("content")
        report = Report()
        content = "[click here](existing.md)"

        with self._patch():
            check_file_references(report, "doc.md", content)

        self.assertEqual(len(report.issues), 0)

    def test_broken_link_warns(self):
        """Link pointing to a missing file produces a warning."""
        report = Report()
        content = "[missing](nonexistent.md)"

        with self._patch():
            check_file_references(report, "doc.md", content)

        self.assertEqual(len(report.issues), 1)
        self.assertEqual(report.issues[0].severity, "warning")
        self.assertEqual(report.issues[0].category, "broken-link")

    def test_http_links_ignored(self):
        """HTTP/HTTPS links are skipped (external)."""
        report = Report()
        content = "[external](https://example.com/page)"

        with self._patch():
            check_file_references(report, "doc.md", content)

        self.assertEqual(len(report.issues), 0)

    def test_anchor_links_ignored(self):
        """Anchor-only links (#section) are skipped."""
        report = Report()
        content = "[jump](#section)"

        with self._patch():
            check_file_references(report, "doc.md", content)

        self.assertEqual(len(report.issues), 0)

    def test_mailto_links_ignored(self):
        """mailto: links are skipped."""
        report = Report()
        content = "[email](mailto:user@example.com)"

        with self._patch():
            check_file_references(report, "doc.md", content)

        self.assertEqual(len(report.issues), 0)

    def test_link_with_anchor_strips_fragment(self):
        """Links with #anchor check only the file path portion."""
        (self.repo_root / "real.md").write_text("content")
        report = Report()
        content = "[section](real.md#fragment)"

        with self._patch():
            check_file_references(report, "doc.md", content)

        self.assertEqual(len(report.issues), 0)

    def test_mixed_valid_and_broken_links(self):
        """Mixed links: valid ones pass, broken ones warn."""
        (self.repo_root / "good.md").write_text("ok")
        report = Report()
        content = "[good](good.md)\n[bad](bad.md)"

        with self._patch():
            check_file_references(report, "doc.md", content)

        self.assertEqual(len(report.issues), 1)
        self.assertIn("bad.md", report.issues[0].detail)


# ─── Shell Commands ───────────────────────────────────────────────────────


class TestCheckShellCommands(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = Path(self.temp_dir.name)
        (self.repo_root / "scripts").mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _patch(self):
        return patch("scripts.doc_validator.REPO_ROOT", new=self.repo_root)

    def test_existing_script_passes(self):
        """Referenced script exists → no issue."""
        (self.repo_root / "scripts" / "hello.py").write_text("print('hi')")
        report = Report()
        content = "```bash\npython3 ./scripts/hello.py\n```"

        with self._patch():
            check_shell_commands(report, "doc.md", content)

        self.assertEqual(len(report.issues), 0)

    def test_missing_script_errors(self):
        """Referenced script doesn't exist → error."""
        report = Report()
        content = "```bash\npython3 ./scripts/missing.py\n```"

        with self._patch():
            check_shell_commands(report, "doc.md", content)

        self.assertEqual(len(report.issues), 1)
        self.assertEqual(report.issues[0].severity, "error")
        self.assertEqual(report.issues[0].category, "missing-script")

    def test_non_shell_blocks_ignored(self):
        """Python code blocks (not bash/sh/shell) are ignored."""
        report = Report()
        content = "```python\nprint('hello')\n```"

        with self._patch():
            check_shell_commands(report, "doc.md", content)

        self.assertEqual(len(report.issues), 0)

    def test_shell_script_referenced(self):
        """Shell script with .sh extension is validated."""
        (self.repo_root / "scripts" / "setup.sh").write_text("#!/bin/bash")
        report = Report()
        content = "```sh\n./scripts/setup.sh\n```"

        with self._patch():
            check_shell_commands(report, "doc.md", content)

        self.assertEqual(len(report.issues), 0)

    def test_missing_module_errors(self):
        """python -m scripts.missing → error."""
        report = Report()
        content = "```bash\npython3 -m scripts.nonexistent\n```"

        with self._patch():
            check_shell_commands(report, "doc.md", content)

        self.assertEqual(len(report.issues), 1)
        self.assertEqual(report.issues[0].category, "missing-module")


# ─── NPM Scripts ──────────────────────────────────────────────────────────


class TestCheckNpmScripts(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = Path(self.temp_dir.name)
        (self.repo_root / "web").mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _patch(self):
        return patch("scripts.doc_validator.REPO_ROOT", new=self.repo_root)

    def _write_pkg(self, scripts: dict):
        pkg = {"scripts": scripts}
        (self.repo_root / "web" / "package.json").write_text(json.dumps(pkg))

    def test_existing_script_passes(self):
        """README references an npm script that exists in package.json."""
        self._write_pkg({"build": "next build"})
        (self.repo_root / "README.md").write_text("Run `pnpm run build` to compile.")
        report = Report()

        with self._patch():
            check_npm_scripts(report)

        self.assertEqual(len(report.issues), 0)

    def test_missing_script_errors(self):
        """README references a script not in package.json → error."""
        self._write_pkg({"lint": "eslint ."})
        (self.repo_root / "README.md").write_text("Run `pnpm run test` to check.")
        report = Report()

        with self._patch():
            check_npm_scripts(report)

        self.assertEqual(len(report.issues), 1)
        self.assertEqual(report.issues[0].category, "npm-script")
        self.assertEqual(report.issues[0].severity, "error")

    def test_missing_files_skips_silently(self):
        """When package.json or README.md don't exist, no error."""
        report = Report()

        with self._patch():
            check_npm_scripts(report)

        self.assertEqual(len(report.issues), 0)


# ─── Cross-Docs 👋 Dedup ──────────────────────────────────────────────────


class TestCheckCrossDocs(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _patch(self):
        return patch("scripts.doc_validator.REPO_ROOT", new=self.repo_root)

    def test_duplicate_link_warns(self):
        """Duplicate markdown links in README produce a warning."""
        content = "[API](api.md)\n[API](api.md)\n"
        (self.repo_root / "README.md").write_text(content)
        (self.repo_root / "AGENTS.md").write_text("# Agents\n")  # required by check_cross_docs
        report = Report()

        with self._patch():
            check_cross_docs(report)

        self.assertEqual(len(report.issues), 1)
        self.assertEqual(report.issues[0].category, "duplicate-link")

    def test_unique_links_pass(self):
        """No duplicates → no issues (properly tests dedup, not early return)."""
        content = "[API](api.md)\n[Guide](guide.md)\n"
        (self.repo_root / "README.md").write_text(content)
        (self.repo_root / "AGENTS.md").write_text(
            "# Agents\n"
        )  # required to test actual dedup logic
        report = Report()

        with self._patch():
            check_cross_docs(report)

        self.assertEqual(len(report.issues), 0)

    def test_missing_readme_skips(self):
        """Missing README.md → no crash, no issues."""
        report = Report()

        with self._patch():
            check_cross_docs(report)

        self.assertEqual(len(report.issues), 0)


if __name__ == "__main__":
    unittest.main()
