import json
import os

def load_scanoss_settings(filepath):
    with open(filepath, 'r') as f:
        return json.load(f)

def main():
    settings = load_scanoss_settings('scanoss.json')
    patterns = settings.get('settings', {}).get('skip', {}).get('patterns', {}).get('scanning', [])

    # SCANOSS .scanossignore format uses simple lines.
    # Convert scanoss.json patterns to .scanossignore format for consistency and maximum compatibility.
    with open('.scanossignore', 'w') as f:
        f.write("# Generated from scanoss.json - do not edit directly\n")
        for pattern in patterns:
            f.write(f"{pattern}\n")

    print(f"Sync complete. .scanossignore now has {len(patterns)} patterns.")

if __name__ == "__main__":
    main()
