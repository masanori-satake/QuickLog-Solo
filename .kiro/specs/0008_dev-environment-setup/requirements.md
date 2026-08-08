# Requirements Document

## Introduction

QuickLog-Solo プロジェクトにおいて、AI エージェント（Kiro）がタスク実行時に開発環境の前提条件を即座に把握し、環境未整備による無駄な探索・失敗を排除するための仕組みを構築する。具体的には、環境検証スクリプト、開発者向けセットアップドキュメント、および AI 向け環境前提ファイルの 3 成果物を提供する。

## Glossary

- **Verify_Script**: `scripts/verify_dev_env.py` — 開発環境の前提条件を検査し、結果を標準出力に報告する Python スクリプト。自動修復・自動インストールは行わない。
- **README_DEV**: `docs/README_DEV.md` — 開発者向けガイドドキュメント。セットアップ手順を含む。
- **Steering_File**: `.kiro/steering/dev-env.md` — AI エージェントがセッション開始時に参照する環境前提ファイル。
- **Developer**: QuickLog-Solo の開発に参加する人間の開発者。
- **AI_Agent**: Kiro 等の AI エージェントで、Spec に基づくタスク実行を行うもの。
- **Node_Runtime**: Node.js v24 ランタイム環境。
- **Python_Runtime**: Python 3.x ランタイム環境。
- **Playwright_Browser**: Playwright が管理する Chromium ブラウザバイナリ。
- **Pre_Commit**: pre-commit フレームワークによる Git フック。

## Requirements

### Requirement 1: 環境検証スクリプトの提供

**User Story:** As a Developer, I want a single command that checks whether all development prerequisites are met, so that I can quickly identify and fix missing dependencies before starting work.

#### Acceptance Criteria

1. THE Verify_Script SHALL check the availability of Node_Runtime (version 24.x) and report the installed version or absence.
2. THE Verify_Script SHALL check the availability of Python_Runtime (version 3.x) and report the installed version or absence.
3. THE Verify_Script SHALL check whether `node_modules` directory exists (indicating `npm ci` has been run) and report the result.
4. THE Verify_Script SHALL check whether Playwright_Browser (Chromium) is installed and report the result.
5. THE Verify_Script SHALL check whether Pre_Commit hooks are installed in the local `.git/hooks` directory and report the result.
6. THE Verify_Script SHALL output a summary indicating PASS or FAIL for each checked item, using clearly distinguishable markers (e.g., checkmark or cross symbols).
7. THE Verify_Script SHALL exit with code 0 when all checks pass and exit with a non-zero code when any check fails.
8. IF a checked dependency is missing or has an incompatible version, THEN THE Verify_Script SHALL display a human-readable remediation hint for that specific item.
9. THE Verify_Script SHALL NOT perform any automatic installation, modification, or repair action.
10. THE Verify_Script SHALL use only Python standard library modules (sys, os, subprocess, shutil, re, json) and require no additional pip packages.
11. THE Verify_Script SHALL function correctly on both Windows (PowerShell) and Linux (Ubuntu CI) environments.

### Requirement 2: README_DEV へのセットアップセクション追記

**User Story:** As a Developer, I want a clear setup section at the top of README_DEV.md, so that I can set up the development environment from scratch without guesswork.

#### Acceptance Criteria

1. THE README_DEV SHALL contain a "開発環境セットアップ" section positioned before the existing "技術スタック" section (Section 0).
2. THE README_DEV setup section SHALL list all prerequisite software and their required versions (Node.js 24, Python 3.x, pre-commit).
3. THE README_DEV setup section SHALL provide step-by-step commands for initial environment setup: `npm ci`, `npx playwright install --with-deps chromium`, and `pre-commit install`.
4. THE README_DEV setup section SHALL document the `python scripts/verify_dev_env.py` command as a verification step to confirm environment readiness.
5. THE README_DEV setup section SHALL note that `generate_png_icons.py` requires the Python `playwright` package (specified in requirements.txt) separately from the Node.js Playwright.
6. THE README_DEV setup section SHALL mention both supported development OS environments (Windows with PowerShell, Linux/Ubuntu for CI).

### Requirement 3: AI 向け環境前提ファイルの提供

**User Story:** As an AI_Agent, I want a concise steering file that declares the verified environment prerequisites and key commands, so that I can skip redundant environment discovery at the start of every session.

#### Acceptance Criteria

1. THE Steering_File SHALL declare the expected Node.js version (24), Python version (3.x), and their roles in the project.
2. THE Steering_File SHALL list the essential setup commands (`npm ci`, `npx playwright install --with-deps chromium`, `pre-commit install`).
3. THE Steering_File SHALL list the primary development commands (`npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`, `npm run dev`).
4. THE Steering_File SHALL specify that `npm run dev` starts a Vite development server on port 8080 and is required before E2E tests.
5. THE Steering_File SHALL note that `python scripts/generate_animation_registry.py` is automatically executed as part of `npm test` and `npm run test:e2e` and does not need separate invocation.
6. THE Steering_File SHALL specify the verification command (`python scripts/verify_dev_env.py`) for confirming environment readiness.
7. THE Steering_File SHALL use `inclusion: auto` in its frontmatter so that it is automatically loaded into AI agent context at session start.
8. THE Steering_File SHALL be concise (targeting under 80 lines) to minimize context window consumption.

### Requirement 4: スクリプト配置とプロジェクトポリシー準拠

**User Story:** As a Developer, I want the new script to follow existing project conventions, so that CI checks pass and the project remains consistent.

#### Acceptance Criteria

1. THE Verify_Script SHALL be located at `scripts/verify_dev_env.py` within the project repository.
2. THE Verify_Script SHALL be tracked by Git, leveraging the existing `.gitignore` exception rule (`!scripts/verify_*.py`) that permits `verify_` prefixed scripts within the `scripts/` directory.
3. WHEN `scripts/check_root_files.py` is executed, THE project root SHALL NOT contain the Verify_Script or any temporary copy of it.
4. THE Steering_File SHALL be located at `.kiro/steering/dev-env.md`.
