import json
import sys
import os

def check_version():
    version_file = 'version.json'
    if not os.path.exists(version_file):
        print(f"Error: {version_file} not found.")
        sys.exit(1)

    try:
        with open(version_file, 'r') as f:
            data = json.load(f)
            version = data.get('version')
            if not version:
                print("Error: Version not found in version.json.")
                sys.exit(1)

            # This script should be integrated into a pre-commit hook.
            # It ensures the version is defined.
            print(f"Version check passed: {version}")
    except Exception as e:
        print(f"Error parsing version.json: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_version()
