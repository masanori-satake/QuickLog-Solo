#!/usr/bin/env python3
import os
import re
import sys

# Directories to scan
SCAN_DIRS = ['src']

# Keywords indicating potential OSS fragments or external licenses
# Some are case-sensitive to avoid matching common words (like German "mit")
FORBIDDEN_KEYWORDS_CASE_INSENSITIVE = [
    r'\bCopyright\b',
    r'\bLicense\b',
    r'\bCreative\s+Commons\b',
    r'\bAll\s+rights\s+reserved\b'
]

FORBIDDEN_KEYWORDS_CASE_SENSITIVE = [
    r'\bMIT\b',
    r'\bApache\b',
    r'\bGPL\b',
    r'\bBSD\b'
]

# External URLs indicating potential copy-paste sources
# (Allowing known legitimate ones)
# Added w3.org for SVG namespaces
ALLOWED_URL_PATTERNS = [
    r'fonts\.googleapis\.com',
    r'fonts\.gstatic\.com',
    r'github\.com/masanori-satake/QuickLog-Solo',
    r'raw\.githubusercontent\.com',
    r'www\.w3\.org/2000/svg'
]

SUSPICIOUS_URL_PATTERN = r'https?://(?!(?:' + '|'.join(ALLOWED_URL_PATTERNS) + r'))[a-zA-Z0-9./_-]+'

# Authorized strings (RegEx patterns) to ignore
# These are known safe strings used in the project.
AUTHORIZED_PATTERNS = [
    r'masanori-satake',
    r'about-disclaimer',
    r'about-description',
    r'pr-step-2', # Fork step in localization
    r'tooltip-auto-stop',
    r'backup-description',
    r'google-site-verification', # Only in index.html, but script might scan it if expanded
]

def audit_file(filepath):
    """
    Scans a single file for forbidden keywords and suspicious URLs.
    Returns a list of detected violations.
    """
    violations = []

    # We only scan text-based files
    if not filepath.endswith(('.js', '.html', '.css', '.json')):
        return violations

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        for i, line in enumerate(lines, 1):
            # Check for forbidden keywords (Case Insensitive)
            for pattern in FORBIDDEN_KEYWORDS_CASE_INSENSITIVE:
                if re.search(pattern, line, re.IGNORECASE):
                    is_authorized = any(re.search(auth, line) for auth in AUTHORIZED_PATTERNS)
                    if not is_authorized:
                        violations.append(f"Line {i}: Found forbidden keyword pattern '{pattern}' (case-insensitive)")

            # Check for forbidden keywords (Case Sensitive)
            for pattern in FORBIDDEN_KEYWORDS_CASE_SENSITIVE:
                if re.search(pattern, line):
                    is_authorized = any(re.search(auth, line) for auth in AUTHORIZED_PATTERNS)
                    if not is_authorized:
                        violations.append(f"Line {i}: Found forbidden keyword pattern '{pattern}' (case-sensitive)")

            # Check for suspicious URLs
            matches = re.finditer(SUSPICIOUS_URL_PATTERN, line)
            for match in matches:
                url = match.group(0)
                # Double check if authorized
                is_authorized = any(re.search(auth, line) for auth in AUTHORIZED_PATTERNS)
                if not is_authorized:
                    violations.append(f"Line {i}: Found suspicious URL '{url}'")

    except Exception as e:
        print(f"Error reading {filepath}: {e}")

    return violations

def main():
    total_violations = 0

    print("Starting OSS Fragment Audit...")
    print(f"Scanning directories: {', '.join(SCAN_DIRS)}")

    for scan_dir in SCAN_DIRS:
        for root, _, files in os.walk(scan_dir):
            for file in files:
                filepath = os.path.join(root, file)
                violations = audit_file(filepath)

                if violations:
                    print(f"\n[!] Violation(s) detected in: {filepath}")
                    for v in violations:
                        print(f"    - {v}")
                    total_violations += len(violations)

    if total_violations > 0:
        print(f"\nAudit FAILED. Total violations: {total_violations}")
        sys.exit(1)
    else:
        print("\nAudit PASSED. No suspicious fragments found in src/.")
        sys.exit(0)

if __name__ == "__main__":
    main()
