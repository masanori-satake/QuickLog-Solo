# QuickLog-Solo: 開発者ガイド

このドキュメントでは、QuickLog-Solo の内部構造、開発ワークフロー、および技術的な実装詳細について説明します。
設計思想や判断の背景については [spec.md](spec.md) および [AGENTS.md](../AGENTS.md) を参照してください。

## 0. 技術スタック
- **言語:** Vanilla JS (ES Modules)
- **スタイル:** CSS3 (Material 3 Design Tokens)
- **マークアップ:** HTML5
- **ブラウザ API:**
  - Chrome Extension Manifest V3 (Side Panel API)
  - Firefox Sidebar Action API
  - IndexedDB (Data Storage)
  - Web Workers (Animation logic isolation)
  - BroadcastChannel (State synchronization)

## 1. アーキテクチャ概要

本アプリは、外部ライブラリに依存しない Vanilla JS によるモジュール・アーキテクチャを採用しています。

### モジュール構成図

```mermaid
graph TD
    subgraph Browser
        SW[background.js <br/>Service Worker]
        App[app.html]
    end

    subgraph Application
        AppJS[js/app.js <br/>UI Orchestrator]
        Logic[js/logic.js <br/>Business Logic]
        DB[js/db.js <br/>Data Access Layer]
        Utils[js/utils.js <br/>Utilities]
        I18n[js/i18n.js <br/>Internationalization]
        Anim[js/animations.js <br/>Animation Engine]
    end

    subgraph Workers
        AnimWorker[js/animation_worker.js]
        AnimModules[js/animation/*.js]
    end

    App --> AppJS
    AppJS --> Logic
    AppJS --> DB
    AppJS --> Utils
    AppJS --> I18n
    AppJS --> Anim
    Logic --> DB
    Anim --> AnimWorker
    AnimWorker --> AnimModules
```

### 各モジュールの役割

-   **js/app.js (UI層):**
    -   DOM要素の取得と操作、イベントリスナーの設定。
    -   UI状態の同期（`updateUI`, `syncState`）。
    -   ユーザーへの通知（トースト、カスタム確認ダイアログ）。
    -   URLパラメータによる状態インジェクション機能（`handleTestParameters`）。
-   **js/logic.js (ロジック層):**
    -   タスクの開始・停止・一時停止の純粋な状態遷移ロジック。
    -   時間のフォーマット計算 (`formatDuration`, `formatLogDuration`)。
    -   DOMに直接触れず、テストが容易な形式で記述。
-   **js/db.js (データ層):**
    -   IndexedDB (Raw API) のカプセル化。
    -   CRUD操作、初期化、マイグレーション、クリーンアップ、自動修復。
-   **js/animations.js (描画エンジン):**
    -   Canvas 描画の統括、Web Worker (`animation_worker.js`) との通信。
-   **js/utils.js:** 共通定数、バリデーション、セキュリティ（HTMLエスケープ）。
-   **js/i18n.js / messages.js:** 多言語対応ロジックと翻訳データ。

---

## 2. 主要な振る舞い

### タスクの開始・切り替えフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant A as js/app.js
    participant L as js/logic.js
    participant D as js/db.js

    U->>A: カテゴリクリック
    A->>L: startTaskLogic(cat, activeTask)
    L->>L: stopTaskLogic(activeTask)
    L->>D: dbPut (停止時刻記録)
    L->>D: dbAdd (新規タスク開始)
    L-->>A: 新規タスクオブジェクト
    A->>A: updateUI()
    A->>A: startTimer()
```

### カテゴリのページネーション

カテゴリ数が増えた場合（17個以上）、1ページあたり16個のボタンを表示するページネーションが自動的に適用されます。
- **実装方法:** `js/app.js` 内の `currentCategoryPage` 変数で現在のページを管理。
- **操作:** `category-section` 上でのマウスホイール操作を検知し、ページを切り替え。
- **UI:** 下部に非活性なページインジケーター（ドット）を表示。

### 背景アニメーション (Canvas & Web Worker)

タスク実行中の背景アニメーションは、`js/animations.js` および Web Worker 上で実行されるモジュール群によって制御されます。
- **Web Worker:** アニメーションロジックはメインスレッドから分離された `animation_worker.js` 内で実行され、パフォーマンスの安定とセキュリティを確保します。
- **LCD スタイル:** 全てのアニメーションは 4 段階のドットサイズを持つ LCD ドットマトリクススタイルで描画されます。
- **自動遮蔽 (Exclusion Areas):** 前面のテキスト（カテゴリ名、タイマー）が隠れないよう、エンジン側で描画を回避します。
詳細な仕様は [animation_module_spec.md](animation_module_spec.md) を参照してください。

---

## 3. 設計原則と行動指針

本プロジェクトで採用している設計原則（SLAP, DRY, KISS, YAGNI, OCP）の詳細および具体的な行動指針については、[AGENTS.md](AGENTS.md) を参照してください。

---

## 4. 開発ワークフロー

### ディレクトリ構成
- `src/`: 拡張機能のソースコード一式。
  - `js/`: アプリケーションロジック。
    - `animation/`: 個別のアニメーションモジュール。
  - `css/`: アプリ用スタイルシート。
  - `assets/`: アイコン等の静的アセット。
  - `app.html`: アプリ本体のHTML。
- `index.html`: ランディングページ。
- `scripts/`: ビルドや管理用のスクリプト。
- `tests/`: テストコード。
- `docs/`: 仕様書などのドキュメント。

### バージョン管理
`npm run version:bump` コマンドにより、`src/version.json`, `package.json`, `src/manifest.*.json` を一括更新します。

### ビルドとパッケージング
`npm run build` により、以下の処理を自動実行します：
1. アニメーションレジストリ (`src/js/animation_registry.js`) の生成。
2. バージョン整合性チェック。
3. `releases/` ディレクトリへの ZIP パッケージ作成。

---

## 5. テストと品質管理

### テスト構成

-   **Jest:** テストランナー。
-   **fake-indexeddb:** Node.js 環境で IndexedDB をエミュレート。
-   **jsdom:** ブラウザ環境のエミュレート。

### 実行コマンド

```bash
# 全テストの実行
npm test

# リンターの実行
npx eslint .
npx stylelint "**/*.css"
```

### pre-commit フック

コミット時に以下のチェックが自動的に実行されます。
1.  **check-version:** `version.json`, `package.json`, およびマニフェストファイル間でのバージョン整合性チェック。
2.  **create-package:** ブラウザ別パッケージ（ZIP）の自動生成。
3.  **eslint:** JS の静的解析。
4.  **stylelint:** CSS の静的解析。
5.  **jest:** ユニットテストの実行。

---

## 6. 拡張・修正時の注意点

1.  **ドキュメントの更新:** 実装の修正や拡張を行った場合、必ず `README.md` および `README_DEV.md` を更新してください。
2.  **Vanilla JS の維持:** 新たな外部ライブラリ（npm パッケージ）の導入は、開発用ツール（devDependencies）を除き、原則禁止です。
3.  **互換性:** `js/db.js` のスキーマを変更する場合は、`setupInitialData` 内で適切なデータ移行（Migration）処理を記述してください。
4.  **定数化の徹底:** マジックナンバーや DOM ID は必ず定数化してください。

---

## 7. 関連ドキュメント

- [製品仕様書 (spec.md)](spec.md)
- [テスト計画・ケース定義書 (README_TEST.md)](README_TEST.md)
- [背景アニメーション・モジュール仕様書 (animation_module_spec.md)](animation_module_spec.md)
- [AI エージェント指針 (AGENTS.md)](../AGENTS.md)
