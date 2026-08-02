# Implementation Plan: バックアップ・リストア・メンテナンス機能のオーバーホール

## Overview

既存の BackupManager を拡張し、RestoreManager・AnimationSyncManager を新規追加する。設定パネルのタブ構成を整理し、「バックアップ」タブを廃止して「メンテナンス」タブに統合する。削除/初期化 UI をチェックボックス方式に刷新し、カスタムアニメーションの chrome.storage.sync 同期機能を実装する。

## Tasks

- [x] 1. スキーマ v2.0 定義と新バリデーション関数の追加
  - [x] 1.1 `shared/js/schema.js` にスキーマ v2.0 定数とバリデーション関数を追加
    - `SCHEMA_VERSION_2_0 = '2.0'` を定義しエクスポート
    - `SCHEMA_KIND_ALARM = 'QuickLogSolo/Alarm'` を定義しエクスポート
    - `SCHEMA_KIND_CUSTOM_ANIMATION = 'QuickLogSolo/CustomAnimation'` を定義しエクスポート
    - `validateAlarmSchema(data)` を実装（design.md の検証ルール表に基づく）
    - `validateCustomAnimationSchema(data)` を実装
    - `validateSettingsSchema` を `version === '1.0' || version === '2.0'` の両方を受け入れるよう拡張
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 1.2 スキーマバリデーションのユニットテストを作成
    - `shared/js/schema.test.js` にテストを追加
    - 有効なアラームオブジェクト → `true`、必須フィールド欠損 → `false`
    - 不正バージョン値（`null`, `undefined`, `''`, `'3.0'`）→ `false`
    - `validateSettingsSchema` が `version: '2.0'` を受け入れることを確認
    - **Property 4: アラーム・カスタムアニメーションスキーマバリデーションの正確性**
    - **Validates: Requirements 2.2, 2.3, 2.6**

- [x] 2. AnimationSyncManager の実装
  - [x] 2.1 `shared/js/anim_sync.js` にチャンク分割・結合の純粋関数を実装
    - `splitIntoChunks(base64String, maxSize = 6000)` を実装
    - `joinChunks(chunks)` を実装
    - `animChunkKey(animationId, chunkIndex)` を実装
    - _Requirements: 6.1, 6.6_

  - [x] 2.2 チャンク分割 round-trip のプロパティベーステストを作成
    - `shared/js/anim_sync.test.js` に fast-check を用いた PBT を追加
    - **Property 7: チャンク分割の round-trip と上限保証**
    - **Validates: Requirements 6.1, 6.6**

  - [x] 2.3 `shared/js/anim_sync.js` に sync 書き込み・読み込み・削除関数を実装
    - `pushAnimationToSync(animationId, base64, onProgress)` — 3回リトライ付き
    - `pullAnimationsFromSync(syncData)` — チャンク結合して Blob 再構築
    - `removeAnimationFromSync(animationId)` — 特定アニメーションのチャンクを削除
    - `clearAllAnimationChunksFromSync()` — `anim_chunk_` プレフィックスの全キーを削除
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [x] 2.4 AnimationSyncManager のユニットテストを作成
    - リトライが正確に 3 回実行されることを確認
    - 容量超過エラー時にスキップして処理継続することを確認
    - 端末間同期無効化時に `anim_chunk_` キーが全削除されることを確認
    - _Requirements: 6.4, 6.5, 6.7, 6.8_

- [x] 3. Checkpoint - スキーマ・同期モジュールの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. BackupManager の拡張（アラーム・カスタムアニメーションのバックアップ）
  - [x] 4.1 `projects/app/js/backup.js` にアラームバックアップ機能を追加
    - `_backupAlarms()` メソッドを追加: `STORE_ALARMS` から全件取得し `ql_alarms.json` を書き出す
    - `_ensureSubDirectory()` で `history/` サブディレクトリを作成し、日別 NDJSON を格納
    - 書き出し形式: `{ app: 'QuickLog-Solo', kind: 'QuickLogSolo/Alarm', version: '2.0', entries: [...] }`
    - `backupToFiles()` から `_backupAlarms()` を呼び出す
    - `settings.json` の `version` を `'2.0'` に更新し、`ql_settings.json` として書き出す
    - エラー時に `FAILED` ステータスに遷移
    - _Requirements: 1.1, 1.4, 1.5, 1.7, 2.1, 7.1, 7.2_

  - [x] 4.2 `projects/app/js/backup.js` にカスタムアニメーションバックアップ機能を追加
    - `_backupCustomAnimations()` メソッドを追加
    - `ql_custom_animations.json` を書き出す（0件でも空配列で書き出し）
    - `_ensureSubDirectory()` で `animations/` サブディレクトリを作成し、各 Blob を `animations/{id}.gif` として個別ファイルに書き出す
    - `backupToFiles()` から `_backupCustomAnimations()` を呼び出す
    - エラー時に `FAILED` ステータスに遷移
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 7.1, 7.2_

  - [x] 4.3 `BackupManager.sync()` のフローを修正
    - `restoreFromFiles()`（マージ復元）を `sync()` フローから削除
    - `sync()` は `backupToFiles()` + `cleanupOldFiles()` のみを実行
    - `cleanupOldFiles()` は `history/` サブディレクトリ内の古い日別 NDJSON を対象にクリーンアップ
    - 全ファイル書き込み完了後にのみ `lastBackupTime` を更新
    - _Requirements: 7.1, 7.2, 7.5, 7.6_

  - [x] 4.4 BackupManager 拡張のユニットテストを作成
    - `projects/app/js/backup.test.js` にテストを追加
    - アラーム存在時に `ql_alarms.json` が正しい形式で出力されること
    - カスタムアニメーション 0 件で `ql_custom_animations.json` に空配列 entries が出力されること
    - `STORE_ALARMS` 読み取り失敗時にステータス `FAILED`
    - バックアップ完了時刻が全書き込み後にのみ更新されること
    - **Property 1: バックアップのアラームデータ整合性**
    - **Property 2: バックアップのカスタムアニメーションメタデータ整合性**
    - **Property 3: バックアップの冪等性**
    - **Validates: Requirements 1.1, 1.2, 1.5, 1.6, 1.7, 1.8, 2.1, 7.1**

