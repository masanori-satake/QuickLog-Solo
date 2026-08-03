# Implementation Plan: Branch Coverage Improvement

## Overview

`shared/js/` 配下の7モジュールに対してエッジケース・境界値・エラーパステストを追加し、ブランチカバレッジを 48.05% → ~60% に引き上げる。テスト追加過程で発見された不十分なエラーハンドリング箇所には守備的フォールバックを実装する。テストファイルは `shared/js/*.test.js` に新規作成し、Jest + jsdom + fake-indexeddb 環境で実行する。

## Tasks

- [ ] 1. logic.js のテスト追加（最優先・最大インパクト）
  - [ ] 1.1 generateReport の全7フォーマット × オプション組み合わせテスト作成
    - `shared/js/logic.test.js` を新規作成
    - csv, tsv, html, markdown, wiki, text-plain, text-table の各フォーマットで endTime/duration オプション組み合わせをテスト
    - 空ログ配列、未知フォーマット文字列で空文字列が返ることを検証
    - _Requirements: 2.6, 2.7_

  - [ ] 1.2 formatDuration / formatLogDuration のエッジケーステスト作成
    - 0ms、負数、境界値（59999ms, 60000ms, 3599999ms, 3600000ms）のテスト
    - 各閾値（59秒/60秒/3599秒/3600秒）で正しい表記（s/m/h）が返ることを検証
    - _Requirements: 2.1, 2.2_

  - [ ] 1.3 calculateTagAggregation のスキップ条件テスト作成
    - endTime なし、duration 0以下、isManualStop、システムカテゴリ（__IDLE__, __UNKNOWN__, __PAGE_BREAK__*）のログがスキップされることを検証
    - _Requirements: 2.3_

  - [ ] 1.4 stripEmojis / getVisualWidth のエッジケーステスト作成
    - stripEmojis: null、空文字列、絵文字のみの文字列で空文字列を返すことを検証
    - getVisualWidth: null、空文字列、マルチバイト文字、半角カタカナで正しい幅を返すことを検証
    - _Requirements: 2.4, 2.5_

  - [ ] 1.5 calculateNextAlarmTime のテスト作成
    - disabled アラーム、空 time、weekly で該当曜日なしで null を返すことを検証
    - holiday adjustment (skip, prev_business_day, next_business_day) の各パターンをテスト
    - _Requirements: 2.8, 2.9_

  - [ ]* 1.6 logic.js のプロパティテスト作成
    - **Property 6: formatDuration のフォーマット不変量**
    - **Property 7: calculateTagAggregation のスキップ条件**
    - **Property 8: stripEmojis の ASCII 恒等性**
    - **Property 9: getVisualWidth の下限プロパティ**
    - **Property 10: generateReport の未知フォーマット拒否**
    - **Property 11: calculateNextAlarmTime の無効アラーム null 保証**
    - **Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.6, 2.8**

