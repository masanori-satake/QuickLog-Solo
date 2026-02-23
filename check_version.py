import json
import sys
import subprocess
import os

def get_staged_files():
    try:
        out = subprocess.check_output(['git', 'diff', '--cached', '--name-only']).decode().splitlines()
        return out
    except Exception:
        return []

def get_head_version():
    try:
        # Check if HEAD exists
        subprocess.check_call(['git', 'rev-parse', '--verify', 'HEAD'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        out = subprocess.check_output(['git', 'show', 'HEAD:version.json'], stderr=subprocess.DEVNULL).decode()
        return json.loads(out).get('version')
    except Exception:
        return None

def main():
    if not os.path.exists('version.json'):
        print("Error: version.json not found.")
        sys.exit(1)

    try:
        with open('version.json', 'r') as f:
            current_version = json.load(f).get('version')
    except Exception as e:
        print(f"Error: Failed to parse version.json: {e}")
        sys.exit(1)

    staged_files = get_staged_files()
    if not staged_files:
        print("No files staged. Version check skipped.")
        return

    # If version.json is NOT staged
    if 'version.json' not in staged_files:
        # Check if any source files are modified
        source_extensions = ('.js', '.html', '.css', '.py', '.svg', '.json')
        source_staged = [f for f in staged_files if f.endswith(source_extensions) and f != 'version.json' and f != 'package.json' and f != 'package-lock.json']

        if source_staged:
            print("Error: Source files are modified but version.json is not updated.")
            print(f"Modified source files: {', '.join(source_staged)}")
            sys.exit(1)
    else:
        # version.json IS staged
        head_version = get_head_version()
        if head_version and current_version == head_version:
            print(f"Error: version.json is staged but version '{current_version}' is same as HEAD.")
            print("Please increment the version in version.json.")
            sys.exit(1)

    print(f"Version check passed (v{current_version}).")

if __name__ == "__main__":
    main()
