import os
import sys
import re

# Forbidden patterns that should not appear in animation modules.
# Using regex with word boundaries where appropriate to avoid false positives.
FORBIDDEN_PATTERNS = [
    r'\bfetch\b',
    r'\bXMLHttpRequest\b',
    r'\bIndexedDB\b',
    r'eval\s*\(',
    r'new\s+Function\s*\(',
    r'\blocalStorage\b',
    r'\bsessionStorage\b',
    r'\bcookie\b',
    r'\bBroadcastChannel\b',
    r'\bWebSocket\b'
]

def remove_comments_and_strings(content):
    """
    Removes comments from JS code while preserving strings to avoid false positives.
    """
    pattern = r'(/\*[\s\S]*?\*/|//.*)|("(\\.|[^"\\])*"|\'(\\.|[^\'\\])*\'|`(\\.|[^`\\])*`)'

    def replacer(match):
        if match.group(1):
            return ""
        else:
            return '"__STRING_PLACEHOLDER__"'

    return re.sub(pattern, replacer, content)

def verify_metadata_content(metadata_text, filename):
    """
    Specifically verifies the content of the metadata block.
    Checks for HTML tags and forbidden patterns inside strings.
    """
    violations = []

    # Check for HTML tags
    if '<' in metadata_text or '>' in metadata_text:
        violations.append(f"Violation in {filename}: Found potential HTML tags ('<' or '>') in metadata.")

    # Check for forbidden patterns (even inside strings)
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, metadata_text):
            violations.append(f"Violation in {filename}: Found forbidden pattern matching '{pattern}' in metadata.")

    return violations

def verify_animations():
    animation_dir = 'src/js/animation'
    if not os.path.exists(animation_dir):
        print(f"Directory {animation_dir} not found.")
        return True

    violations = []
    files = [f for f in os.listdir(animation_dir) if f.endswith('.js')]

    for filename in files:
        filepath = os.path.join(animation_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            raw_content = f.read()

            # 1. Extract and verify metadata block
            # This is a bit naive but should work for the standard format used in the project
            metadata_match = re.search(r'static\s+metadata\s*=\s*(\{[\s\S]*?\});', raw_content)
            if metadata_match:
                metadata_text = metadata_match.group(1)
                violations.extend(verify_metadata_content(metadata_text, filename))
            else:
                # If no metadata found, it might be an issue depending on project rules
                # But for now we just skip it or log it if it's mandatory
                pass

            # 2. Verify the rest of the code with masking
            clean_content = remove_comments_and_strings(raw_content)
            for pattern in FORBIDDEN_PATTERNS:
                if re.search(pattern, clean_content):
                    violations.append(f"Violation in {filename}: Found forbidden pattern matching '{pattern}' in code.")

    if violations:
        for v in violations:
            print(v)
        return False

    print(f"Verified {len(files)} animations. No forbidden patterns or unsafe metadata found.")
    return True

if __name__ == "__main__":
    if not verify_animations():
        sys.exit(1)
