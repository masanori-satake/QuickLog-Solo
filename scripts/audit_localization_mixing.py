import os
import re
import sys

# Hiragana and Katakana (always Japanese)
KANA_PATTERN = re.compile(r'[ぁ-んァ-ヶー]')
# Kanji block
KANJI_PATTERN = re.compile(r'[一-龠]')

# Keys that intentionally contain native language names or technical terms that might look like mixed language
EXCLUDED_KEYS = [
    'lang-ja',
    'lang-ja-native',
    'lang-zh',
    'lang-zh-native',
    'lang-ko',
    'lang-ko-native',
    'lang-en',
    'lang-en-native',
    'lang-de',
    'lang-de-native',
    'lang-es',
    'lang-es-native',
    'lang-fr',
    'lang-fr-native',
    'lang-pt',
    'lang-pt-native'
]

def check_line(line, is_chinese):
    """
    Checks if a line contains Japanese characters incorrectly.
    - Hiragana and Katakana are always errors in non-Japanese locales.
    - Kanji is an error in non-CJK-like locales (en, de, es, fr, pt).
    - For Korean (ko), we generally want to avoid Kanji in modern UI, but some might remain.
      However, the user specifically wanted to fix Japanese-isms.
    - For Chinese (zh), Kanji is expected, so we only check Hiragana/Katakana.
    """
    if any(key in line for key in EXCLUDED_KEYS):
        return False

    # Check for Hiragana/Katakana (always error in non-ja)
    if KANA_PATTERN.search(line):
        return True

    # Check for Kanji in Western languages
    if not is_chinese and KANJI_PATTERN.search(line):
        # We allow Kanji in Chinese.
        # For Korean, we might want to flag Kanji too as it's usually a Japanese-ism in this app's context,
        # but to avoid false positives with valid Hanja, we'll focus on western languages for now
        # or handle Korean separately if needed.
        # Given the task, western languages definitely shouldn't have Kanji.
        # Let's see if Korean should be treated as non-chinese (flag kanji).
        return True

    return False

def audit_locale_files():
    locales_dir = 'shared/js/locales/'
    errors = []
    if not os.path.exists(locales_dir):
        return errors

    for filename in os.listdir(locales_dir):
        if filename == 'ja.js' or filename == 'common.js' or not filename.endswith('.js'):
            continue

        filepath = os.path.join(locales_dir, filename)
        # Only Chinese is allowed to have Kanji.
        # For now, we flag Kanji in Korean too because in this project it's likely a Japanese-ism.
        is_chinese = (filename == 'zh.js')

        with open(filepath, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f, 1):
                if check_line(line, is_chinese):
                    errors.append(f"{filepath}:{i}: {line.strip()}")
    return errors

def audit_html_files():
    errors = []
    for filepath in ['projects/web/index.html', 'projects/web/guide.html']:
        if not os.path.exists(filepath):
            continue

        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract the translations object
        match = re.search(r'const translations = \{(.*?)\};', content, re.DOTALL)
        if not match:
            continue

        translations_text = match.group(1)
        # Split by language sections
        sections = re.split(r'(\w+): \{', translations_text)

        for i in range(1, len(sections), 2):
            lang = sections[i]
            lang_content = sections[i+1]

            if lang == 'ja':
                continue

            is_chinese = (lang == 'zh')
            lines = lang_content.split('\n')
            for line in lines:
                if check_line(line, is_chinese):
                    errors.append(f"{filepath} (section {lang}): {line.strip()}")

    return errors

def main():
    errors = audit_locale_files()
    errors.extend(audit_html_files())

    if errors:
        print("❌ Language mixing detected (Japanese characters found in non-Japanese locales):")
        for error in errors:
            print(f"  {error}")
        print("\nNote: Some language names (like '日本語') are allowed if they are in 'lang-ja' keys.")
        sys.exit(1)
    else:
        print("✅ No Japanese character mixing detected in locale files.")
        sys.exit(0)

if __name__ == "__main__":
    main()
