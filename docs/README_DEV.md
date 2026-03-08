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
        Backup[js/backup.js <br/>File Backup]
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
    AppJS --> Backup
    Logic --> DB
    Backup --> DB
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
    -   タスクの開始・終了・一時停止の純粋な状態遷移ロジック。
    -   時間のフォーマット計算 (`formatDuration`, `formatLogDuration`)。
    -   DOMに直接触れず、テストが容易な形式で記述。
-   **js/db.js (データ層):**
    -   IndexedDB (Raw API) のカプセル化。
    -   CRUD操作、初期化、マイグレーション、クリーンアップ、自動修復。
-   **js/animations.js (描画エンジン):**
    -   Canvas 描画の統括、Web Worker (`animation_worker.js`) との通信。
-   **js/backup.js (バックアップ層):**
    -   File System Access API を使用したローカルファイルへの同期。
    -   日付ごとの NDJSON 形式での履歴保存。
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
    L->>D: dbPut (終了時刻記録)
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

### ローカルファイルバックアップ

ブラウザのキャッシュクリア等によるデータ消失を防ぐため、File System Access API を利用してローカルディレクトリにデータを同期します。

#### 同期メカズム
- **形式:** NDJSON (Newline Delimited JSON)。1行1レコードの形式で、一部が破損しても他の行への影響を最小限に抑えます。
- **ファイル分割:** 履歴（ログ）は `YYYY-MM-DD.ndjson` の形式で、1日1ファイルに分割されます。カテゴリと設定はそれぞれ `categories.ndjson`, `settings.ndjson` に保存されます。
- **同期のタイミング:**
    - **即時 (Immediate):** データ更新を検知すると「Dirty（未保存）」状態となり、2秒後に自動的に同期が実行されます。
    - **5分 / 1時間:** 設定された間隔で定期実行されます。
- **双方向の統合 (Merge):**
    - 同期実行時、まずファイル側の内容を IndexedDB に読み込み、IndexedDB に存在しないデータのみを追加します。
    - その後、IndexedDB の最新状態をファイルに書き出します。
- **40日間保持ポリシー:**
    - IndexedDB のクリーンアップ（40日以前のデータ削除）に連動し、バックアップフォルダ内の古い `.ndjson` ファイルも自動的に削除されます。

#### UI とステータス表示
ヘッダー右側にバックアップの状態を示す円形のインジケーターが表示されます。
- **枠線のみ:** バックアップが無効。
- **緑色 (Success):** すべてのデータが同期済み。
- **オレンジ色 (Dirty):** 未保存の変更あり。この状態は視認性のため、同期完了後も最低 2 秒間は維持されます。オレンジ色のインジケーターをクリックすることで、即座に同期（Flush）を実行できます。
- **赤色 (Error):** 同期失敗、またはアクセス権限の喪失。

#### セキュリティと制限
- ブラウザのセキュリティ仕様により、ブラウザの再起動後はユーザーが明示的に「アクセスを許可する」ボタン（設定パネル内の再接続ボタン）を押すまで、フォルダへのアクセス権限が一時的に失われます。

---

## 3. QL-Animation Studio の振る舞い

### アニメーション・スタジオの状態遷移 (Cassette Deck Style)

QL-Animation Studio のテスト実行環境は、カセットテープレコーダーを模した 3 つの状態を持ちます。

```mermaid
stateDiagram-v2
    [*] --> STOPPED

    STOPPED --> PLAYING : Play (Start)
    STOPPED --> STOPPED : Eject (Reset Sample)

    PLAYING --> STOPPED : Stop
    PLAYING --> PAUSED : Pause
    PLAYING --> PLAYING : Rewind / FF (Scrub)

    PAUSED --> PLAYING : Play / Pause (Resume)
    PAUSED --> STOPPED : Stop
    PAUSED --> PAUSED : Rewind / FF (Scrub)

    note right of PLAYING
      draw() が継続的に呼ばれる
      仮想時間が進行する
    end note

    note right of PAUSED
      draw() の呼び出しが止まる
      画面は維持される
    end note
```

#### 各状態の説明

- **STOPPED (停止中):**
    - アニメーションは実行されておらず、Canvas はクリアまたは初期状態です。
    - 設定の変更やサンプルの選択が可能です。
    - `Eject` ボタンでサンプル選択をリセットできます。
- **PLAYING (再生中):**
    - `draw()` がフレーム毎に呼び出され、アニメーションが進行します。
    - 設定変更はロックされます。
    - 内部的な「仮想経過時間」が実時間と同期して進行します。
- **PAUSED (一時停止中):**
    - `draw()` の呼び出しを一時停止し、現在の描画内容を Canvas に維持します。
    - Worker は終了せず、内部状態（変数など）は保持されます。
    - 設定変更は PLAYING 同様ロックされます。
    - `Play` または `Pause` ボタンで PLAYING に戻ります。

#### UI デザインと操作性

- **サンプル選択ドロップダウン:**
    - 製品版のアニメーションモジュールにはパッケージアイコン (📦)、開発・検証用 (`devOnly: true`) には全角スペース (　) を名前の前に付加しています。これにより、ドロップダウン内でのテキストの垂直方向の整列を保ちつつ、種別を直感的に識別可能にしています。
