# タスク: バックアップ・復元 UI スタイル修正

## Task 1: `.outline-btn` CSS クラスの追加
- [x] `projects/app/css/style.css` に `.outline-btn` クラスを追加する（`.primary-btn` 定義の直後に配置）
  - 背景透明、`border: 1px solid var(--md-sys-color-outline)`、`border-radius: var(--md-sys-shape-full)`
  - `color: var(--md-sys-color-primary)`、`font-weight: bold`、`width: 100%`
  - `display: flex; align-items: center; justify-content: center; gap: 8px`
  - `padding: var(--md-sys-spacing-1) var(--md-sys-spacing-2)`
- [x] `.outline-btn:hover` スタイルを追加する（`background-color: var(--md-sys-color-primary-container)` 等）
- [x] `.outline-btn:disabled` スタイルを追加する（`opacity: 0.5; cursor: not-allowed`）
- [x] `.outline-btn .material-symbols-outlined` スタイルを追加する（`font-size: 20px`）
- _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1_

## Task 2: メンテナンスタブ HTML 構造の修正（バックアップ・復元セクション）
- [x] `projects/app/app.html` の `#backup-not-configured` 内のボタンを outline-btn スタイルに変更する
  - `backup-start-btn`: `class="outline-btn"` + Material Symbols アイコン `backup` を追加（ラベル: 「保存先にアクセスしてバックアップを保存する」）
  - バックアップ先指定ボタン: `class="outline-btn"` + アイコン `folder_open` を追加（ラベル: 「バックアップ先を指定する」）
- [x] `#backup-configured` 内のボタンを outline-btn スタイルに変更し、以下の順序で配置する
  1. `backup-execute-btn`: `class="outline-btn"` + アイコン `backup`（ラベル: 「バックアップを保存する」）
  2. `restore-configured-btn`: `class="outline-btn"` + アイコン `restore`（ラベル: 「バックアップを復元する」）
  3. `backup-change-dir-btn`: `class="outline-btn"` + アイコン `folder_open`（ラベル: 「バックアップ先を変更する」）
- [x] `#backup-configured` 内のボタン群の直後に情報パネルを追加する
  - `<div class="setting-item">` で「保存先」ラベル (`data-i18n="backup-directory"`) + `<p id="backup-directory-name"></p>` を配置
  - `<div class="backup-status-panel">` で最終バックアップ時刻行とファイル数行を配置（`.status-row` 使用）
- [x] 情報パネルの直後、`#backup-configured` の閉じタグ内に `<p class="setting-description" data-i18n="backup-description-new"></p>` を追加する
- _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_

## Task 3: セクション間に仕切り線を追加
- [x] `projects/app/app.html` の `#backup-restore-section` 終了タグ直後、`#delete-initialize-section` 開始タグ直前に `<hr class="settings-divider">` を挿入する
- _Requirements: 4.1, 4.2_

## Task 4: `updateBackupUI()` 関数の修正
- [x] `projects/app/js/app.js` の `updateBackupUI()` にディレクトリ名表示ロジックを追加する
  - `backup-directory-name` 要素に `backupManager.directoryHandle.name` を `textContent` で設定
- [x] 最終バックアップ時刻の表示を `backup-last-time-label` キーのラベルと日時値を組み合わせた形式に変更する
- [x] ファイル数表示を `N 日分` 形式に変更する（`backup-file-count-unit` キー使用）
- _Requirements: 2.1, 2.2, 2.3_

## Task 5: i18n キーの変更・追加（全8言語）
- [x] `shared/js/locales/ja.js` の既存キーのラベルを変更する
  - `btn-backup-grant-run`: `保存先にアクセスしてバックアップを実行` → `保存先にアクセスしてバックアップを保存する`
  - `backup-execute`: `バックアップを実行する` → `バックアップを保存する`
  - `restore-btn`: `復元する` → `バックアップを復元する`
  - `backup-change-dir`: `バックアップ先を指定する` → `バックアップ先を変更する`
- [x] `shared/js/locales/ja.js` に `backup-last-time-label`（`最終バックアップ時刻`）と `backup-file-count-label`（`ファイル数`）を追加する
- [x] `shared/js/locales/en.js` の既存キーのラベルを変更し、`backup-last-time-label`（`Last Backup`）、`backup-file-count-label`（`File Count`）、`backup-change-dir`（`Change Destination`）を追加する
- [x] `shared/js/locales/de.js` に対応するキーの変更・追加を行う
- [x] `shared/js/locales/es.js` に対応するキーの変更・追加を行う
- [x] `shared/js/locales/fr.js` に対応するキーの変更・追加を行う
- [x] `shared/js/locales/pt.js` に対応するキーの変更・追加を行う
- [x] `shared/js/locales/ko.js` に対応するキーの変更・追加を行う
- [x] `shared/js/locales/zh.js` に対応するキーの変更・追加を行う
- _Requirements: 2.2, 2.3, 5.3_

## Task 6: バージョンバンプと検証
- [x] `npm run version:bump` を実行してパッチバージョンをインクリメントする
- [x] `npm run lint` を実行してリント通過を確認する
- [x] `npm test` を実行してユニットテスト通過を確認する
- _Requirements: 5.2_
