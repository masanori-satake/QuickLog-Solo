import json
import re
import sys

def check_version():
    try:
        with open('version.json', 'r') as f:
            v_data = json.load(f)
            version = v_data.get('version')

        with open('app.js', 'r') as f:
            app_js = f.read()

        with open('sw.js', 'r') as f:
            sw_js = f.read()

        # Check sw.js
        if f"quicklog-solo-v{version}" not in sw_js:
            print(f"Error: sw.js CACHE_NAME does not match version {version}")
            return False

        print(f"Version check passed (v{version}).")
        return True
    except Exception as e:
        print(f"Error during version check: {e}")
        return False

if __name__ == "__main__":
    if not check_version():
        sys.exit(1)
