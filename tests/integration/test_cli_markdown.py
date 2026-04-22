import os
import subprocess

import pytest

CLI_PATH = "./cli/target/release/do-wdr"

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.path.exists(CLI_PATH),
        reason=f"CLI binary not found at {CLI_PATH}. Run 'cd cli && cargo build --release' first.",
    ),
]


@pytest.mark.integration
def test_cli_output_markdown_code_blocks():
    """Test that the CLI correctly outputs Markdown with code blocks from a documentation site."""
    url = "https://docs.rs/tokio/latest/tokio/"

    result = subprocess.run(
        [CLI_PATH, "resolve", url, "--provider", "jina"], capture_output=True, text=True, check=True
    )

    content = result.stdout
    assert len(content) > 500
    # Check for presence of code blocks
    assert "```" in content
    # Ensure no common 'unparsed' indicators
    assert "<pre" not in content
    assert "<code>" not in content


@pytest.mark.integration
def test_cli_output_markdown_latex():
    """Test that the CLI correctly outputs Markdown with LaTeX from a math-heavy site."""
    url = "https://en.wikipedia.org/wiki/Quadratic_formula"

    result = subprocess.run(
        [CLI_PATH, "resolve", url, "--provider", "jina"], capture_output=True, text=True, check=True
    )

    content = result.stdout
    assert len(content) > 500

    # Check for LaTeX patterns
    # Wikipedia Jina output often uses $ or \( \) or images with alt text
    # Let's check for common LaTeX symbols or markers
    latex_indicators = ["\\pm", "\\sqrt", "b^2", "2a", "$"]
    found = any(ind in content for ind in latex_indicators)

    assert found, f"No LaTeX indicators found in output: {content[:500]}..."


@pytest.mark.integration
def test_cli_javascript_heavy_site():
    """Test CLI's ability to handle a JS-heavy site."""
    # React.dev is very JS heavy
    url = "https://react.dev/learn"

    result = subprocess.run(
        [CLI_PATH, "resolve", url, "--provider", "jina"], capture_output=True, text=True, check=True
    )

    content = result.stdout
    assert len(content) > 500
    # Should have meaningful content, not just a 'loading' or 'enable JS' message
    assert "React" in content
    assert "Components" in content or "Hooks" in content or "Learn" in content
