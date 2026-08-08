"""Verify QuickLog-Solo development environment prerequisites.

This script checks the availability of all required development tools
and reports PASS/FAIL for each item. It performs read-only checks only
and never installs, modifies, or repairs anything automatically.
"""

import sys
import os
import subprocess
import shutil
import re
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class CheckResult:
    """Individual check result."""

    name: str  # Check item display name
    passed: bool  # Whether the check passed
    detail: str  # Version info or status detail
    hint: str  # Remediation hint (empty if passed)


def format_result(result: CheckResult) -> str:
    """Format a single CheckResult with ✓/✗ marker and optional hint.

    PASS → ✓ {name:<14} : {detail}
    FAIL → ✗ {name:<14} : {detail}\\n  → Hint: {hint}
    """
    if result.passed:
        return f"\u2713 {result.name:<14} : {result.detail}"
    else:
        line = f"\u2717 {result.name:<14} : {result.detail}"
        if result.hint:
            line += f"\n  \u2192 Hint: {result.hint}"
        return line


def check_node() -> CheckResult:
    """Check Node.js 24.x availability via `node --version`."""
    try:
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        version_str = result.stdout.strip()
        # Expected format: vMajor.Minor.Patch (e.g., v24.1.0)
        match = re.match(r"^v(\d+)\.\d+\.\d+", version_str)
        if not match:
            return CheckResult(
                name="Node.js",
                passed=False,
                detail=f"unexpected output: {version_str}",
                hint="Install Node.js 24: https://nodejs.org/",
            )
        major = int(match.group(1))
        if major == 24:
            return CheckResult(
                name="Node.js",
                passed=True,
                detail=version_str,
                hint="",
            )
        else:
            return CheckResult(
                name="Node.js",
                passed=False,
                detail=version_str,
                hint=f"Expected Node.js 24.x, found {version_str}. Use nvm to switch.",
            )
    except FileNotFoundError:
        return CheckResult(
            name="Node.js",
            passed=False,
            detail="not found",
            hint="Install Node.js 24: https://nodejs.org/",
        )
    except subprocess.TimeoutExpired:
        return CheckResult(
            name="Node.js",
            passed=False,
            detail="command timed out",
            hint="Install Node.js 24: https://nodejs.org/",
        )


def check_python() -> CheckResult:
    """Check Python 3.x availability via `python --version` or `python3 --version`.

    Platform-aware command order:
      - Windows: python → fallback python3
      - Linux/other: python3 → fallback python
    """
    if sys.platform == "win32":
        commands = [["python", "--version"], ["python3", "--version"]]
    else:
        commands = [["python3", "--version"], ["python", "--version"]]

    version_str = None
    for cmd in commands:
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=5,
            )
            output = result.stdout.strip() or result.stderr.strip()
            if output:
                version_str = output
                break
        except FileNotFoundError:
            continue
        except subprocess.TimeoutExpired:
            return CheckResult(
                name="Python",
                passed=False,
                detail="command timed out",
                hint="Install Python 3.x: https://www.python.org/downloads/",
            )

    if not version_str:
        return CheckResult(
            name="Python",
            passed=False,
            detail="not found",
            hint="Install Python 3.x: https://www.python.org/downloads/",
        )

    # Expected format: Python X.Y.Z (e.g., Python 3.12.4)
    match = re.match(r"^Python\s+(\d+)\.(\d+)\.(\d+)", version_str)
    if not match:
        return CheckResult(
            name="Python",
            passed=False,
            detail=f"unexpected output: {version_str}",
            hint="Install Python 3.x: https://www.python.org/downloads/",
        )

    major = int(match.group(1))
    version_num = f"{match.group(1)}.{match.group(2)}.{match.group(3)}"

    if major == 3:
        return CheckResult(
            name="Python",
            passed=True,
            detail=version_num,
            hint="",
        )
    else:
        return CheckResult(
            name="Python",
            passed=False,
            detail=version_num,
            hint="Install Python 3.x: https://www.python.org/downloads/",
        )


