# Design Document: Branch Coverage Improvement

## Overview

本設計は、`shared/js/` 配下の7モジュール（utils.js, logic.js, schema.js, i18n.js, db.js, idb_storage.js, session_sync.js）のブランチカバレッジを 48.05% → ~60% に引き上げるためのテスト追加戦略と、守備的エラーハンドリングの実装パターンを定義する。

## Architecture

### テスト対象モジュールの依存関係

```
session_sync.js → db.js → utils.js
                → idb_storage.js
                → schema.js
logic.js → db.js → utils.js
         → i18n.js
i18n.js → messages.js
schema.js → utils.js
```

### テスト戦略の概要

テストは以下の3カテゴリに分類して実装する:

1. **純粋関数テスト** — モックなしで直接テスト可能（utils.js, logic.js の純粋関数, schema.js）
2. **環境モック付きテスト** — DOM/navigator/window モックが必要（i18n.js）
3. **IndexedDB テスト** — fake-indexeddb を使用（db.js, idb_storage.js, session_sync.js）

## Components

### テストファイル構成

```
shared/js/
├── utils.test.js          # 新規作成: utils.js のエッジケーステスト
├── logic.test.js          # 新規作成: logic.js の純粋関数テスト
├── schema.test.js         # 新規作成: schema.js のバリデーションテスト
├── i18n.test.js           # 新規作成: i18n.js のテスト
├── db.test.js             # 新規作成: db.js の IndexedDB テスト
├── idb_storage.test.js    # 新規作成: idb_storage.js のテスト
└── session_sync.test.js   # 新規作成: session_sync.js の純粋関数テスト
```

全テストファイルは新規作成とする。既存テスト（`tests/alarm_logic.test.js` 等）は変更しない。

### テスト優先順位（インパクト順）

| 優先度 | モジュール | 推定カバレッジ増加 | 理由 |
|--------|-----------|-------------------|------|
| 1 | logic.js | 高 | 最大のモジュール。generateReport の7フォーマット × オプション組み合わせで大量の分岐カバー可能 |
| 2 | schema.js | 高 | バリデーション関数群の不正入力パスが多数未カバー |
| 3 | utils.js | 中 | 型ガード分岐、parseCsvLine のクォート処理 |
| 4 | db.js | 中 | setupInitialData, cleanupOldLogs, dbImportCategories の各パス |
| 5 | i18n.js | 低〜中 | detectBrowserLanguage の各言語パス、t() のフォールバック |
| 6 | session_sync.js | 低〜中 | extractLogsFromData, reconstructTimeline の純粋関数部分 |
| 7 | idb_storage.js | 低 | シンプルな CRUD、分岐数が少ない |

## Interfaces

### テストヘルパー・共通モック

テストユーティリティは各テストファイル内にローカルで定義する（別ファイルに分離しない）。理由: テスト間の依存関係を最小化し、各テストファイルを独立して理解・実行可能にする。

#### 共通パターン: IndexedDB テスト

```javascript
// db.test.js, idb_storage.test.js で使用するパターン
import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, test, expect } from '@jest/globals';

beforeEach(async () => {
    // 各テスト前に DB をクリーンアップ
});

afterEach(() => {
    // DB 接続をクローズ
});
```

#### 共通パターン: i18n テスト

```javascript
// window.location と navigator のモック
beforeEach(() => {
    delete window.location;
    window.location = { search: '' };
    Object.defineProperty(navigator, 'language', {
        value: 'en-US',
        configurable: true,
    });
});
```

#### 共通パターン: ESM モジュールモック

```javascript
import { jest } from '@jest/globals';

// session_sync.js のテストで chrome.storage.sync をモック
jest.unstable_mockModule('./db.js', () => ({
    dbGetAll: jest.fn(),
    dbGet: jest.fn(),
    // ...
}));
```

## Data Models

### テストデータファクトリ

テストで繰り返し使用するデータ構造:

