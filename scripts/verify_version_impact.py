import subprocess
import json
import re
import sys
import os

def get_base_commit():
    # In CI, we usually want to compare against the base branch (e.g. origin/main)
    # If not in CI, compare with the last commit that modified projects/app/version.json
    try:
        # Check if we are in a GitHub Action
        if os.getenv('GITHUB_EVENT_NAME') == 'pull_request':
            # For PRs, compare against the base branch
            base_ref = os.getenv('GITHUB_BASE_REF')
            if base_ref:
                return f"origin/{base_ref}"

        # Fallback: get the last version commit
        cmd = ["git", "log", "-1", "--format=%H", "projects/app/version.json"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None

def get_commits_since(commit_hash, paths=None):
    if not commit_hash:
        return []

    cmd = ["git", "log", f"{commit_hash}..HEAD", "--format=%B", "-z"]
    if paths:
        cmd.append("--")
        cmd.extend(paths)

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        commits = result.stdout.split('\0')
        return [c.strip() for c in commits if c.strip()]
    except subprocess.CalledProcessError:
        # If the commit_hash is not reachable (e.g. shallow clone or different branch history)
        # try to get commits since the common ancestor
        try:
            cmd_merge_base = ["git", "merge-base", commit_hash, "HEAD"]
            res_mb = subprocess.run(cmd_merge_base, capture_output=True, text=True, check=True)
            mb = res_mb.stdout.strip()
            cmd = ["git", "log", f"{mb}..HEAD", "--format=%B", "-z"]
            if paths:
                cmd.append("--")
                cmd.extend(paths)
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            commits = result.stdout.split('\0')
            return [c.strip() for c in commits if c.strip()]
        except:
            return []

def get_version_from_file(filepath):
    try:
        with open(filepath, 'r') as f:
            return json.load(f).get('version')
    except:
        return None

def get_version_at_commit(filepath, commit_hash):
    try:
        cmd = ["git", "show", f"{commit_hash}:{filepath}"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(result.stdout).get('version')
    except:
        return None

def has_staged_impactful_changes():
    # Check if any impactful files are staged (excluding shared/js/locales/)
    try:
        cmd = ["git", "diff", "--cached", "--name-only"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        files = result.stdout.splitlines()
        for f in files:
            if (f.startswith("projects/app/") or f.startswith("shared/")) and not f.startswith("shared/js/locales/"):
                return True
    except Exception:
        pass
    return False

def determine_required_bump(commits):
    bump = None
    for body in commits:
        # Check for Major bump (Breaking Change)
        if "BREAKING CHANGE" in body or re.search(r'^[a-zA-Z]+!:', body, re.MULTILINE):
            return "major"

        # Check for Minor bump (New Feature)
        if re.search(r'^feat(\(.*\))?:', body, re.MULTILINE) or "新規機能" in body or "機能追加" in body:
            if bump != "major":
                bump = "minor"

        # Check for Patch bump (Fix or other changes that are not just metadata)
        elif bump is None:
            # Explicit fix
            if re.search(r'^fix(\(.*\))?:', body, re.MULTILINE) or "修正" in body or "バグ" in body:
                bump = "patch"
            # If impactful files are touched and it's not a known non-bumping type, assume patch
            elif not re.search(r'^(chore|test|docs|style|refactor|perf|ci)(\(.*\))?:', body, re.MULTILINE):
                bump = "patch"

    return bump

def check_impact():
    base_commit = get_base_commit()
    print(f"Comparing against base commit: {base_commit}")

    # Only consider commits that touch app-related files.
    # We exclude shared/js/locales/ because localization changes do not require a version bump for the Chrome extension.
    # projects/alarm-editor/ and other sub-projects are also implicitly excluded as they are not in projects/app/.
    impactful_paths = ["projects/app/", "shared/", ":(exclude)shared/js/locales/"]
    commits = get_commits_since(base_commit, impactful_paths)
    required_bump = determine_required_bump(commits)

    # If there are staged impactful changes, we default the required_bump to "patch" if it's not already set
    if has_staged_impactful_changes() and not required_bump:
        required_bump = "patch"

    if not required_bump:
        print("No feature or fix commits detected. Version bump may not be required.")
        return True

    current_version = get_version_from_file('projects/app/version.json')
    base_version = get_version_at_commit('projects/app/version.json', base_commit)

    if not base_version:
        print("Could not determine base version. Skipping impact check.")
        return True

    print(f"Base version: {base_version}")
    print(f"Current version: {current_version}")
    print(f"Required bump detected: {required_bump}")

    b_major, b_minor, b_patch = map(int, base_version.split('.'))
    c_major, c_minor, c_patch = map(int, current_version.split('.'))

    is_bumped = False
    if required_bump == "major":
        is_bumped = (c_major > b_major)
    elif required_bump == "minor":
        is_bumped = (c_major > b_major or (c_major == b_major and c_minor > b_minor))
    elif required_bump == "patch":
        is_bumped = (c_major > b_major or (c_major == b_major and c_minor > b_minor) or (c_major == b_major and c_minor == b_minor and c_patch > b_patch))

    if not is_bumped:
        is_ci = os.getenv('GITHUB_ACTIONS') == 'true' or os.getenv('CI') == 'true'
        if not is_ci:
            print(f"Version bump required ({required_bump}). Automatically running bump_version.py...")
            try:
                cmd = [sys.executable, "scripts/bump_version.py", "--type", required_bump]
                subprocess.run(cmd, check=True)
                new_version = get_version_from_file('projects/app/version.json')
                print(f"\n[SUCCESS] Version has been automatically bumped from {current_version} to {new_version} ({required_bump}).")
                print("Please stage the modified files (git add) and commit again.")
            except Exception as e:
                print(f"Error automatically bumping version: {e}")
            sys.exit(1)
        else:
            if required_bump == "major":
                print("Error: A BREAKING CHANGE was detected, but the Major version was not bumped.")
            elif required_bump == "minor":
                print("Error: A new feature (feat) was detected, but the Minor version was not bumped.")
            elif required_bump == "patch":
                print("Error: A fix was detected, but the version was not bumped.")
            return False

    return True

if __name__ == "__main__":
    if not check_impact():
        sys.exit(1)
    print("Version impact verification passed.")
