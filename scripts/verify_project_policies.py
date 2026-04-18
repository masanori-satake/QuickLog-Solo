#!/usr/bin/env python3
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent

REQUIRED_TEXT_CHECKS = {
    "README.md": [
        "無保証 (AS IS)",
        '"AS IS"'
    ],
    "projects/web/index.html": [
        "google-site-verification",
        "policy-local-only-short",
        "footer-disclaimer"
    ],
    "projects/web/google600c7e741a07d031.html": [
        "google-site-verification: google600c7e741a07d031.html"
    ]
}

ALLOWED_INNER_HTML = {
    "projects/studio/js/studio.js": [
        "document.querySelectorAll('[data-i18n-html]')",
        "el.innerHTML = html;"
    ]
}


def fail(message):
    print(f"Error: {message}")
    sys.exit(1)


def verify_required_text():
    for relative_path, required_snippets in REQUIRED_TEXT_CHECKS.items():
        file_path = ROOT / relative_path
        if not file_path.exists():
            fail(f"Required file is missing: {relative_path}")

        text = file_path.read_text(encoding="utf-8")
        for snippet in required_snippets:
            if snippet not in text:
                fail(f"Required text '{snippet}' was not found in {relative_path}")


def verify_inner_html_usage():
    js_files = sorted((ROOT / "projects").rglob("*.js")) + sorted((ROOT / "shared").rglob("*.js"))
    violations = []

    for file_path in js_files:
        text = file_path.read_text(encoding="utf-8")
        if "innerHTML" not in text:
            continue

        relative_path = file_path.relative_to(ROOT).as_posix()
        allowed_snippets = ALLOWED_INNER_HTML.get(relative_path)
        if not allowed_snippets:
            violations.append(f"{relative_path}: innerHTML is not allowed here")
            continue

        for snippet in allowed_snippets:
            if snippet not in text:
                violations.append(f"{relative_path}: missing allowlisted snippet '{snippet}'")

        occurrences = text.count("innerHTML")
        if occurrences != 1:
            violations.append(f"{relative_path}: expected exactly 1 innerHTML usage, found {occurrences}")

    if violations:
        print("Error: Project policy validation failed.")
        for violation in violations:
            print(f"- {violation}")
        sys.exit(1)


def main():
    verify_required_text()
    verify_inner_html_usage()
    print("Project policy checks passed.")


if __name__ == "__main__":
    main()
