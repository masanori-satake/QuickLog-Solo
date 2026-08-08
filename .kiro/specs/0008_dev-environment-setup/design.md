# Design Document

## Introduction

本設計書は、QuickLog-Solo プロジェクトにおける開発環境セットアップ支援の 3 成果物（環境検証スクリプト、README_DEV セットアップセクション、AI 向け Steering ファイル）のアーキテクチャおよびインターフェースを定義する。

## Architecture Overview

本機能は 3 つの独立した成果物で構成される。それぞれが異なる対象（開発者の手動確認、ドキュメント読者、AI エージェント）に環境情報を提供する。

```
┌────────────────────────────────────────────────┐
│               Developer / AI Agent             │
└───────┬────────────────┬──────────────┬────────┘
        │                │              │
        ▼                ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│verify_dev_env│ │ README_DEV   │ │ .kiro/steering/  │
│   .py        │ │ Setup Section│ │ dev-env.md       │
│ (Executable) │ │ (Document)   │ │ (AI Context)     │
└──────────────┘ └──────────────┘ └──────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────┐
│            System Environment                     │
│  Node.js 24 | Python 3.x | node_modules |        │
│  Playwright Chromium | pre-commit hooks           │
└──────────────────────────────────────────────────┘
```

## Component Design

### Component 1: `scripts/verify_dev_env.py`

#### 責務

開発環境の前提条件を検査し、各項目の PASS/FAIL を標準出力に報告する。自動修復は一切行わない。

#### 内部構造

```python
# Module structure (Python standard library only)
import sys
import os
import subprocess
import shutil
import re
import json

class CheckResult:
    """Individual check result."""
    name: str        # Check item display name
    passed: bool     # Whether the check passed
    detail: str      # Version info or status detail
    hint: str        # Remediation hint (empty if passed)

def check_node() -> CheckResult:
    """Check Node.js 24.x availability via `node --version`."""

def check_python() -> CheckResult:
    """Check Python 3.x availability via `python --version` or `python3 --version`."""

def check_node_modules() -> CheckResult:
    """Check existence of `node_modules/` directory relative to project root."""

def check_playwright_chromium() -> CheckResult:
    """Check Playwright Chromium browser binary existence."""

def check_pre_commit_hooks() -> CheckResult:
    """Check `.git/hooks/pre-commit` file existence and non-triviality."""

def format_result(result: CheckResult) -> str:
    """Format a single result with ✓/✗ marker and optional hint."""

def main() -> int:
    """Run all checks, print summary, return exit code."""
```

#### クロスプラットフォーム戦略

| 項目 | Windows (PowerShell) | Linux (Ubuntu) |
|------|---------------------|----------------|
| Node.js 検出 | `node --version` (PATH) | 同左 |
| Python 検出 | `python --version` → fallback `python3 --version` | `python3 --version` → fallback `python --version` |
| Playwright Chromium パス | `%LOCALAPPDATA%\ms-playwright` or `node_modules/.cache/ms-playwright` | `~/.cache/ms-playwright` or `node_modules/.cache/ms-playwright` |
| pre-commit hooks | `.git/hooks/pre-commit` (ファイル存在) | 同左 |
| パス区切り | `os.path` により自動処理 | 同左 |

#### 出力フォーマット

```
=== QuickLog-Solo 開発環境チェック ===

✓ Node.js        : v24.1.0
✓ Python         : 3.12.4
✓ node_modules   : installed
✗ Playwright     : not found
  → Hint: Run `npx playwright install --with-deps chromium`
✓ pre-commit     : hooks installed

--- Result: 4/5 passed (FAIL) ---
```

#### 終了コード

- `0`: 全チェック PASS
- `1`: 1 つ以上の FAIL あり

#### エラーハンドリング

- `subprocess.run` の `FileNotFoundError` は当該ツール未インストールとして FAIL 報告
- `subprocess.run` の `TimeoutExpired`（5秒タイムアウト）は「応答なし」として FAIL 報告
- ファイルシステムの `PermissionError` は警告付き FAIL 報告
- 例外はスクリプト自体のクラッシュとせず、必ず CheckResult として処理する

#### Remediation Hints

| チェック項目 | Hint メッセージ |
|-------------|----------------|
| Node.js 未検出 | `Install Node.js 24: https://nodejs.org/` |
| Node.js バージョン不一致 | `Expected Node.js 24.x, found {version}. Use nvm to switch.` |
| Python 未検出 | `Install Python 3.x: https://www.python.org/downloads/` |
| node_modules 未存在 | `Run: npm ci` |
| Playwright Chromium 未検出 | `Run: npx playwright install --with-deps chromium` |
| pre-commit hooks 未存在 | `Run: pre-commit install` |

### Component 2: README_DEV セットアップセクション

#### 配置

`docs/README_DEV.md` の先頭（タイトル・導入文の直後、既存 Section 0「技術スタック」の直前）にセクションを挿入する。

#### 構造

