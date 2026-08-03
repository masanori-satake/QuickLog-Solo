# Requirements Document

## Introduction

ブランチカバレッジを現在の 48.05% から約 60% に引き上げるため、純粋ロジック層（DOM/Canvas 非依存）のモジュールに対して不足しているエッジケース・エラーハンドリング・境界値テストを追加する。テスト追加の過程で発見された不十分なエラーハンドリングについては、守備的アプローチ（フォールバック値を返し、例外をスローしない）で実装に追加する。

対象モジュール: `shared/js/logic.js`, `shared/js/db.js`, `shared/js/utils.js`, `shared/js/i18n.js`, `shared/js/schema.js`, `shared/js/session_sync.js`, `shared/js/idb_storage.js`

対象外: `shared/js/animations.js` (AnimationEngine)

## Glossary

- **Test_Suite**: Jest + jsdom + fake-indexeddb 環境で実行されるユニットテスト群
- **Branch_Coverage**: Jest の `--coverage` オプションで計測される分岐カバレッジ率
- **Target_Modules**: logic.js, db.js, utils.js, i18n.js, schema.js, session_sync.js, idb_storage.js の7モジュール
- **Defensive_Handling**: 例外をスローせず、安全なフォールバック値（空配列、空文字列、null、デフォルト値など）を返すエラーハンドリング手法
- **Edge_Case**: 境界値、null/undefined 入力、空配列、型不正などの異常系入力パターン

## Requirements

### Requirement 1: utils.js のエッジケーステスト追加

**User Story:** As a 開発者, I want utils.js の全分岐を網羅するテストがある状態にしたい, so that ユーティリティ関数の信頼性を保証できる

#### Acceptance Criteria

1. WHEN `escapeHtml` が非文字列引数（null, undefined, number, object）で呼ばれた場合, THE Test_Suite SHALL 入力値がそのまま返されることを検証する
2. WHEN `escapeTsv` が非文字列引数で呼ばれた場合, THE Test_Suite SHALL 入力値がそのまま返されることを検証する
3. WHEN `escapeCsv` が非文字列引数で呼ばれた場合, THE Test_Suite SHALL 入力値がそのまま返されることを検証する
4. WHEN `isValidCategoryName` が非文字列引数、空文字列、51文字超、システムカテゴリ名（__IDLE__, __UNKNOWN__, __PAGE_BREAK__接頭辞）で呼ばれた場合, THE Test_Suite SHALL false が返されることを検証する
5. WHEN `parseCsvLine` がクォートされたフィールド（エスケープ済みダブルクォート含む）を含む行で呼ばれた場合, THE Test_Suite SHALL 正しくパースされることを検証する
6. WHEN `generateDuplicateName` が既に番号サフィックス付きの名前群に対して呼ばれた場合, THE Test_Suite SHALL 最大番号+1のサフィックスが付与されることを検証する
7. WHEN `generateUUID` が `crypto.randomUUID` が利用不可の環境で呼ばれた場合, THE Test_Suite SHALL フォールバック文字列が生成されることを検証する
8. WHEN `floorToMinute` が0、負数、境界値（59999ms、60000ms）で呼ばれた場合, THE Test_Suite SHALL 正しくフロアリングされることを検証する

### Requirement 2: logic.js のエッジケーステスト追加

**User Story:** As a 開発者, I want logic.js の未テスト分岐をカバーするテストを追加したい, so that ビジネスロジックの全パスが検証済みとなる

#### Acceptance Criteria

