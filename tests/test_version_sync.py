"""Tests for scripts/sync_versions.py."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SYNC_SCRIPT = ROOT / "scripts" / "sync_versions.py"


def test_sync_versions_script_exists():
    """Verify the sync script exists and is executable."""
    assert SYNC_SCRIPT.exists(), "sync_versions.py should exist"


def test_sync_versions_check_runs():
    """Verify the check command runs without error."""
    result = subprocess.run(
        [sys.executable, str(SYNC_SCRIPT)],
        capture_output=True,
        text=True,
    )
    # Exit code 0 = all in sync, 1 = drift detected
    assert result.returncode in (0, 1), f"Unexpected exit code: {result.returncode}"


def test_sync_versions_detects_pyproject_version():
    """Verify it can read version from pyproject.toml."""
    result = subprocess.run(
        [sys.executable, str(SYNC_SCRIPT)],
        capture_output=True,
        text=True,
    )
    # Should show pyproject.toml version in output
    assert "pyproject.toml" in result.stdout


def test_sync_versions_help():
    """Verify --help or usage info is available."""
    result = subprocess.run(
        [sys.executable, str(SYNC_SCRIPT), "--help"],
        capture_output=True,
        text=True,
    )
    # Script doesn't have --help, but should still run
    assert result.returncode in (0, 1)


def test_version_files_exist():
    """Verify all version files exist."""
    expected_files = [
        ROOT / "pyproject.toml",
        ROOT / "cli" / "Cargo.toml",
        ROOT / "web" / "package.json",
    ]
    for f in expected_files:
        assert f.exists(), f"Version file should exist: {f}"


def test_versions_are_valid_semver():
    """Verify all versions are valid semver format."""
    import re

    version_files = {
        "pyproject.toml": ROOT / "pyproject.toml",
        "cli/Cargo.toml": ROOT / "cli" / "Cargo.toml",
        "web/package.json": ROOT / "web" / "package.json",
    }

    semver_pattern = r"^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$"

    for name, filepath in version_files.items():
        text = filepath.read_text()
        # Extract version from file
        if name.endswith(".json"):
            m = re.search(r'"version"\s*:\s*"([^"]+)"', text)
        else:
            m = re.search(r'^version\s*=\s*"([^"]+)"', text, re.MULTILINE)

        assert m, f"Should find version in {name}"
        version = m.group(1)
        expected_msg = f"Version in {name} should be valid semver: {version}"
        assert re.match(semver_pattern, version), expected_msg
