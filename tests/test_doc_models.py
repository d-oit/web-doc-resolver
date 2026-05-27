"""Unit tests for scripts/doc_models.py — Issue, Report, and utility functions."""

import tempfile
import unittest
from pathlib import Path

from scripts.doc_models import (
    Issue,
    Report,
    extract_code_blocks,
    extract_markdown_links,
    read_file,
)


class TestIssue(unittest.TestCase):
    def test_issue_str_with_line(self):
        issue = Issue("error", "broken-link", "README.md", "Target missing: foo.md", 42)
        s = str(issue)
        self.assertIn("[ERROR]", s)
        self.assertIn("README.md:42", s)
        self.assertIn("broken-link", s)
        self.assertIn("Target missing: foo.md", s)

    def test_issue_str_without_line(self):
        issue = Issue("warning", "cli-sync", "RUST_CLI.md", "Flag missing from docs")
        s = str(issue)
        self.assertIn("[WARNING]", s)
        self.assertIn("RUST_CLI.md", s)
        self.assertNotIn(":None", s)

    def test_issue_key_identity(self):
        """Issues with identical fields produce equal keys."""
        i1 = Issue("error", "cat", "doc", "detail", 1)
        i2 = Issue("error", "cat", "doc", "detail", 1)
        i3 = Issue("error", "cat", "doc", "detail", 2)  # different line
        self.assertEqual(i1.key, i2.key)
        self.assertNotEqual(i1.key, i3.key)

    def test_issue_key_excludes_severity(self):
        """Issue.key does NOT include severity (by design for dedup)."""
        i1 = Issue("error", "cat", "doc", "detail", 1)
        i2 = Issue("warning", "cat", "doc", "detail", 1)
        # Key = (category, doc, detail, line) — severity excluded for dedup
        self.assertEqual(i1.key, i2.key)


class TestReport(unittest.TestCase):
    def test_add_single_issue(self):
        report = Report()
        report.add("error", "cat", "doc", "detail", 1)
        self.assertEqual(len(report.issues), 1)

    def test_add_duplicate_deduplicates(self):
        """Adding the same issue twice should only add once."""
        report = Report()
        report.add("error", "cat", "doc", "detail", 1)
        report.add("error", "cat", "doc", "detail", 1)
        self.assertEqual(len(report.issues), 1)

    def test_add_same_fields_different_severity_deduplicated(self):
        """Different severity with same key fields is deduplicated (severity not in key)."""
        report = Report()
        report.add("error", "cat", "doc", "detail")
        report.add("warning", "cat", "doc", "detail")
        # Severity is NOT in Issue.key, so second add is deduplicated
        self.assertEqual(len(report.issues), 1)

    def test_counts_empty(self):
        report = Report()
        self.assertEqual(report.counts, {"error": 0, "warning": 0})

    def test_counts_mixed(self):
        report = Report()
        report.add("error", "cat", "doc", "detail")
        report.add("error", "cat2", "doc", "detail")
        report.add("warning", "cat3", "doc", "detail")
        self.assertEqual(report.counts, {"error": 2, "warning": 1})

    def test_to_dict(self):
        report = Report()
        report.add("error", "cat", "doc1", "detail1", 10)
        d = report.to_dict()
        self.assertIn("issues", d)
        self.assertIn("counts", d)
        self.assertEqual(len(d["issues"]), 1)
        self.assertEqual(d["issues"][0]["severity"], "error")
        self.assertEqual(d["issues"][0]["category"], "cat")
        self.assertEqual(d["issues"][0]["line"], 10)


class TestExtractMarkdownLinks(unittest.TestCase):
    def test_simple_link(self):
        links = extract_markdown_links("[text](http://example.com)")
        self.assertEqual(links, [(1, "text", "http://example.com")])

    def test_multiple_links_on_one_line(self):
        links = extract_markdown_links("[a](url1) [b](url2)")
        self.assertEqual(links, [(1, "a", "url1"), (1, "b", "url2")])

    def test_no_links(self):
        links = extract_markdown_links("plain text without links")
        self.assertEqual(links, [])

    def test_link_with_url_containing_parens(self):
        """Links with parentheses in URL — regex captures up to first ')', which is expected."""
        links = extract_markdown_links("[wiki](https://en.wikipedia.org/wiki/Python_(language))")
        # The simple regex stops at the first ')' inside the URL, producing one link
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0], (1, "wiki", "https://en.wikipedia.org/wiki/Python_(language"))

    def test_multiline_content(self):
        content = "Line 1\n[link](http://a.com)\nLine 3\n[other](http://b.com)"
        links = extract_markdown_links(content)
        self.assertEqual(len(links), 2)
        self.assertEqual(links[0], (2, "link", "http://a.com"))
        self.assertEqual(links[1], (4, "other", "http://b.com"))


class TestExtractCodeBlocks(unittest.TestCase):
    def test_bash_block(self):
        blocks = extract_code_blocks("```bash\necho hello\n```")
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0][1], "bash")
        self.assertEqual(blocks[0][2], "echo hello")

    def test_no_lang_block(self):
        blocks = extract_code_blocks("```\nsome code\n```")
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0][1], "")
        self.assertEqual(blocks[0][2], "some code")

    def test_multiple_blocks(self):
        content = "```python\nx = 1\n```\n\ntext\n\n```bash\nls\n```"
        blocks = extract_code_blocks(content)
        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[0][1], "python")
        self.assertEqual(blocks[1][1], "bash")

    def test_no_code_blocks(self):
        blocks = extract_code_blocks("just plain text, no code")
        self.assertEqual(blocks, [])

    def test_line_numbers_increment(self):
        """Line numbers should reflect position in original content."""
        content = "line 1\nline 2\n```python\nx=1\n```"
        blocks = extract_code_blocks(content)
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0][0], 3)  # starts on line 3

    def test_empty_code_block(self):
        blocks = extract_code_blocks("```python\n\n```")
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0][2], "")


class TestReadFile(unittest.TestCase):
    def test_read_file_returns_content(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("Hello, world!")
            tmp_path = f.name

        try:
            content = read_file(Path(tmp_path))
            self.assertEqual(content, "Hello, world!")
        finally:
            Path(tmp_path).unlink()

    def test_read_file_utf8(self):
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".md", encoding="utf-8", delete=False
        ) as f:
            f.write("café résumé")
            tmp_path = f.name

        try:
            content = read_file(Path(tmp_path))
            self.assertEqual(content, "café résumé")
        finally:
            Path(tmp_path).unlink()


if __name__ == "__main__":
    unittest.main()
