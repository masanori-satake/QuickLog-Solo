import json
import sys

def check_version():
    try:
        # Load version from version.json
        with open('src/version.json', 'r') as f:
            version = json.load(f).get('version')

        # Load version from package.json
        with open('package.json', 'r') as f:
            package_version = json.load(f).get('version')

        # Load version from manifest.chrome.json
        with open('src/manifest.chrome.json', 'r') as f:
            chrome_version = json.load(f).get('version')

        # Load version from manifest.firefox.json
        with open('src/manifest.firefox.json', 'r') as f:
            firefox_version = json.load(f).get('version')

        if not version:
            print("Error: version.json is missing version field.")
            return False

        if version != package_version:
            print(f"Error: package.json version ({package_version}) does not match version.json ({version})")
            return False

        if version != chrome_version:
            print(f"Error: manifest.chrome.json version ({chrome_version}) does not match version.json ({version})")
            return False

        if version != firefox_version:
            print(f"Error: manifest.firefox.json version ({firefox_version}) does not match version.json ({version})")
            return False

        print(f"Version check passed (v{version}).")
        return True
    except Exception as e:
        print(f"Error during version check: {e}")
        return False

if __name__ == "__main__":
    if not check_version():
        sys.exit(1)
