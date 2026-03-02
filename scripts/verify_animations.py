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
    Removes comments from JS code while preserving strings to avoid false positives
    and also avoid corrupting code that contains URL-like strings (e.g. "http://").
    Actually, we want to remove strings too because forbidden keywords in strings
    might be used for dynamic execution (though 'eval' check handles that).
    Wait, if we remove strings, we might miss some tricks, but our goal is to
    allow these words in COMMENTS.
    """
    # Pattern to match:
    # 1. Multi-line comments: /* ... */
    # 2. Single-line comments: // ...
    # 3. Double-quoted strings: " ... "
    # 4. Single-quoted strings: ' ... '
    # 5. Template literals: ` ... `
    pattern = r'(/\*[\s\S]*?\*/|//.*)|("(\\.|[^"\\])*"|\'(\\.|[^\'\\])*\'|`(\\.|[^`\\])*`)'

    def replacer(match):
        # If it's a comment, return empty string
        if match.group(1):
            return ""
        # If it's a string, return a placeholder to avoid matching keywords inside
        else:
            return '"__STRING_PLACEHOLDER__"'

    return re.sub(pattern, replacer, content)

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

            # Remove comments and mask strings before verifying patterns
            clean_content = remove_comments_and_strings(raw_content)

            for pattern in FORBIDDEN_PATTERNS:
                if re.search(pattern, clean_content):
                    violations.append(f"Violation in {filename}: Found forbidden pattern matching '{pattern}'")

    if violations:
        for v in violations:
            print(v)
        return False

    print(f"Verified {len(files)} animations. No forbidden patterns found in code.")
    return True

if __name__ == "__main__":
    if not verify_animations():
        sys.exit(1)