```javascript
// 有効なログエントリ
const createValidLog = (overrides = {}) => ({
    id: 1,
    syncId: 'test-uuid-1',
    category: 'Development',
    startTime: 1700000000000,
    endTime: 1700003600000,
    color: 'primary',
    tags: 'coding',
    isManualStop: false,
    updatedAt: 1700003600000,
    ...overrides,
});

// 有効なカテゴリスキーマデータ
const createValidCategory = (overrides = {}) => ({
    kind: 'QuickLogSolo/Category',
    version: '1.0',
    type: 'category',
    name: 'TestCategory',
    color: 'primary',
    ...overrides,
});

// 有効なアラームデータ
const createValidAlarm = (overrides = {}) => ({
    enabled: true,
    time: '09:00',
    message: 'Test',
    action: 'none',
    actionCategory: '',
    requireConfirmation: false,
    type: 'daily_business',
    daysOfWeek: [1, 2, 3, 4, 5],
    dayOfMonth: 1,
    daysBeforeEnd: 0,
    holidayAdjustment: 'none',
    ...overrides,
});
```

## Error Handling

### 守備的エラーハンドリング実装パターン

既存コードで発見された不十分なエラーハンドリング箇所に、以下のパターンで守備的ガードを追加する:

#### パターン1: 型ガード（既存）

```javascript
// utils.js: escapeHtml, escapeTsv, escapeCsv は既に実装済み
export function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    // ...
}
```

#### パターン2: Falsy ガード（既存）

```javascript
// logic.js: stripEmojis は既に実装済み
export function stripEmojis(str) {
    if (!str) return '';
    // ...
}
```

#### パターン3: 追加が必要な守備的ハンドリング

テスト追加の過程で以下の箇所にガードが必要と判明した場合に追加する:

```javascript
// 例: generateReport で空ログの場合
// prepareReportItems が空配列を返す → 各フォーマッタが空配列を受け取る
// 現状: items.map() が空配列で [] を返すため問題なし

// 例: calculateTagAggregation で null ログの場合
// 現状: logs.forEach で l.category を参照 → l が null なら TypeError
// 対策: if (!l) return; をフィルタ処理に追加
```

**実装原則:**
- 例外をスローしない。フォールバック値（空配列、空文字列、null、0）を返す
- 既存の正常系動作を変更しない
- ガード追加は関数の先頭で行い、早期リターンパターンを使用する

## Testing Strategy

### Property-Based Testing (fast-check)

プロジェクトには既に `@fast-check/jest` と `fast-check` が devDependencies に含まれている。以下のプロパティテストを実装する:

```javascript
import { fc, test as fcTest } from '@fast-check/jest';

// 例: escape 関数の型ガードプロパティ
fcTest.prop([fc.oneof(fc.integer(), fc.constant(null), fc.constant(undefined), fc.object())])(
    'escapeHtml は非文字列をそのまま返す',
    (val) => {
        expect(escapeHtml(val)).toBe(val);
    }
);
```

### Example-Based Testing (Jest)

```javascript
// 例: generateReport のフォーマット別テスト
describe('generateReport', () => {
    test('csv フォーマットで正しいヘッダーと行を出力する', () => {
        const logs = [createValidLog()];
        const result = generateReport(logs, { format: 'csv', endTime: 'show', duration: 'right', emoji: 'keep', adjust: 'none' });
        expect(result).toContain('startTime,endTime,category,duration');
    });
});
```

### テスト実行コマンド