1. WHEN `formatDuration` が 0ms、負数、境界値で呼ばれた場合, THE Test_Suite SHALL 正しいフォーマット文字列を返すことを検証する
2. WHEN `formatLogDuration` が 0秒未満の区切り（59秒、60秒、3599秒、3600秒）で呼ばれた場合, THE Test_Suite SHALL 各閾値で正しい表記（s/m/h）が返されることを検証する
3. WHEN `calculateTagAggregation` が endTime なしのログ、duration 0以下のログ、isManualStop ログ、システムカテゴリログを含む場合, THE Test_Suite SHALL これらがスキップされることを検証する
4. WHEN `stripEmojis` が null、空文字列、絵文字のみの文字列で呼ばれた場合, THE Test_Suite SHALL 安全に空文字列を返すことを検証する
5. WHEN `getVisualWidth` が null、空文字列、マルチバイト文字、半角カタカナで呼ばれた場合, THE Test_Suite SHALL 正しい幅を返すことを検証する
6. WHEN `generateReport` が空のログ配列、未知のフォーマット文字列で呼ばれた場合, THE Test_Suite SHALL 空文字列を返すことを検証する
7. WHEN `generateReport` が各フォーマット（csv, tsv, html, markdown, wiki, text-plain, text-table）で呼ばれた場合, THE Test_Suite SHALL endTime/duration オプションの各組み合わせで正しい出力を返すことを検証する
8. WHEN `calculateNextAlarmTime` が disabled アラーム、空 time、weekly で該当曜日なしで呼ばれた場合, THE Test_Suite SHALL null を返すことを検証する
9. WHEN `calculateNextAlarmTime` が holiday adjustment (skip, prev_business_day, next_business_day) の各パターンで呼ばれた場合, THE Test_Suite SHALL 調整後の日時が返されることを検証する

### Requirement 3: schema.js のエッジケーステスト追加

**User Story:** As a 開発者, I want schema.js のバリデーション関数の全分岐をテストしたい, so that スキーマ検証の堅牢性を保証できる

#### Acceptance Criteria

1. WHEN `validateCategorySchema` が null、非オブジェクト、不正なkind/version、type=page-break に不正プロパティ付き、tags が21個以上、tags に空文字列含むデータで呼ばれた場合, THE Test_Suite SHALL false を返すことを検証する
2. WHEN `validateHistorySchema` が type=idle で不正な resumableCategory、type=stop で endTime 欠落、type=task で禁止プロパティ付きデータで呼ばれた場合, THE Test_Suite SHALL false を返すことを検証する
3. WHEN `validateSettingsSchema` が不正な entries（未許可key、各 key ごとの不正値）で呼ばれた場合, THE Test_Suite SHALL false を返すことを検証する
4. WHEN `validateAlarmSchema` が不正な time フォーマット（24:00, 12:60, 非文字列）、不正な type、daysOfWeek に範囲外の値で呼ばれた場合, THE Test_Suite SHALL false を返すことを検証する
5. WHEN `validateCustomAnimationSchema` が不正な UUID フォーマット、name 空文字列、config が配列、renderSpec が null のデータで呼ばれた場合, THE Test_Suite SHALL false を返すことを検証する

### Requirement 4: i18n.js のエッジケーステスト追加

**User Story:** As a 開発者, I want i18n.js の未テスト分岐をカバーしたい, so that 多言語処理のフォールバック動作が保証される

#### Acceptance Criteria

1. WHEN `detectBrowserLanguage` が `window.location` に `lang` パラメータ付きで呼ばれた場合, THE Test_Suite SHALL パラメータの値が優先されることを検証する
2. WHEN `detectBrowserLanguage` が `navigator.language` に対応言語プレフィックス（ja, de, es, fr, pt, ko, zh）が設定された場合, THE Test_Suite SHALL 対応する言語コードを返すことを検証する
3. WHEN `setLanguage` が 'auto'、未知の言語コード、有効な言語コードで呼ばれた場合, THE Test_Suite SHALL それぞれ自動検出結果、'en'へのフォールバック、指定言語が設定されることを検証する
4. WHEN `t` が存在しないキー、`_common` に存在するキー、プレースホルダー置換パラメータ付きで呼ばれた場合, THE Test_Suite SHALL 適切なフォールバックと置換が行われることを検証する

### Requirement 5: db.js のエッジケーステスト追加

**User Story:** As a 開発者, I want db.js のデータアクセス層のエラーパス・境界値テストを追加したい, so that IndexedDB 操作の堅牢性が保証される

#### Acceptance Criteria

1. WHEN `dbGet` が存在しないキーで呼ばれた場合, THE Test_Suite SHALL undefined を返すことを検証する
2. WHEN `dbGetByName` が存在しない name で呼ばれた場合, THE Test_Suite SHALL undefined を返すことを検証する
3. WHEN `dbGetManualStopsAt` が該当レコードなしの timestamp で呼ばれた場合, THE Test_Suite SHALL 空配列を返すことを検証する
4. WHEN `dbCount` が空のストアに対して呼ばれた場合, THE Test_Suite SHALL 0 を返すことを検証する
5. WHEN `dbImportCategories` が merge モードおよび overwrite モードで既存データと重複するデータで呼ばれた場合, THE Test_Suite SHALL 各モードの動作を検証する
6. WHEN `cleanupOldLogs` が保持期間内のログと期限切れのログが混在する状態で呼ばれた場合, THE Test_Suite SHALL 期限切れのログのみ削除されることを検証する
7. WHEN `setupInitialData` が既にデフォルトカテゴリが存在する状態で呼ばれた場合, THE Test_Suite SHALL 重複追加されないことを検証する