- [x] 5. RestoreManager の新規実装
  - [x] 5.1 `projects/app/js/restore.js` に RestoreManager を実装
    - `restoreFromDirectory(showConfirm, showToast, t)` を実装
    - フォルダ選択ダイアログ表示（`showDirectoryPicker()`）
    - `_readAndValidateBackupFolder(dirHandle)` — 必須ファイル（`ql_categories.ndjson` or `categories.ndjson`、`ql_settings.json` or `settings.json`）のフォールバック付き確認
    - `_resolveFileWithFallback(dirHandle, newName, legacyName)` — 新ファイル名を優先し、不在なら旧ファイル名を試行する汎用ヘルパー
    - 確認ダイアログ（全消去警告）の表示
    - `_clearAllStores()` — QuickLogSoloDB 全ストア + QuickLogAnimationDB blobs ストアを消去
    - `_restoreCategories(dirHandle)` / `_restoreSettings(dirHandle)` / `_restoreLogs(dirHandle)` — `history/` サブディレクトリとルート直下の両方の日別 NDJSON を探索
    - `_restoreAlarms(dirHandle)` — `ql_alarms.json` 不在時は空配列として処理続行
    - `_restoreCustomAnimations(dirHandle)` — `ql_custom_animations.json` + `animations/{id}.gif` の復元
    - バリデーション失敗レコードのスキップとスキップ件数の通知
    - 復元完了後に `location.reload()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 2.4, 2.5, 7.3, 7.4, 7.5_

  - [x] 5.2 RestoreManager のユニットテストを作成
    - `projects/app/js/restore.test.js` にテストを追加
    - フォルダ選択キャンセル時にデータ変更されないこと
    - 必須ファイル（新旧両方）不在でエラー表示して中断
    - `ql_alarms.json` 不在（v1.x バックアップ）で処理続行
    - 旧ファイル名（`categories.ndjson` / `settings.json`）でのフォールバック読み込み成功
    - 不正レコードのスキップ件数表示
    - IndexedDB 書き込み失敗時のエラー表示・中断
    - **Property 5: バックアップ・リストア round-trip**
    - **Validates: Requirements 3.2, 3.4, 3.9, 3.10, 3.11, 2.5, 7.3, 7.4**

- [x] 6. Checkpoint - バックアップ・リストアロジックの確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. UI 変更: タブ統合とメンテナンスタブの刷新
  - [x] 7.1 `projects/app/app.html` のタブ構成を変更
    - 「バックアップ」タブボタン（`data-tab="backup"`）を削除
    - `#backup-tab` の HTML セクション全体を削除
    - `#maintenance-tab` にバックアップ・復元セクションの HTML を追加
    - 保存先未設定時: 「バックアップを開始する」+「復元する」ボタン
    - 保存先設定済み時: 「バックアップを実行する」+「バックアップ先を指定する」+「復元する」ボタン + ステータス表示
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 4.8_

  - [x] 7.2 `projects/app/app.html` の削除/初期化セクションをチェックボックス方式に変更
    - 既存の個別削除ボタン（`#clear-logs-btn`, `#reset-cat-settings-btn`, `#reset-settings-btn`）を削除
    - チェックボックス 5 件（作業履歴 / カテゴリ / 設定 / アラーム / カスタムアニメーション）を追加
    - 「削除/初期化する」実行ボタンを追加（初期状態: `disabled`）
    - _Requirements: 5.1, 5.2_

  - [x] 7.3 `projects/app/js/app.js` にメンテナンスタブの UI ロジックを実装
    - バックアップ保存先の状態に応じたボタン表示切り替えロジック
    - チェックボックスの `change` イベントリスナー → 実行ボタンの `disabled` 制御
    - 「削除/初期化する」ボタンの確認ダイアログ表示 → 選択項目の消去実行
    - 「カスタムアニメーション」選択時に `QuickLogAnimationDB` + `custom_animation_metadata_map` も消去
    - 実行中のボタン無効化・完了後のリセット・トースト通知
    - エラー時の項目名を含むエラーメッセージ表示
    - _Requirements: 4.6, 4.7, 4.8, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 7.4 削除/初期化 UI のユニットテストを作成
    - チェックボックス未選択時に実行ボタンが `disabled`
    - 「カスタムアニメーション」選択時に対象ストアが正しく消去される
    - 実行中はボタンが `disabled`
    - **Property 6: チェックボックス選択状態と実行ボタンの有効状態の一致**
    - **Validates: Requirements 5.2, 5.4, 5.5, 5.7**

