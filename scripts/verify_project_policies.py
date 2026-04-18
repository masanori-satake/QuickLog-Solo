#!/usr/bin/env python3
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent

REQUIRED_TEXT_CHECKS = {
    "README.md": [
        "\u7121\u4fdd\u8a3c (AS IS)",
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

HTML_SINK_PATTERNS = {
    "innerHTML": re.compile(r"\.innerHTML\b"),
    "insertAdjacentHTML": re.compile(r"\.insertAdjacentHTML\b")
}


def strip_js_comments(text):
    return re.sub(r"//.*|/\*[\s\S]*?\*/", "", text)


def verify_required_text():
    violations = []

    for relative_path, required_snippets in REQUIRED_TEXT_CHECKS.items():
        file_path = ROOT / relative_path
        if not file_path.exists():
            violations.append(f"Required file is missing: {relative_path}")
            continue

        text = file_path.read_text(encoding="utf-8")
        for snippet in required_snippets:
            if snippet not in text:
                violations.append(f"Required text '{snippet}' was not found in {relative_path}")

    return violations


def verify_inner_html_usage():
    js_files = sorted((ROOT / "projects").rglob("*.js")) + sorted((ROOT / "shared").rglob("*.js"))
    violations = []

    for file_path in js_files:
        text = file_path.read_text(encoding="utf-8")
        clean_text = strip_js_comments(text)

        has_html_sink = any(pattern.search(clean_text) for pattern in HTML_SINK_PATTERNS.values())
        if not has_html_sink:
            continue

        relative_path = file_path.relative_to(ROOT).as_posix()
        allowed_snippets = ALLOWED_INNER_HTML.get(relative_path)
        if not allowed_snippets:
            violations.append(f"{relative_path}: innerHTML / insertAdjacentHTML is not allowed here")
            continue

        for snippet in allowed_snippets:
            if snippet not in text:
                violations.append(f"{relative_path}: missing allowlisted snippet '{snippet}'")

        inner_html_occurrences = len(HTML_SINK_PATTERNS["innerHTML"].findall(clean_text))
        expected_inner_html = sum(1 for snippet in allowed_snippets if "innerHTML" in snippet)
        if inner_html_occurrences != expected_inner_html:
            violations.append(
                f"{relative_path}: expected {expected_inner_html} innerHTML usage(s), found {inner_html_occurrences}"
            )

        insert_adjacent_html_occurrences = len(HTML_SINK_PATTERNS["insertAdjacentHTML"].findall(clean_text))
        if insert_adjacent_html_occurrences != 0:
            violations.append(
                f"{relative_path}: insertAdjacentHTML is not allowed, found {insert_adjacent_html_occurrences}"
            )

    return violations


def main():
    violations = verify_required_text() + verify_inner_html_usage()
    if violations:
        print("Error: Project policy validation failed.")
        for violation in violations:
            print(f"- {violation}")
        sys.exit(1)
    print("Project policy checks passed.")


if __name__ == "__main__":
    main()
