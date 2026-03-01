import subprocess
import json
import re
import os
import sys
import argparse

def get_last_version_commit():
    try:
        # Get the hash of the last commit that modified src/version.json
        cmd = ["git", "log", "-1", "--format=%H", "src/version.json"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None

def get_commits_since(commit_hash):
    if not commit_hash:
        # If no last commit (initial), get all commits
        cmd = ["git", "log", "--format=%s"]
    else:
        cmd = ["git", "log", f"{commit_hash}..HEAD", "--format=%s"]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        lines = result.stdout.strip().split('\n')
        return [l for l in lines if l.strip()]
    except subprocess.CalledProcessError:
        return []

def determine_bump_type(commits):
    bump = "patch"
    found_any = False

    for msg in commits:
        found_any = True
        # Check for breaking change: "feat!:", "fix!:", or "BREAKING CHANGE" in body/footer
        # Here we only check the subject line as per get_commits_since format %s
        if "BREAKING CHANGE" in msg or re.match(r'^\w+!:', msg):
            return "major"
        if msg.startswith("feat"):
            bump = "minor"

    if not found_any:
        return None

    return bump

def bump_version(current_version, bump_type):
    major, minor, patch = map(int, current_version.split('.'))
    if bump_type == "major":
        return f"{major + 1}.0.0"
    elif bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    elif bump_type == "patch":
        return f"{major}.{minor}.{patch + 1}"
    return current_version

def update_file(filepath, new_version):
    with open(filepath, 'r') as f:
        data = json.load(f)
    data['version'] = new_version
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print the new version without updating files")
    parser.add_argument("--type", choices=["major", "minor", "patch"], help="Force a specific bump type")
    args = parser.parse_args()

    last_commit = get_last_version_commit()
    commits = get_commits_since(last_commit)

    if args.type:
        bump_type = args.type
    elif not commits:
        print("No new commits found since last version update.")
        return
    else:
        bump_type = determine_bump_type(commits)

    if not bump_type:
        print("No relevant changes found for version bump.")
        return

    try:
        with open('src/version.json', 'r') as f:
            current_version = json.load(f).get('version')
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error reading or parsing src/version.json: {e}")
        sys.exit(1)

    new_version = bump_version(current_version, bump_type)

    if args.dry_run:
        print(f"Bumping version from {current_version} to {new_version} ({bump_type}) (DRY RUN)")
        return

    print(f"Bumping version from {current_version} to {new_version} ({bump_type})")

    files_to_update = [
        'package.json',
        'src/version.json',
        'src/manifest.chrome.json',
        'src/manifest.firefox.json'
    ]

    for filepath in files_to_update:
        if os.path.exists(filepath):
            update_file(filepath, new_version)
            print(f"Updated {filepath}")
        else:
            print(f"Warning: {filepath} not found.")

if __name__ == "__main__":
    main()
