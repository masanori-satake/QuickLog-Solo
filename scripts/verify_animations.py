import os
import sys
import re
from animation_utils import FORBIDDEN_PATTERNS, validate_metadata_text, extract_metadata_block

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

def verify_animations():
    animation_dir = 'shared/js/animation'
    if not os.path.exists(animation_dir):
        print(f"Directory {animation_dir} not found.")
        return True

    violations = []
    files = [f for f in os.listdir(animation_dir) if f.endswith('.js')]

    for filename in files:
        filepath = os.path.join(animation_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            raw_content = f.read()

            if 'devOnly: true' in raw_content:
                print(f"Skipping verification for development-only module: {filename}")
                continue

            # 1. Extract and verify metadata block
            metadata_text = extract_metadata_block(raw_content)
            if not metadata_text:
                violations.append(f"Error in {filename}: Could not extract metadata block. All animations must have 'static metadata'.")
            else:
                violations.extend(validate_metadata_text(metadata_text, filename))

            # 2. Ensure explicit constructor for defensive initialization
            if not re.search(r'\bconstructor\s*\(\s*\)\s*\{', raw_content):
                violations.append(f"Violation in {filename}: Missing explicit constructor. All animations must initialize state arrays in the constructor for robustness.")

            # 3. Verify the rest of the code with masking
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
