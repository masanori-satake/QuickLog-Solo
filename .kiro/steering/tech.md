# QuickLog-Solo: 技術スタック・開発環境

## 言語・技術

| 分類 | 技術 |
|------|------|
| JS | **Vanilla JS (ES Modules)** — フレームワーク・ランタイム依存ライブラリは一切禁止 |
| スタイル | **CSS3 (Material Design 3 トナルパレット)** |
| マークアップ | HTML5 |
| ブラウザ API | Chrome Extension Manifest V3 (Side Panel), IndexedDB, Web Workers, BroadcastChannel, File System Access API |

## ビルドツール・スクリプト
ビルドは **npm scripts + Python スクリプト** の組み合わせで構成される。Vite は開発サーバー（E2E テスト用）のみに使用し、本番バンドルは不要。

### 主要コマンド
```bash
# ユニットテスト（Jest + jsdom + fake-indexeddb）
# generate_animation_registry.py → verify_animations.py → Jest の順で実行
npm test

# E2Eテスト（Playwright）— 事前に Vite 開発サーバー（port 8080）が必要
npm run test:e2e

# アニメーション品質評価テスト
npm run test:animation-eval

# リント（ESLint + Stylelint）
npm run lint

# フォーマット（Prettier）
npm run format

# バージョンバンプ（patch / minor）
npm run version:bump

# 拡張機能パッケージビルド（アイコン生成・レジストリ生成・バージョン確認・ZIP作成・Viteビルド）
npm run build
```

### Python / Node スクリプト（`scripts/`）

| スクリプト | 用途 |
|-----------|------|
| `bump_version.py` | `package.json` / マニフェスト等のバージョンを一括同期 |
| `generate_animation_registry.py` | アニメーションモジュールのレジストリを自動生成（`test` / `test:e2e` 前に必須） |
| `verify_animations.py` | アニメーションモジュールの整合性を検証（`test` 前に実行） |
| `animation_utils.py` | アニメーション関連スクリプト共通ユーティリティ |
| `generate_png_icons.py` | SVG から PNG アイコンを生成 |
| `create_package.py` | Chrome / Edge 用拡張機能 ZIP を作成 |
| `check_version.py` | バージョン整合性を確認 |
| `verify_version_impact.py` | CI でバージョンバンプ漏れを検出 |
| `verify_project_policies.py` | `innerHTML` 例外・`Local Only` 文言・無保証表記などのポリシーを自動検証 |
| `check_root_files.py` | ルートディレクトリへの一時スクリプト混入を検出 |
| `audit_production_dependencies.py` | プロダクション依存関係ゼロを確認 |
| `audit_localization_mixing.py` | 言語ファイルへの異言語文字混入を検出 |
| `language_check.py` | PR タイトル・説明文に日本語が含まれているか確認 |
| `generate_guide_screenshots.js` | ガイド用スクリーンショットを生成（Node.js） |
| `update_guide_images.js` | ガイド画像を更新（`npm run update-guide-images` で呼び出し） |

## テスト構成

| テストランナー | 対象 | 環境 |
|--------------|------|------|
| **Jest** | ビジネスロジック・DB・ユーティリティ・i18n（ユニット） | Node.js + jsdom + fake-indexeddb |
| **Playwright** | UI・E2E・アニメーション評価・スクリーンショット | ブラウザ（Chromium） |

- Jest 設定: `jest.config.cjs` / `jest.setup.cjs`
- Playwright 設定: `playwright.config.js`（baseURL: `http://localhost:8080/projects/app/app.html`）
- テストファイル: `tests/*.spec.js`（E2E）、`shared/js/**/*.test.js` および `projects/**/*.test.js`（ユニット）

## リント・フォーマット
- **ESLint** (`eslint.config.js`): `ecmaVersion: latest`、ES Modules、`no-unused-vars` 有効、Prettier 統合
- **Stylelint** (`stylelintrc.json`): `stylelint-config-standard`
- **Prettier** (`package.json` 内): `semi: true`, `singleQuote: true`, `tabWidth: 4`, `trailingComma: es5`, `printWidth: 120`

## CI/CD
- **GitHub Actions**: ユニットテスト・E2E・リント・OSV スキャン・ポリシーチェック・言語監査
- **pre-commit**: ローカルでの高速なポリシー・スタイルチェック（`.pre-commit-config.yaml`）
- **バージョンバンプ強制**: `projects/app/` または `shared/` への変更は CI でバージョンバンプ必須
  - 機能追加 (`feat:`) → マイナーバンプ
  - バグ修正 (`fix:`) → パッチバンプ
  - `projects/` / `shared/` 外のみの変更はバンプ不要

## パス解決ルール
- アセット参照は**常に相対パス**（先頭スラッシュなし）を使用する
- ローカル / Vercel / 拡張機能の全環境で動作させるための必須ルール

## 依存関係ポリシー
- **プロダクション依存はゼロ**（`devDependencies` のみ）
- ランタイムに `npm` パッケージを追加することは禁止
- 推移的依存関係の脆弱性を修正する場合は、`devDependencies` に明示追加する
