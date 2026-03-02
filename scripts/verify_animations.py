import os
import sys

# Forbidden keywords that should not appear in animation modules
FORBIDDEN_KEYWORDS = [
    'fetch',
    'XMLHttpRequest',
    'IndexedDB',
    'eval(',
    'new Function(',
    'localStorage',
    'sessionStorage',
    'cookie',
    'BroadcastChannel',
    'WebSocket'
]

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
            content = f.read()
            for keyword in FORBIDDEN_KEYWORDS:
                if keyword in content:
                    violations.append(f"Violation in {filename}: Found forbidden keyword '{keyword}'")

    if violations:
        for v in violations:
            print(v)
        return False

    print(f"Verified {len(files)} animations. No forbidden keywords found.")
    return True

if __name__ == "__main__":
    if not verify_animations():
        sys.exit(1)