### Requirement 6: idb_storage.js のエッジケーステスト追加

**User Story:** As a 開発者, I want idb_storage.js の未テスト分岐をカバーしたい, so that アニメーション Blob ストレージの動作が保証される

#### Acceptance Criteria

1. WHEN `getAnimationBlob` が存在しない ID で呼ばれた場合, THE Test_Suite SHALL null を返すことを検証する
2. WHEN `getAnimationDraftBlob` が存在しない ID で呼ばれた場合, THE Test_Suite SHALL null を返すことを検証する
3. WHEN `getAnimationDraftRecord` が存在しない ID で呼ばれた場合, THE Test_Suite SHALL null を返すことを検証する
4. WHEN `deleteAnimationBlob` が存在しない ID で呼ばれた場合, THE Test_Suite SHALL エラーをスローせずに完了することを検証する
5. WHEN `clearAnimationDraftDB` が空の DB に対して呼ばれた場合, THE Test_Suite SHALL エラーをスローせずに完了することを検証する
6. WHEN `saveAnimationBlob` で保存した後 `getAnimationBlob` で取得した場合, THE Test_Suite SHALL 保存した Blob と一致することを検証する

### Requirement 7: session_sync.js の純粋関数テスト追加

**User Story:** As a 開発者, I want session_sync.js のテスト可能な純粋ロジック部分のテストを追加したい, so that 同期ロジックの信頼性を向上できる

#### Acceptance Criteria

1. WHEN `extractLogsFromData` が空のデータ、null チャンク、有効なログチャンクで呼ばれた場合, THE Test_Suite SHALL 正しいログ配列を返すことを検証する
2. WHEN `reconstructTimeline` が空配列、重複ログ、ギャップのあるログ群で呼ばれた場合, THE Test_Suite SHALL 正しく再構築されたタイムラインを返すことを検証する
3. WHEN `mergeLogs` が空のリモートログ、overwrite=true、remoteDeletedIds 含むデータで呼ばれた場合, THE Test_Suite SHALL 正しくマージされることを検証する

### Requirement 8: 守備的エラーハンドリングの実装追加

**User Story:** As a 開発者, I want テスト追加で発見された不十分なエラーハンドリング箇所に守備的フォールバックを追加したい, so that 異常入力時にアプリケーションがクラッシュしない

#### Acceptance Criteria

1. WHEN Target_Modules の関数が予期しない型の引数（null, undefined, 不正型）を受け取った場合, THE Target_Modules SHALL 例外をスローせずにフォールバック値を返す
2. WHEN Defensive_Handling が追加された場合, THE Test_Suite SHALL 追加されたフォールバックパスをテストでカバーする
3. WHILE Defensive_Handling を追加する場合, THE Target_Modules SHALL 既存の正常系テストを破壊しない形で実装する
4. THE Target_Modules SHALL 追加されたエラーハンドリングによりブランチカバレッジの向上に貢献する

### Requirement 9: テスト品質基準

**User Story:** As a 開発者, I want 追加テストが既存のテスト規約に準拠した状態であることを保証したい, so that テストコードの一貫性と保守性を維持できる

#### Acceptance Criteria

1. THE Test_Suite SHALL テストファイルを `shared/js/**/*.test.js` の既存パターンに配置する
2. THE Test_Suite SHALL Jest + jsdom + fake-indexeddb 環境で `npm test` により全テストが pass する状態を維持する
3. THE Test_Suite SHALL `--experimental-vm-modules` フラグで ESM モジュールを正しくインポートする
4. THE Test_Suite SHALL ブランチカバレッジを 48.05% から 60% 近くまで引き上げる
5. IF テスト追加により既存テストが失敗した場合, THEN THE Test_Suite SHALL 既存テストとの互換性を維持するように修正する