def check_node_modules() -> CheckResult:
    """Check existence of `node_modules/` directory relative to project root."""
    project_root = Path(__file__).resolve().parent.parent
    node_modules_path = project_root / "node_modules"

    if node_modules_path.is_dir():
        return CheckResult(
            name="node_modules",
            passed=True,
            detail="installed",
            hint="",
        )
    else:
        return CheckResult(
            name="node_modules",
            passed=False,
            detail="not found",
            hint="Run: npm ci",
        )


def check_playwright_chromium() -> CheckResult:
    """Check Playwright Chromium browser binary existence."""
    project_root = Path(__file__).resolve().parent.parent

    # Determine platform-specific primary path
    if sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        primary = Path(local_app_data) / "ms-playwright" if local_app_data else None
    else:
        primary = Path.home() / ".cache" / "ms-playwright"

    # Fallback path (shared across platforms)
    fallback = project_root / "node_modules" / ".cache" / "ms-playwright"

    search_paths = [p for p in (primary, fallback) if p is not None]

    for pw_path in search_paths:
        if pw_path.is_dir():
            try:
                chromium_dirs = [
                    d for d in pw_path.iterdir()
                    if d.is_dir() and d.name.startswith("chromium-")
                ]
                if chromium_dirs:
                    return CheckResult(
                        name="Playwright",
                        passed=True,
                        detail=f"installed ({chromium_dirs[0].name})",
                        hint="",
                    )
            except PermissionError:
                return CheckResult(
                    name="Playwright",
                    passed=False,
                    detail="permission denied",
                    hint="Run: npx playwright install --with-deps chromium",
                )

    return CheckResult(
        name="Playwright",
        passed=False,
        detail="not found",
        hint="Run: npx playwright install --with-deps chromium",
    )


def check_pre_commit_hooks() -> CheckResult:
    """Check `.git/hooks/pre-commit` file existence and non-triviality."""
    project_root = Path(__file__).resolve().parent.parent
    git_dir = project_root / ".git"

    if not git_dir.is_dir():
        return CheckResult(
            name="pre-commit",
            passed=False,
            detail="not a git repository",
            hint="Run: pip install pre-commit && git init && pre-commit install",
        )

    hook_file = git_dir / "hooks" / "pre-commit"

    if not hook_file.is_file():
        return CheckResult(
            name="pre-commit",
            passed=False,
            detail="not found",
            hint="Run: pip install pre-commit && pre-commit install",
        )

    if hook_file.stat().st_size == 0:
        return CheckResult(
            name="pre-commit",
            passed=False,
            detail="hook file is empty",
            hint="Run: pip install pre-commit && pre-commit install",
        )

    return CheckResult(
        name="pre-commit",
        passed=True,
        detail="hooks installed",
        hint="",
    )


def main() -> int:
    """Run all checks, print summary, return exit code.

    Returns:
        0 if all checks pass, 1 if any check fails.
    """
    print("=== QuickLog-Solo \u958b\u767a\u74b0\u5883\u30c1\u30a7\u30c3\u30af ===")
    print()

    checks = [
        check_node,
        check_python,
        check_node_modules,
        check_playwright_chromium,
        check_pre_commit_hooks,
    ]

    results = [check() for check in checks]

    for result in results:
        print(format_result(result))

    passed_count = sum(1 for r in results if r.passed)
    total = len(results)
    status = "PASS" if passed_count == total else "FAIL"

    print()
    print(f"--- Result: {passed_count}/{total} passed ({status}) ---")

    return 0 if passed_count == total else 1


if __name__ == "__main__":
    try:
        # Ensure UTF-8 output on Windows (cp932 cannot encode ✓/✗/→)
        if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
            sys.stdout.reconfigure(encoding="utf-8")
        if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
            sys.stderr.reconfigure(encoding="utf-8")
        sys.exit(main())
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(2)