- **ツールチップの多言語対応:**
    - UI 要素のツールチップは `data-i18n-title` 属性で管理されます。`src/js/studio.js` の `updateTranslations` 関数がこれらをスキャンし、アクティブな言語のメッセージ集（存在しない場合は `messages.en`）を適用します。
- **統合コンソール:**
    - Web Worker からのログ出力を表示するコンソールを搭載。
    - **パフォーマンス:** 描画負荷を抑えるため、Worker からの出力は 10fps にスロットリング（間引き）されます。
    - **フィードバック:** Worker 内で実行時エラーが発生した際、コンソールは自動的に展開され、開発者に即座に通知します。

#### 特殊操作

- **巻き戻し (Rewind) / 先送り (Fast Forward):**
    - 実行中または一時停止中に使用可能です。
    - 10ms 間隔で 10 回 `draw()` を呼び出し、仮想時間を進退させます。
    - **並行制御:** スクラブ操作（巻き戻し/先送り）中のワーカのバックログを防ぐため、`isScrubbing` フラグによるガードを導入しています。また、描画リクエストを送信する前に `engine.isDrawPending` を確認し、前回の描画が完了するまで次のリクエストを待機させることで、UI の応答性と正確な再生を両立させています。
    - 操作完了後は、操作前の状態（PLAYING または PAUSED）を維持します。

#### ライフサイクル・ポリシー

- 再生ごとにアニメーションモジュールのインスタンスおよび Web Worker を新規に生成します。これにより、前回の実行状態（グローバル変数や汚染された内部状態）を引き継ぐことなく、常にクリーンな状態でテストを開始できます。

---

## 4. 設計原則と行動指針

本プロジェクトで採用している設計原則（SLAP, DRY, KISS, YAGNI, OCP）の詳細および具体的な行動指針については、[AGENTS.md](AGENTS.md) を参照してください。

---

## 5. 開発ワークフロー

### ディレクトリ構成
- `src/`: 拡張機能のソースコード一式。
  - `js/`: アプリケーションロジック。
    - `animation/`: 個別のアニメーションモジュール。
  - `css/`: アプリ用スタイルシート。
  - `assets/`: アイコン等の静的アセット。
  - `app.html`: アプリ本体のHTML。
- `index.html`: ランディングページ.
- `scripts/`: ビルドや管理用のスクリプト。
- `tests/`: テストコード。
- `docs/`: 仕様書などのドキュメント。

### バージョン管理
`npm run version:bump` コマンドにより、`src/version.json`, `package.json`, `src/manifest.*.json` を一括更新します。

### ビルドとパッケージング
`npm run build` により、以下の処理を自動実行します：
1. **PNGアイコン生成**: `src/assets/icon.svg` から各サイズ（16/32/48/128）の `icon.png` を生成します (`scripts/generate_png_icons.py`)。
2. **アニメーションレジストリ生成**: `src/js/animation/` 内の全モジュールをスキャンし、`src/js/animation_registry.js` を自動生成します (`scripts/generate_animation_registry.py`)。
3. **バージョン整合性チェック**: `package.json`, `version.json`, マニフェストファイル間でのバージョン番号の一致を確認します (`scripts/check_version.py`)。
4. **ZIPパッケージ作成**: ブラウザ別（Chrome, Firefox）のマニフェストを適用し、`releases/` ディレクトリに配布用 ZIP パッケージを作成します (`scripts/create_package.py`)。

### その他の管理スクリプト
- **scripts/bump_version.py**: バージョン番号をインクリメントし、関連ファイルすべてを同期更新します。
- **scripts/verify_animations.py**: アニメーションモジュールのメタデータや安全性を検証します（`npm test` 内で実行）。
- **scripts/verify_version_impact.py**: コミットメッセージの内容（feat, fix等）に応じて適切なバージョンアップが行われているかを CI 上で検証します。
- **scripts/animation_utils.py**: 複数のスクリプトで共有される、アニメーションモジュールのパースやフィルタリングのための共通ユーティリティです。

---

## 6. テストと品質管理

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

## 7. 拡張・修正時の注意点

1.  **ドキュメントの更新:** 実装の修正や拡張を行った場合、必ず `README.md` および `README_DEV.md` を更新してください。
2.  **Vanilla JS の維持:** 新たな外部ライブラリ（npm パッケージ）の導入は、開発用ツール（devDependencies）を除き、原則禁止です。
3.  **互換性:** `js/db.js` のスキーマを変更する場合は、`setupInitialData` 内で適切なデータ移行（Migration）処理を記述してください。
4.  **定数化の徹底:** マジックナンバーや DOM ID は必ず定数化してください。

---

## 8. 関連ドキュメント

- [製品仕様書 (spec.md)](spec.md)
- [テスト計画・ケース定義書 (README_TEST.md)](README_TEST.md)
- [背景アニメーション・モジュール仕様書 (animation_module_spec.md)](animation_module_spec.md)
- [AI エージェント指針 (AGENTS.md)](../AGENTS.md)
