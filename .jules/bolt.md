# Bolt's Journal - Critical Learnings

## 2026-03-31 - Module-Level Pre-Compilation of High-Frequency Regular Expressions
**Learning:** Re-creating complex regular expressions (such as unicode emoji matching regexes containing hundreds of code points and ranges with `/gu` flags) inside utility functions causes significant CPU overhead and garbage collection pressure when processing long lists of items (e.g. report formatting or bulk log sanitization).
**Action:** Extract large, static regular expressions into top-level module constants (`EMOJI_REGEX`) so JavaScript engines compile them only once at module evaluation time.