- [x] 8. UI 変更: 復元ボタンと RestoreManager の接続
  - [x] 8.1 `projects/app/js/app.js` に復元ボタンのイベントハンドラを追加
    - 「復元する」ボタンクリック時に `restoreManager.restoreFromDirectory()` を呼び出す
    - `showConfirm` / `showToast` / `t` を DI として渡す
    - 復元フォルダを BackupManager の保存先として設定する処理を追加
    - _Requirements: 3.1, 3.7_

- [x] 9. UI 変更: エクスポート/インポート機能の廃止
  - [x] 9.1 「一般」タブから CSV エクスポート/インポート UI を削除
    - `projects/app/app.html` から CSV 関連の HTML 要素を削除
    - `projects/app/js/app.js` から CSV エクスポート/インポートのイベントハンドラを削除
    - _Requirements: 4.3_

  - [x] 9.2 カテゴリ・エディタのエクスポート/インポート機能の UI を廃止
    - `projects/category-editor/` から該当 UI 要素・ロジックを削除
    - _Requirements: 4.4_

  - [x] 9.3 アラーム・エディタのエクスポート/インポート機能の UI を廃止
    - `projects/alarm-editor/` から該当 UI 要素・ロジックを削除
    - _Requirements: 4.5_

- [x] 10. Checkpoint - UI 変更の確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. chrome.storage.sync へのカスタムアニメーション同期の統合
  - [x] 11.1 `shared/js/session_sync.js` にアニメーション同期の統合ロジックを追加
    - カスタムアニメーション追加・変更・削除時に `pushAnimationToSync` を呼び出す統合
    - リモートから `anim_chunk_` キーを受信した際に `pullAnimationsFromSync` を実行
    - 端末間同期無効化時に `clearAllAnimationChunksFromSync` を実行
    - 同期進捗の「完了件数 / 全件数」表示を UI に通知するコールバック追加
    - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.8, 6.9_

  - [x] 11.2 `projects/app/js/app.js` にアニメーション同期の進捗 UI を追加
    - 同期進捗インジケーター（「1 / 3」形式）の表示・更新ロジック
    - 同期中でもカテゴリ計時が利用可能であることの確認（非ブロッキング設計）
    - _Requirements: 6.2, 6.3_

- [x] 12. i18n キーの追加（8言語）
  - [x] 12.1 `shared/js/locales/ja.js` に新規 i18n キーを追加（正典）
    - `confirm-restore` / `confirm-restore-desc` キーを追加
    - `confirm-delete-initialize` キーを追加
    - `maintenance-clear-logs` / `maintenance-clear-categories` / `maintenance-clear-settings` / `maintenance-clear-alarms` / `maintenance-clear-animations` キーを追加
    - バックアップ・復元ボタンラベル・エラーメッセージ・トースト通知のキーを追加
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 12.2 残り 7 言語ファイルに翻訳を追加
    - `en.js` / `de.js` / `es.js` / `fr.js` / `pt.js` / `ko.js` / `zh.js` に対応する翻訳を追加
    - _Requirements: 8.1, 8.5, 8.6_

- [x] 13. Checkpoint - 全機能の統合確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. E2E テスト
  - [x] 14.1 E2E テストの作成（`tests/maintenance.spec.js`）
    - 設定パネルに「バックアップ」タブが存在しないことを確認
    - 「メンテナンス」タブにバックアップ・復元・削除機能が表示されることを確認
    - バックアップ実行後に「最終バックアップ時刻」が更新されることを確認
    - チェックボックス方式の削除/初期化が正常に動作することを確認
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 7.1_

- [x] 15. Final checkpoint - 全テスト通過の確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties（fast-check を使用）
- Unit tests validate specific examples and edge cases（Jest + jsdom + fake-indexeddb）
- 実装言語: Vanilla JavaScript (ES Modules) — フレームワーク禁止
- `innerHTML` 禁止: すべて `textContent` を使用
- `projects/app/` または `shared/` の変更後は `npm run version:bump` が必要

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3"] },
    { "id": 2, "tasks": ["2.4", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "5.1"] },
    { "id": 4, "tasks": ["5.2", "7.1", "7.2", "12.1"] },
    { "id": 5, "tasks": ["7.3", "7.4", "8.1", "9.1", "9.2", "9.3", "12.2"] },
    { "id": 6, "tasks": ["11.1"] },
    { "id": 7, "tasks": ["11.2", "14.1"] }
  ]
}
```