```bash
# 全テスト実行
npm test

# 特定モジュールのみ
node --experimental-vm-modules ./node_modules/.bin/jest shared/js/utils.test.js

# カバレッジ付き
node --experimental-vm-modules ./node_modules/.bin/jest --coverage
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Escape 関数の型ガード恒等性

*For any* non-string value (null, undefined, number, object, array), the escape functions (escapeHtml, escapeTsv, escapeCsv) SHALL return the input value unchanged.

**Validates: Requirements 1.1, 1.2, 1.3, 8.1**

### Property 2: 無効なカテゴリ名の拒否

*For any* string that is empty (after trimming), exceeds 50 characters, equals a system category constant (__IDLE__, __UNKNOWN__), or starts with __PAGE_BREAK__, isValidCategoryName SHALL return false. Additionally, *for any* non-string value, isValidCategoryName SHALL return false.

**Validates: Requirements 1.4**

### Property 3: CSV ラウンドトリップ

*For any* array of strings (containing no unescaped newlines), joining with escapeCsv and comma then parsing with parseCsvLine SHALL produce the original strings (after trimming).

**Validates: Requirements 1.5**

### Property 4: generateDuplicateName のサフィックス増分

*For any* base name and existing names list containing entries with numeric suffixes `(n)`, generateDuplicateName SHALL return a name with suffix `(max_n + 1)` where max_n is the highest existing suffix number.

**Validates: Requirements 1.6**

### Property 5: floorToMinute の分境界プロパティ

*For any* non-negative number ms, floorToMinute(ms) SHALL be a multiple of 60000 AND floorToMinute(ms) <= ms AND ms - floorToMinute(ms) < 60000.

**Validates: Requirements 1.8**

### Property 6: formatDuration のフォーマット不変量

*For any* non-negative integer ms, formatDuration(ms) SHALL match the pattern /^\d{2}:\d{2}:\d{2}$/ and the encoded hours, minutes, seconds SHALL correctly decompose ms.

**Validates: Requirements 2.1**

### Property 7: calculateTagAggregation のスキップ条件

*For any* log that satisfies one of: isManualStop === true, category is a system category (__IDLE__, __UNKNOWN__, starts with __PAGE_BREAK__), endTime is missing, or (endTime - startTime) <= 0, calculateTagAggregation SHALL exclude it from totalWorkDuration.

**Validates: Requirements 2.3**

### Property 8: stripEmojis の ASCII 恒等性

*For any* string composed entirely of ASCII printable characters (0x20-0x7E), stripEmojis SHALL return the same string (identity). Additionally, *for any* falsy value, stripEmojis SHALL return empty string ''.

**Validates: Requirements 2.4**

### Property 9: getVisualWidth の下限プロパティ

*For any* non-empty string, getVisualWidth SHALL return a value >= string.length. *For any* string composed entirely of ASCII characters (0x00-0xFF) or half-width katakana (0xFF61-0xFF9F), getVisualWidth SHALL equal string.length.

**Validates: Requirements 2.5**

### Property 10: generateReport の未知フォーマット拒否

*For any* format string that is not one of the supported formats (csv, tsv, html, markdown, wiki, text-plain, text-table), generateReport SHALL return empty string ''.

**Validates: Requirements 2.6**

### Property 11: calculateNextAlarmTime の無効アラーム null 保証

*For any* alarm with enabled === false OR time === '', calculateNextAlarmTime SHALL return null regardless of other parameters.

**Validates: Requirements 2.8**

### Property 12: スキーマバリデーションの null/非オブジェクト拒否

*For any* value that is null, undefined, a number, a string, an array, or a boolean, all schema validation functions (validateCategorySchema, validateHistorySchema, validateSettingsSchema, validateAlarmSchema, validateCustomAnimationSchema) SHALL return false.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 13: setLanguage の未知言語フォールバック

*For any* string that is not a supported language code ('ja', 'en', 'de', 'es', 'fr', 'pt', 'ko', 'zh') and is not 'auto', setLanguage SHALL set the current language to 'en'.

**Validates: Requirements 4.3**

### Property 14: detectBrowserLanguage の lang パラメータ優先

*For any* supported language code, when window.location.search contains `?lang={code}`, detectBrowserLanguage SHALL return that code.

**Validates: Requirements 4.1**

### Property 15: dbImportCategories overwrite モードの冪等性

*For any* valid category list, after dbImportCategories with overwrite mode, the categories store SHALL contain exactly the imported items (previous data is cleared).

**Validates: Requirements 5.5**

### Property 16: Blob ストレージのラウンドトリップ

*For any* valid animation ID and Blob, saveAnimationBlob then getAnimationBlob SHALL return a Blob with identical content.

**Validates: Requirements 6.6**

### Property 17: extractLogsFromData のチャンク結合

*For any* data object containing LOG_CHUNKS chunks, extractLogsFromData SHALL return an array whose length equals the sum of all chunk array lengths.

**Validates: Requirements 7.1**

### Property 18: reconstructTimeline の順序不変量

*For any* non-empty set of logs passed to reconstructTimeline, the output SHALL be sorted by startTime in ascending order, and no two entries shall have overlapping time ranges (startTime_i < endTime_i <= startTime_{i+1}).

**Validates: Requirements 7.2**