```markdown
## 開発環境セットアップ

### 前提ソフトウェア
- Node.js 24 (LTS)
- Python 3.x
- pre-commit

### サポート環境
- Windows (PowerShell)
- Linux / Ubuntu (CI)

### 初回セットアップ手順
1. `npm ci`
2. `npx playwright install --with-deps chromium`
3. `pre-commit install`
4. (Optional) `pip install -r requirements.txt` — PNG アイコン生成用

### 環境確認
python scripts/verify_dev_env.py

### 補足
- `generate_png_icons.py` は Python 版 Playwright (`requirements.txt`) を使用...
```

### Component 3: `.kiro/steering/dev-env.md`

#### フォーマット

```markdown
---
inclusion: auto
---
# Dev Environment

## Prerequisites
- Node.js 24 — JS test runner (Jest), linting, build
- Python 3.x — verification scripts, animation registry generation

## Setup Commands
...

## Development Commands
...

## Notes
...
```

#### 設計制約

- 80行以内（context window 節約）
- YAML frontmatter に `inclusion: auto` を含める
- 具体的なバージョン番号とコマンドのみ記載（説明は最小限）

## Data Models

本機能にはデータベース変更や永続データモデルの追加は不要。スクリプトが扱うのは一時的な `CheckResult` 構造のみ。

```python
@dataclass
class CheckResult:
    name: str       # "Node.js", "Python", "node_modules", "Playwright", "pre-commit"
    passed: bool    # True = PASS, False = FAIL
    detail: str     # "v24.1.0", "installed", "not found" etc.
    hint: str       # Empty string if passed, remediation text if failed
```

## Error Handling

| エラー状況 | 処理方針 |
|-----------|---------|
| コマンド未検出 (`FileNotFoundError`) | 当該チェックを FAIL とし、hint を表示 |
| コマンドタイムアウト (5秒) | FAIL + "Command timed out" |
| パーミッション拒否 | FAIL + 権限に関する hint |
| `.git/` ディレクトリ不在 | pre-commit チェックを SKIP (PASS扱いはしない) |
| スクリプト自体の未処理例外 | `try-except` で捕捉し exit code 2 で終了 |

## Testing Strategy

本機能のテストは以下の方針で行う:

- **verify_dev_env.py**: 各チェック関数は `subprocess.run` の結果に基づく純粋なロジックに近い関数として設計し、ユニットテスト可能にする。ただし、実際のシステム状態に依存するため、プロパティテストよりもモック付きユニットテスト + 実環境での手動実行確認が適切。
- **README_DEV / Steering File**: 既存の `verify_project_policies.py` パターンに倣い、必要に応じて内容検証スクリプトで特定の文言の存在を確認できる。

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

**Requirement 1:**

1.1. THE Verify_Script SHALL check the availability of Node_Runtime (version 24.x) and report the installed version or absence.
  - Thoughts: This checks a specific external tool. The behavior varies with the system state (version present or not). We can test the parsing logic: given any valid `node --version` output string matching `vXX.Y.Z`, the script should correctly extract the major version and compare with 24.
  - Classification: PROPERTY
  - Test Strategy: Generate random version strings in `vMajor.Minor.Patch` format, verify the version-parsing logic correctly identifies 24.x as PASS and others as FAIL.

1.2. THE Verify_Script SHALL check the availability of Python_Runtime (version 3.x) and report the installed version or absence.
  - Thoughts: Same as 1.1 but for Python. The parsing logic extracts major version from `Python X.Y.Z` output.
  - Classification: PROPERTY
  - Test Strategy: Generate random Python version strings, verify parsing logic correctly identifies 3.x as PASS.

1.3. THE Verify_Script SHALL check whether `node_modules` directory exists and report the result.
  - Thoughts: This is a simple existence check. No input variation — either the directory exists or it doesn't.
  - Classification: EXAMPLE
  - Test Strategy: Mock filesystem to test both presence and absence cases.

1.4. THE Verify_Script SHALL check whether Playwright_Browser (Chromium) is installed and report the result.
  - Thoughts: This checks for browser binaries in known paths. Platform-dependent logic but binary exist/not-exist outcome.
  - Classification: EXAMPLE
  - Test Strategy: Mock filesystem paths for both platforms, verify correct detection.

1.5. THE Verify_Script SHALL check whether Pre_Commit hooks are installed and report the result.
  - Thoughts: Checks `.git/hooks/pre-commit` file existence. Simple binary outcome.
  - Classification: EXAMPLE
  - Test Strategy: Mock `.git/hooks/` directory contents for both cases.

1.6. THE Verify_Script SHALL output a summary indicating PASS or FAIL for each checked item, using clearly distinguishable markers.
  - Thoughts: For any set of CheckResults, the output format should contain the appropriate marker for each. We can generate random combinations of pass/fail results and verify the output contains the correct markers.
  - Classification: PROPERTY
  - Test Strategy: Generate random combinations of PASS/FAIL results, verify output format contains ✓ for PASS and ✗ for FAIL exactly matching the input.

