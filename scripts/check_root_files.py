import os
import sys

# List of allowed files and directories in the root directory
ALLOWED_ROOT_ITEMS = {
    ".git",
    ".github",
    ".gitignore",
    ".pre-commit-config.yaml",
    ".stylelintignore",
    ".stylelintrc.json",
    "AGENTS.md",
    "LICENSE",
    "README.md",
    "SECURITY.md",
    "docs",
    "eslint.config.js",
    "google600c7e741a07d031.html",
    "guide.html",
    "index.html",
    "studio.html",
    "category-editor.html",
    "jest.config.cjs",
    "jest.setup.js",
    "package-lock.json",
    "package.json",
    "playwright.config.js",
    "scripts",
    "src",
    "tests",
    "vercel.json",
    "node_modules", # Included for local dev convenience, though CI might not have it when this runs
}

def check_root_directory():
    found_unauthorized = False
    root_items = os.listdir(".")

    for item in root_items:
        if item not in ALLOWED_ROOT_ITEMS:
            # Check if it's a file that matches the temporary script pattern (additional safety)
            # or any other unauthorized file.
            print(f"Error: Unauthorized item found in root directory: {item}")
            found_unauthorized = True

    if found_unauthorized:
        print("\nCleanup is required. Please remove unauthorized files from the root directory.")
        sys.exit(1)
    else:
        print("Root directory check passed.")

if __name__ == "__main__":
    check_root_directory()
