import os, fnmatch
def load_ignore():
    return [".git/", ".github/", "tests/", "scripts/", "docs/", ".*"]
patterns = load_ignore()
def is_ignored(path):
    path = path.replace(os.sep, '/')
    if path.startswith('./'): path = path[2:]
    for p in patterns:
        p_match = p.rstrip('/')
        if fnmatch.fnmatch(path, p) or fnmatch.fnmatch(path, p_match) or fnmatch.fnmatch(os.path.basename(path), p): return True
        parts = path.split('/')
        for part in parts:
            if fnmatch.fnmatch(part, p) or fnmatch.fnmatch(part, p_match): return True
    return False

test_paths = ["./.git/HEAD", "./.github/workflows/ci.yml", "./tests/test.js", "./README.md", "./.scanossignore"]
for p in test_paths:
    print(f"{p}: {'ignored' if is_ignored(p) else 'NOT ignored'}")
