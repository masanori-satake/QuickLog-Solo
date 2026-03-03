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

def validate_metadata_text(metadata_text, filename):
    """
    Validates metadata text for HTML tags and forbidden patterns.
    Returns a list of violation messages.
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

def extract_metadata_block(content):
    """
    Extracts the metadata block from the animation module content.
    Tries to be robust against different ending styles.
    """
    # Matches "static metadata = { ... }"
    # Supporting both with and without semicolon, and capturing the block.
    # We use a non-greedy match that looks for either a semicolon or the start of the next property/method.
    # For better robustness with nested braces, we look for the pattern up to the next likely class member.
    match = re.search(r'static\s+metadata\s*=\s*(\{[\s\S]*?\}|[\s\S]*?)(?:;|\s+(?:config|constructor|setup|draw|onClick|onMouseMove))', content)
    if match:
        return match.group(1)

    # Fallback for the end of the file
    match = re.search(r'static\s+metadata\s*=\s*(\{[\s\S]*?\}|[\s\S]*?)$', content)
    if match:
        return match.group(1)

    return None
