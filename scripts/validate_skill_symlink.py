#!/usr/bin/env python3
"""Validate that skill symlinks in .blackbox/skills/, .claude/skills/, .opencode/skills/ point to .agents/skills/."""

import sys
from pathlib import Path


def validate_single_symlink(skill_dir: Path, canonical_dir: Path, name: str) -> bool:
    """Validate a single skill directory symlink."""
    errors = []

    # Check if canonical directory exists first
    if not canonical_dir.exists():
        errors.append(f"❌ {name}: Canonical directory does not exist: {canonical_dir}")
        for error in errors:
            print(error)
        return False

    # Check if symlink exists
    if not skill_dir.exists() and not skill_dir.is_symlink():
        errors.append(f"⚠️  {name}: Symlink not found at {skill_dir}")
        for error in errors:
            print(error)
        return True  # Missing symlink is a warning, not a failure

    # Check if it's a symlink
    if not skill_dir.is_symlink():
        errors.append(f"❌ {name}: Not a symlink (it's a regular file or directory): {skill_dir}")
        for error in errors:
            print(error)
        return False

    # Resolve both to absolute paths for comparison
    resolved_target = skill_dir.resolve()
    resolved_expected = canonical_dir.resolve()

    if resolved_target != resolved_expected:
        errors.append(f"❌ {name}: Points to wrong target")
        errors.append(f"   Expected: {resolved_expected}")
        errors.append(f"   Got:      {resolved_target}")
        for error in errors:
            print(error)
        return False

    # Check if canonical directory has SKILL.md
    skill_md = canonical_dir / "SKILL.md"
    if not skill_md.exists():
        errors.append(f"❌ {name}: SKILL.md does not exist in canonical: {skill_md}")
        for error in errors:
            print(error)
        return False

    print(f"✅ {name}: Valid")
    print(f"   Link: {skill_dir}")
    print(f"   Target: {skill_dir.resolve()}")
    return True


def validate_skill_symlinks():
    """Ensure all skill symlinks point to the correct location."""
    root_dir = Path(__file__).parent.parent
    canonical_skills = root_dir / ".agents" / "skills"

    if not canonical_skills.exists():
        print(f"❌ Canonical skills directory does not exist: {canonical_skills}")
        sys.exit(1)

    # Get all skill directories from .agents/skills/
    skill_dirs = [d for d in canonical_skills.iterdir() if d.is_dir()]

    if not skill_dirs:
        print("⚠️  No skills found in .agents/skills/")
        return True

    all_valid = True
    total_checked = 0

    # Validate symlinks in all three locations
    symlink_dirs = [".blackbox", ".claude", ".opencode"]

    for canonical_skill in skill_dirs:
        skill_name = canonical_skill.name
        skill_md = canonical_skill / "SKILL.md"

        # Check if SKILL.md exists in canonical
        if not skill_md.exists():
            print(f"⚠️  {skill_name}: No SKILL.md in canonical directory")
            continue

        # Check symlinks in all three locations
        for symlink_dir_name in symlink_dirs:
            skill_symlink = root_dir / symlink_dir_name / "skills" / skill_name
            is_valid = validate_single_symlink(
                skill_symlink, canonical_skill, f"{symlink_dir_name}/skills/{skill_name}"
            )
            all_valid = all_valid and is_valid
            total_checked += 1

    print()
    if all_valid:
        print(f"✅ PASS: All {total_checked} skill symlinks are valid")
        return True
    else:
        print("❌ FAIL: Some skill symlinks are invalid")
        sys.exit(1)


if __name__ == "__main__":
    validate_skill_symlinks()