- [ ] 2. schema.js のバリデーションテスト追加
  - [ ] 2.1 validateCategorySchema / validateHistorySchema のテスト作成
    - `shared/js/schema.test.js` を新規作成
    - null、非オブジェクト、不正 kind/version、type=page-break に不正プロパティ、tags 21個以上、tags 空文字列含むデータで false を検証
    - type=idle で不正 resumableCategory、type=stop で endTime 欠落、type=task で禁止プロパティ付きで false を検証
    - _Requirements: 3.1, 3.2_

  - [ ] 2.2 validateSettingsSchema / validateAlarmSchema / validateCustomAnimationSchema のテスト作成
    - 不正 entries（未許可key、各 key ごとの不正値）で false を検証
    - 不正 time フォーマット（24:00, 12:60, 非文字列）、不正 type、daysOfWeek 範囲外で false を検証
    - 不正 UUID、name 空文字列、config が配列、renderSpec が null で false を検証
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ]* 2.3 schema.js のプロパティテスト作成
    - **Property 12: スキーマバリデーションの null/非オブジェクト拒否**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [ ] 3. utils.js のエッジケーステスト追加
  - [ ] 3.1 escape 関数群と型ガード分岐のテスト作成
    - `shared/js/utils.test.js` を新規作成
    - escapeHtml, escapeTsv, escapeCsv が非文字列引数（null, undefined, number, object）で入力値をそのまま返すことを検証
    - isValidCategoryName が非文字列、空文字列、51文字超、システムカテゴリ名で false を返すことを検証
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 3.2 parseCsvLine / generateDuplicateName / generateUUID / floorToMinute のテスト作成
    - parseCsvLine: クォートされたフィールド（エスケープ済みダブルクォート含む）のパースを検証
    - generateDuplicateName: 既に番号サフィックス付きの名前群に対して最大番号+1 を検証
    - generateUUID: crypto.randomUUID 利用不可環境でフォールバック文字列を検証
    - floorToMinute: 0、負数、境界値（59999ms、60000ms）で正しくフロアリングされることを検証
    - _Requirements: 1.5, 1.6, 1.7, 1.8_

  - [ ]* 3.3 utils.js のプロパティテスト作成
    - **Property 1: Escape 関数の型ガード恒等性**
    - **Property 2: 無効なカテゴリ名の拒否**
    - **Property 3: CSV ラウンドトリップ**
    - **Property 4: generateDuplicateName のサフィックス増分**
    - **Property 5: floorToMinute の分境界プロパティ**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8**

- [ ] 4. Checkpoint - テスト実行確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. db.js の IndexedDB テスト追加
  - [ ] 5.1 dbGet / dbGetByName / dbGetManualStopsAt / dbCount のテスト作成
    - `shared/js/db.test.js` を新規作成
    - fake-indexeddb を使用して IndexedDB 環境をセットアップ
    - 存在しないキー/name で undefined、該当レコードなしで空配列、空ストアで 0 を返すことを検証
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 5.2 dbImportCategories / cleanupOldLogs / setupInitialData のテスト作成
    - merge モード・overwrite モードで既存データと重複するデータの動作を検証
    - 保持期間内と期限切れのログが混在する状態で期限切れのみ削除されることを検証
    - デフォルトカテゴリが既に存在する状態で重複追加されないことを検証
    - _Requirements: 5.5, 5.6, 5.7_

  - [ ]* 5.3 db.js のプロパティテスト作成
    - **Property 15: dbImportCategories overwrite モードの冪等性**
    - **Validates: Requirements 5.5**

- [ ] 6. i18n.js のテスト追加
  - [ ] 6.1 detectBrowserLanguage / setLanguage / t() のテスト作成
    - `shared/js/i18n.test.js` を新規作成
    - window.location に lang パラメータ付きで呼んだ場合パラメータの値が優先されることを検証
    - navigator.language に各言語プレフィックス（ja, de, es, fr, pt, ko, zh）設定時に対応言語コードを返すことを検証
    - setLanguage: 'auto'、未知の言語コード、有効なコードの各動作を検証
    - t(): 存在しないキー、_common に存在するキー、プレースホルダー置換を検証
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.2 i18n.js のプロパティテスト作成
    - **Property 13: setLanguage の未知言語フォールバック**
    - **Property 14: detectBrowserLanguage の lang パラメータ優先**
    - **Validates: Requirements 4.3, 4.1**

- [ ] 7. session_sync.js の純粋関数テスト追加
  - [ ] 7.1 extractLogsFromData / reconstructTimeline / mergeLogs のテスト作成
    - `shared/js/session_sync.test.js` を新規作成
    - extractLogsFromData: 空データ、null チャンク、有効ログチャンクで正しいログ配列を検証
    - reconstructTimeline: 空配列、重複ログ、ギャップのあるログ群で正しく再構築されることを検証
    - mergeLogs: 空リモートログ、overwrite=true、remoteDeletedIds 含むデータのマージを検証
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 7.2 session_sync.js のプロパティテスト作成
    - **Property 17: extractLogsFromData のチャンク結合**
    - **Property 18: reconstructTimeline の順序不変量**
    - **Validates: Requirements 7.1, 7.2**

