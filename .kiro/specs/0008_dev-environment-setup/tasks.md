# Implementation Plan: dev-environment-setup

## Overview

開発環境の前提条件を検査する Python スクリプト、README_DEV へのセットアップセクション追記、および AI 向け環境前提 Steering ファイルの 3 成果物を実装する。スクリプトは Python 標準ライブラリのみで構築し、Windows/Linux 両対応とする。

## Tasks

- [x] 1. 環境検証スクリプトの実装
  - [x] 1.1 `scripts/verify_dev_env.py` の基本構造とデータモデルを作成
    - `CheckResult` dataclass を定義（name, passed, detail, hint フィールド）
    - `format_result()` 関数を実装（✓/✗ マーカー、hint 表示）
    - `main()` 関数のスケルトンを作成（全チェック実行 → サマリー出力 → exit code 返却）
    - スクリプト全体を `try-except` で囲み、未処理例外時は exit code 2 で終了
    - 使用モジュールは標準ライブラリのみ（sys, os, subprocess, shutil, re, json, dataclasses, pathlib）
    - _Requirements: 1.6, 1.7, 1.9, 1.10_

  - [x] 1.2 `check_node()` 関数を実装
    - `node --version` を `subprocess.run` で実行（5秒タイムアウト）
    - 出力から major version を抽出し、24.x かどうか判定
    - `FileNotFoundError` → 未インストール FAIL + hint
    - バージョン不一致 → FAIL + "Expected Node.js 24.x, found {version}" hint
    - _Requirements: 1.1, 1.8, 1.11_

  - [x] 1.3 `check_python()` 関数を実装
    - Windows: `python --version` → fallback `python3 --version`
    - Linux: `python3 --version` → fallback `python --version`
    - 出力 `Python X.Y.Z` から major version 3 を検証
    - 未検出時は FAIL + hint
    - _Requirements: 1.2, 1.8, 1.11_

  - [x] 1.4 `check_node_modules()` 関数を実装
    - プロジェクトルートからの相対パスで `node_modules/` の存在を確認
    - 不在時は FAIL + "Run: npm ci" hint
    - _Requirements: 1.3, 1.8_

  - [x] 1.5 `check_playwright_chromium()` 関数を実装
    - Windows: `%LOCALAPPDATA%\ms-playwright` → fallback `node_modules/.cache/ms-playwright`
    - Linux: `~/.cache/ms-playwright` → fallback `node_modules/.cache/ms-playwright`
    - ディレクトリ内に `chromium-*` パターンのサブディレクトリが存在するか確認
    - 未検出時は FAIL + hint
    - _Requirements: 1.4, 1.8, 1.11_

  - [x] 1.6 `check_pre_commit_hooks()` 関数を実装
    - `.git/hooks/pre-commit` ファイルの存在を確認
    - ファイルが存在し、サイズが非ゼロ（trivial でない）であることを検証
    - `.git/` ディレクトリ自体が不在の場合は FAIL（SKIP 扱いではなく FAIL として報告）
    - 未検出時は FAIL + "Run: pre-commit install" hint
    - _Requirements: 1.5, 1.8_

  - [ ]* 1.7 バージョンパース関数のユニットテストを作成
    - **Property 1: Version string parsing correctness**
    - `vMajor.Minor.Patch` 形式の様々なバージョン文字列で Node.js パースロジックを検証
    - `Python Major.Minor.Patch` 形式で Python パースロジックを検証
    - 24.x → PASS、それ以外 → FAIL を確認（Node.js）
    - 3.x → PASS、それ以外 → FAIL を確認（Python）
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 1.8 出力フォーマットとexit codeのユニットテストを作成
    - **Property 2: Output marker consistency** — PASS/FAIL の組み合わせに対して ✓/✗ マーカーが正確に出力されることを検証
    - **Property 3: Exit code invariant** — 全 PASS → exit 0、いずれか FAIL → exit 1 を検証
    - **Property 4: Remediation hint presence for failures** — FAIL 項目に非空の hint が含まれることを検証
    - **Validates: Requirements 1.6, 1.7, 1.8**

- [x] 2. Checkpoint - スクリプト動作確認
  - Ensure all tests pass, ask the user if questions arise.
  - `python scripts/verify_dev_env.py` を実行して出力フォーマットと exit code を確認

- [x] 3. README_DEV へのセットアップセクション追記
  - [x] 3.1 `docs/README_DEV.md` にセットアップセクションを挿入
    - タイトル直後、Section 0「技術スタック」の直前に「開発環境セットアップ」セクションを配置
    - 前提ソフトウェア一覧: Node.js 24, Python 3.x, pre-commit
    - サポート環境: Windows (PowerShell), Linux/Ubuntu (CI)
    - 初回セットアップ手順: `npm ci`, `npx playwright install --with-deps chromium`, `pre-commit install`
    - 環境確認コマンド: `python scripts/verify_dev_env.py`
    - 補足: `generate_png_icons.py` は Python 版 Playwright (requirements.txt) が必要
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 4. AI 向け Steering ファイルの作成
  - [x] 4.1 `.kiro/steering/dev-env.md` を作成
    - YAML frontmatter に `inclusion: auto` を設定
    - Prerequisites: Node.js 24, Python 3.x とそれぞれの役割を記載
    - Setup Commands: `npm ci`, `npx playwright install --with-deps chromium`, `pre-commit install`
    - Development Commands: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`, `npm run dev`
    - `npm run dev` が Vite 開発サーバー (port 8080) を起動し E2E テスト前に必要な旨を記載
    - `generate_animation_registry.py` は `npm test` / `npm run test:e2e` で自動実行される旨を記載
    - 環境検証コマンド `python scripts/verify_dev_env.py` を記載
    - 80行以内に収める
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 5. Final checkpoint - 全体確認
  - Ensure all tests pass, ask the user if questions arise.
  - `python scripts/verify_dev_env.py` が正常に動作することを確認
  - README_DEV に「開発環境セットアップ」セクションが正しい位置に挿入されていることを確認
  - `.kiro/steering/dev-env.md` が 80行以内であることを確認
  - `python scripts/check_root_files.py` でルートディレクトリのクリーンネスを確認

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 実装言語は Python（標準ライブラリのみ）。Vanilla JS プロジェクトだがスクリプトは既存の `scripts/` パターンに従い Python で記述
- `scripts/verify_dev_env.py` は既存の `.gitignore` ルール (`!scripts/verify_*.py`) により Git 追跡対象となる
- Property tests validate version parsing logic and output formatting invariants
- バージョンバンプは `projects/app/` や `shared/` への変更ではないため不要

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["1.7", "1.8", "3.1", "4.1"] },
    { "id": 3, "tasks": [] }
  ]
}
```