1.7. THE Verify_Script SHALL exit with code 0 when all checks pass and exit with a non-zero code when any check fails.
  - Thoughts: This is a universal property: for any combination of check results, exit code = 0 iff all passed.
  - Classification: PROPERTY
  - Test Strategy: Generate random lists of CheckResults with varying pass/fail combinations, verify exit code invariant.

1.8. IF a checked dependency is missing, THEN THE Verify_Script SHALL display a remediation hint.
  - Thoughts: For any CheckResult where passed=False, the output must contain a non-empty hint string. Universal over all failing checks.
  - Classification: PROPERTY
  - Test Strategy: For any failing CheckResult, verify the formatted output contains a hint line.

1.9. THE Verify_Script SHALL NOT perform any automatic installation, modification, or repair action.
  - Thoughts: This is a design constraint, not a dynamically testable property. We can verify via static analysis that no `subprocess` calls with install/write operations exist.
  - Classification: SMOKE
  - Test Strategy: Static analysis / code review. Verify no write/install subprocess commands.

1.10. THE Verify_Script SHALL use only Python standard library modules.
  - Thoughts: Static check — parse imports and verify against allowed list.
  - Classification: SMOKE
  - Test Strategy: Parse script imports, verify all are in {sys, os, subprocess, shutil, re, json, dataclasses, pathlib}.

1.11. THE Verify_Script SHALL function correctly on both Windows and Linux.
  - Thoughts: This is an integration-level requirement verified by running on both platforms (CI does Linux, local does Windows).
  - Classification: INTEGRATION
  - Test Strategy: Run on both OS environments and verify identical logic behavior.

**Requirement 2:**

2.1. THE README_DEV SHALL contain a "開発環境セットアップ" section positioned before "技術スタック".
  - Thoughts: This is a static content check — parse the markdown and verify section order.
  - Classification: EXAMPLE
  - Test Strategy: Parse README_DEV headings, verify "開発環境セットアップ" appears before "技術スタック".

2.2-2.6: Content requirements for the setup section.
  - Thoughts: These are static content presence checks in a documentation file.
  - Classification: EXAMPLE
  - Test Strategy: Verify specific required text/commands appear in the section.

**Requirement 3:**

3.1-3.6: Content requirements for the steering file.
  - Thoughts: Static content presence checks.
  - Classification: EXAMPLE
  - Test Strategy: Verify specific text exists in the file.

3.7. THE Steering_File SHALL use `inclusion: auto` in its frontmatter.
  - Thoughts: Static check of file header.
  - Classification: EXAMPLE
  - Test Strategy: Parse frontmatter, verify `inclusion: auto` is present.

3.8. THE Steering_File SHALL be concise (targeting under 80 lines).
  - Thoughts: Simple line count check.
  - Classification: EXAMPLE
  - Test Strategy: Count lines in file, verify < 80.

**Requirement 4:**

4.1-4.4: File placement and policy checks.
  - Thoughts: Static filesystem checks. Verified by existing CI scripts.
  - Classification: SMOKE
  - Test Strategy: Verify file locations match expectations; run `check_root_files.py`.

### Property Reflection

Reviewing identified properties:
- 1.1 (Node version parsing) and 1.2 (Python version parsing) — These test the same pattern (version string parsing → major version comparison). They can be **combined** into a single property about version parsing correctness.
- 1.6 (output markers) and 1.8 (hint for failures) — 1.6 tests that output contains correct markers for any result set, while 1.8 tests that failing items include hints. These are distinct concerns (formatting vs. content) and should remain separate.
- 1.7 (exit code) — Unique invariant about the aggregate result. Keep separate.

After reflection:
- **Combine** 1.1 and 1.2 into a single "version parsing" property
- **Keep** 1.6, 1.7, 1.8 as separate properties (distinct invariants)

### Property 1: Version string parsing correctness

*For any* version output string in the format `vMajor.Minor.Patch` (Node.js) or `Python Major.Minor.Patch`, the version-parsing logic SHALL correctly extract the major version number, and the check SHALL pass if and only if the major version matches the expected value (24 for Node.js, 3 for Python).

**Validates: Requirements 1.1, 1.2**

### Property 2: Output marker consistency

*For any* list of CheckResults (each being PASS or FAIL), the formatted output SHALL contain exactly one ✓ marker for each PASS result and exactly one ✗ marker for each FAIL result, with the total marker count equal to the number of checks.

**Validates: Requirements 1.6**

### Property 3: Exit code invariant

*For any* list of CheckResults, the script's exit code SHALL be 0 if and only if every CheckResult in the list has `passed = True`. If any CheckResult has `passed = False`, the exit code SHALL be non-zero.

**Validates: Requirements 1.7**

### Property 4: Remediation hint presence for failures

*For any* CheckResult where `passed = False`, the formatted output for that item SHALL include a non-empty remediation hint string that provides actionable guidance for resolving the failure.

**Validates: Requirements 1.8**