- [ ] 8. idb_storage.js のテスト追加
  - [ ] 8.1 Blob CRUD エッジケーステスト作成
    - `shared/js/idb_storage.test.js` を新規作成
    - fake-indexeddb を使用
    - getAnimationBlob / getAnimationDraftBlob / getAnimationDraftRecord: 存在しない ID で null を返すことを検証
    - deleteAnimationBlob: 存在しない ID でエラーなく完了することを検証
    - clearAnimationDraftDB: 空 DB でエラーなく完了することを検証
    - saveAnimationBlob → getAnimationBlob のラウンドトリップを検証
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 8.2 idb_storage.js のプロパティテスト作成
    - **Property 16: Blob ストレージのラウンドトリップ**
    - **Validates: Requirements 6.6**

- [ ] 9. Checkpoint - 全テスト実行確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. 守備的エラーハンドリングの実装追加
  - [ ] 10.1 テスト追加で発見された不足箇所に守備的ガードを実装
    - 各モジュールで null/undefined/不正型の引数に対しフォールバック値を返すガードを追加
    - 早期リターンパターンを使用し、既存の正常系動作を変更しない
    - calculateTagAggregation で null ログのフィルタ処理追加など
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 10.2 追加したガードパスのテストを各テストファイルに追記
    - 守備的ハンドリングが正しくフォールバック値を返すことを検証するテストケースを追加
    - 既存テストが破壊されていないことを確認
    - _Requirements: 8.2, 8.3_

- [ ] 12. バージョンバンプ（patch）
  - [ ] 12.1 `npm run version:bump` を実行してパッチバージョンをインクリメント
    - タスク10 で `shared/` のソースコードに守備的エラーハンドリングを追加したため、CI 通過にバージョンバンプが必須
    - `scripts/bump_version.py` により `package.json` / マニフェスト等のバージョンが一括同期される
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 11. Final checkpoint - カバレッジ確認と全テスト pass
  - `npm test` で全テストが pass することを確認
  - `--coverage` オプションでブランチカバレッジが ~60% に到達していることを確認
  - 既存テスト（tests/alarm_logic.test.js 等）が破壊されていないことを確認
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. コミット・プッシュ・PR提出
  - [ ] 13.1 変更のコミット
    - 全変更をステージングし、以下のコミットメッセージでコミット:
      `feat: ブランチカバレッジ向上（48%→60%）エッジケーステスト追加・守備的エラーハンドリング実装`
    - ブランチはユーザーが事前に作成済み
    - _Requirements: 全体_

  - [ ] 13.2 リモートプッシュと PR 作成
    - `git push -u origin` で現在のブランチをリモートにプッシュ
    - `gh pr create` で PR を作成（タイトル・説明文は日本語）
    - PR タイトル例: `feat: ブランチカバレッジ向上（48%→60%）`
    - PR 説明文にはカバレッジ改善内容・追加テストモジュール一覧・守備的ハンドリング実装内容を記載
    - _Requirements: 全体_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- テストファイルは全て `shared/js/*.test.js` に配置（既存パターン準拠）
- ESM モジュールは `--experimental-vm-modules` フラグで動作
- プロパティテストは `@fast-check/jest` を使用（既に devDependencies に存在）
- 守備的ハンドリングは例外をスローせず、安全なフォールバック値を返す
- テストデータファクトリは各テストファイル内にローカルで定義（テスト間の依存最小化）
- 各テストファイルは独立して実行可能であること

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "3.2"] },
    { "id": 2, "tasks": ["1.4", "1.5", "2.3", "3.3"] },
    { "id": 3, "tasks": ["1.6", "5.1", "6.1", "7.1", "8.1"] },
    { "id": 4, "tasks": ["5.2", "6.2", "7.2", "8.2"] },
    { "id": 5, "tasks": ["5.3"] },
    { "id": 6, "tasks": ["10.1"] },
    { "id": 7, "tasks": ["10.2"] },
    { "id": 8, "tasks": ["12.1"] },
    { "id": 9, "tasks": ["13.1"] },
    { "id": 10, "tasks": ["13.2"] }
  ]
}
```
