#!/usr/bin/env python3
import sys
import re
import argparse

def has_japanese(text):
    # Regex to detect at least one Japanese character:
    # Hiragana: \u3040-\u309F
    # Katakana: \u30A0-\u30FF
    # Kanji: \u4E00-\u9FFF
    # Full-width punctuation/symbols: \u3000-\u303F
    pattern = re.compile(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3000-\u303F]')
    return bool(pattern.search(text))

def main():
    parser = argparse.ArgumentParser(description='Verify if the input text contains Japanese characters.')
    parser.add_argument('text', nargs='?', help='The text to verify. If omitted, it reads from stdin.')
    parser.add_argument('--commit-msg-file', help='Path to a file containing the commit message (for pre-commit hooks).')

    args = parser.parse_args()

    if args.commit_msg_file:
        try:
            with open(args.commit_msg_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading file {args.commit_msg_file}: {e}")
            sys.exit(1)
    elif args.text:
        content = args.text
    else:
        # Read from stdin if no arguments provided
        content = sys.stdin.read()

    if not content.strip():
        # Empty input is considered invalid for this purpose
        print("Error: Input text is empty.")
        sys.exit(1)

    # Conventional Commits handling: ignore the prefix (e.g., 'feat: ') when checking for Japanese
    # But for simplicity, we just check if the WHOLE message contains Japanese.
    # Usually 'feat: ' is fine as long as the rest is Japanese.

    if not has_japanese(content):
        print("Error: The message must contain Japanese characters (Hiragana, Katakana, or Kanji).")
        print(f"Input text: {content.strip()}")
        sys.exit(1)

    print("Success: Japanese characters detected.")
    sys.exit(0)

if __name__ == "__main__":
    main()
