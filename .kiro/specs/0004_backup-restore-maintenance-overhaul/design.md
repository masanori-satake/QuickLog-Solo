# 設計書: バックアップ・リストア・メンテナンス機能のオーバーホール

## Overview

本設計書は、QuickLog-Solo v1.14.2 以降のバックアップ・リストア・メンテナンス機能のオーバーホールを対象とする。主要な変更は以下の 6 点である。

1. **バックアップ対象の拡張** — アラーム設定・カスタムアニメーション（GIF Blob + メタデータ）を追加
2. **スキーマ v2.0 の導入** — 後方互換性を保ちつつ、新ファイル形式を定義
3. **リストア機能の追加** — 全消去→上書き方式の完全復元
4. **タブ統合** — 「バックアップ」タブを廃止し「メンテナンス」タブに統合
5. **削除/初期化 UI の刷新** — チェックボックス＋実行ボタン方式
6. **カスタムアニメーション同期** — `chrome.storage.sync` への Base64 チャンク分割同期

### 設計の制約

- Vanilla JS (ES Modules) のみ使用。外部ライブラリ禁止
- `innerHTML` 禁止、`textContent` を徹底する
- CSS 変数は `body` に定義
- アセット参照はすべて相対パス（先頭スラッシュなし）
- `projects/app/` または `shared/` の変更は `npm run version:bump` 必須
- SLAP 原則: `app.js` は高レベル呼び出しのみ、ロジックは `shared/js/` に集約


## Architecture

### 全体構成

```
UI層 (projects/app/js/app.js)
  ↓ UI イベント処理・表示制御
ロジック層
  ├── projects/app/js/backup.js     … BackupManager（既存・拡張）
  ├── projects/app/js/restore.js    … RestoreManager（新規）
  └── shared/js/anim_sync.js        … AnimationSyncManager（新規）
  ↓
データ層
  ├── shared/js/db.js               … QuickLogSoloDB (IndexedDB)
  ├── shared/js/idb_storage.js      … QuickLogAnimationDB (IndexedDB)
  ├── shared/js/schema.js           … スキーマ検証（拡張）
  └── shared/js/utils/storage.js    … chrome.storage.local（メタデータ）
  ↓
ストレージ
  ├── IndexedDB: QuickLogSoloDB     … logs / categories / settings / alarms
  ├── IndexedDB: QuickLogAnimationDB … Blob ストア
  ├── chrome.storage.local          … custom_animation_metadata_map
  └── chrome.storage.sync           … 端末間同期（アニメーションチャンク含む）
```

### データフロー

#### バックアップ（書き出し）

```
IndexedDB (QuickLogSoloDB)
  → BackupManager.backupToFiles()
    → ql_categories.ndjson   (SCHEMA_VERSION_1_0 を維持)
    → ql_settings.json       (version: '2.0')
    → history/YYYY-MM-DD.ndjson (SCHEMA_VERSION_1_0 を維持)
    → ql_alarms.json         (version: '2.0', kind: 'QuickLogSolo/Alarm')    ★新規
    → ql_custom_animations.json (version: '2.0')                             ★新規

IndexedDB (QuickLogAnimationDB)
  → BackupManager.backupToFiles()
    → animations/{id}.gif                                                     ★新規
```

#### リストア（読み込み・全消去上書き）

```
ローカルファイルシステム（フォルダ）
  → RestoreManager.restoreFromDirectory()
    → 確認ダイアログ（全消去警告）
    → 全ファイルの読み込みとバリデーション（clear 前に完了）
    → QuickLogSoloDB の全ストアを clear()
    → QuickLogAnimationDB の Blob ストアを clear()
    → 依存順序に従った書き込み:
      1. カスタムアニメーション (QuickLogAnimationDB Blob + chrome.storage.local メタデータ) — 誰にも依存しない
      2. カテゴリ (STORE_CATEGORIES) — アニメーション ID を参照するため 1 の後
      3. 設定 (STORE_SETTINGS) — defaultAnimation がカスタムアニメーション ID を参照する可能性あり
      4. アラーム (STORE_ALARMS) — actionCategory でカテゴリ名を参照するため 2 の後
      5. 作業履歴 (STORE_LOGS) — category でカテゴリ名を参照するため 2 の後
    → location.reload()
```

#### 依存関係グラフ

```
カスタムアニメーション (QuickLogAnimationDB + chrome.storage.local メタデータ)
  ↑ 参照される（category.animation フィールド）
カテゴリ (STORE_CATEGORIES)
  ↑ 参照される（alarm.actionCategory / log.category フィールド）
アラーム (STORE_ALARMS) — actionCategory でカテゴリ名を参照
作業履歴 (STORE_LOGS) — category でカテゴリ名を参照

設定 (STORE_SETTINGS) — defaultAnimation でアニメーション ID を参照（カスタムアニメーション後に復元）
```


## Components and Interfaces

### 1. BackupManager（拡張: `projects/app/js/backup.js`）

既存クラスを拡張し、アラームとカスタムアニメーションをバックアップ対象に追加する。

```javascript
class BackupManager {
    // 既存メソッド（変更なし）
    async init()
    async hasPermission()
    async requestPermission()
    async setDirectory(handle)
    async sync()            // 内部で backupToFiles() を呼ぶ（restoreFromFiles は廃止）

    // 拡張メソッド
    async backupToFiles()   // ql_alarms.json / ql_custom_animations.json / animations/{id}.gif を追加
    async cleanupOldFiles() // history/ サブディレクトリ内の古い日別NDJSONを削除
    async getFileCount()    // history/ サブディレクトリ内のファイル数を返す

    // 内部ヘルパー
    async _backupAlarms()
    async _backupCustomAnimations()
    async _writeCustomAnimationBlob(id, blob)
    async _ensureSubDirectory(parentHandle, dirName) // サブディレクトリの作成/取得
}
```

**変更点:**
- `restoreFromFiles()` をマージ復元として維持しつつ、完全復元は `RestoreManager` に委譲
- `sync()` は「バックアップを実行する」ボタン押下時の書き出しのみを担当（マージ復元は廃止）
- `backupToFiles()` に `_backupAlarms()` と `_backupCustomAnimations()` を追加
- `backupToFiles()` で `history/` サブディレクトリを作成して日別 NDJSON を格納
- `backupToFiles()` で `animations/` サブディレクトリを作成して GIF を格納
- トップレベルファイルに `ql_` プレフィックスを付与
- `cleanupOldFiles()` は `history/` サブディレクトリ内のファイルを対象にクリーンアップ
- `getFileCount()` は `history/` サブディレクトリ内のファイルをカウント

### 2. RestoreManager（新規: `projects/app/js/restore.js`）

バックアップフォルダからの完全復元を担う新規クラス。

```javascript
class RestoreManager {
    /**
     * バックアップフォルダを選択し、全消去→書き込みの完全復元を実行する
     * @param {Function} showConfirm - 確認ダイアログを表示するコールバック
     * @param {Function} showToast   - トースト通知コールバック
     * @param {Function} t           - i18n 翻訳関数
     */
    async restoreFromDirectory(showConfirm, showToast, t)

    // 内部ヘルパー
    async _readAndValidateBackupFolder(dirHandle)  // 新旧両方のファイル名を探索
    async _restoreCategories(dirHandle)
    async _restoreSettings(dirHandle)
    async _restoreLogs(dirHandle)
    async _restoreAlarms(dirHandle)
    async _restoreCustomAnimations(dirHandle)
    async _clearAllStores()                         // 全ストアを clear()
    async _resolveFileWithFallback(dirHandle, newName, legacyName) // フォールバック付きファイル解決
}

export const restoreManager = new RestoreManager();
```

**復元順序の制約（依存関係を考慮した固定順序）:**

カテゴリのアニメーション項目がカスタムアニメーション ID を参照し、設定の `defaultAnimation` もカスタムアニメーション ID を参照するため、依存されるデータを先に復元する。

| 順序 | 対象 | 理由 |
|------|------|------|
| 1 | カスタムアニメーション（Blob + メタデータ） | 誰にも依存しない。カテゴリ・設定から参照される |
| 2 | カテゴリ（`STORE_CATEGORIES`） | アニメーション ID を参照。アラーム・作業履歴から参照される |
| 3 | 設定（`STORE_SETTINGS`） | `defaultAnimation` がカスタムアニメーション ID を参照する可能性あり |
| 4 | アラーム（`STORE_ALARMS`） | `actionCategory` がカテゴリ名を参照 |
| 5 | 作業履歴（`STORE_LOGS`） | `category` がカテゴリ名を参照 |

リストアは全消去→書き込みなので、全データが揃ってから一括で書く。この依存順序を守ればカテゴリが参照するアニメーションが必ず存在し、設定の `defaultAnimation` も解決可能になる。

**フォールバック動作:**
- Sync はインクリメンタルなので、アニメーション同期が完了する前にカテゴリが適用される可能性がある。その場合、カテゴリの `animation` フィールドが指す ID が `QuickLogAnimationDB` に存在しなくても、既存の `applyAnimation()` ロジックが `'default'` アニメーションにフォールバックするため、表示上の不具合は発生しない
- アラームの `actionCategory` が指すカテゴリが復元前の状態でも、アラーム発火時にカテゴリを名前で検索するため、次回 Sync 完了時に解決される

**設計判断:**
- `restoreFromDirectory()` はフォルダ選択ダイアログの表示から reload まで一貫して担当する
- `restoreFromDirectory()` 内で上記順序 1→5 を固定実装する
- `_restoreCustomAnimations()` を復元処理の最初に呼び出すよう順序を固定する
- ロールバックは保証しない（要件 3.11 に明記）。ただし clear 前にバリデーションを完了させることで整合性リスクを最小化する
- `showConfirm` / `showToast` は `app.js` から DI することで UI 依存を排除し、テスト容易性を確保
- `_readAndValidateBackupFolder()` は新旧両方のファイル名を探索する:
  - `ql_categories.ndjson` → フォールバック: `categories.ndjson`
  - `ql_settings.json` → フォールバック: `settings.json`
  - `history/` サブディレクトリ内とルート直下の両方の日別 NDJSON を探索
- `_resolveFileWithFallback()` は新ファイル名を優先し、不在なら旧ファイル名を試行する汎用ヘルパー

### 3. AnimationSyncManager（新規: `shared/js/anim_sync.js`）

カスタムアニメーションの `chrome.storage.sync` への分割同期を担う新規モジュール。

```javascript
// Base64 文字列を maxSize 以下のチャンクに分割する純粋関数
export function splitIntoChunks(base64String, maxSize = 6000)

// チャンク配列を結合して元の Base64 文字列に戻す純粋関数
export function joinChunks(chunks)

// アニメーションキー名を生成する純粋関数
export function animChunkKey(animationId, chunkIndex)

// sync への書き込み（3 回リトライ付き）
export async function pushAnimationToSync(animationId, base64, onProgress)

// sync からの読み込みと Blob 再構築
export async function pullAnimationsFromSync(syncData)

// sync から特定アニメーションのチャンクを削除
export async function removeAnimationFromSync(animationId)

// 端末間同期無効化時に全アニメーションチャンクを削除
export async function clearAllAnimationChunksFromSync()
```

**設計判断:**
- `splitIntoChunks` と `joinChunks` は純粋関数として実装し、property-based test で検証する
- `onProgress` コールバックにより進捗を UI 層に通知する（`AnimationSyncManager` はDOM を持たない）
- リトライは指数バックオフなしの固定 3 回（シンプルさを優先）
- chrome.storage.sync の容量超過は `QUOTA_BYTES_PER_ITEM` エラーで検出する


### 4. Schema_Validator（拡張: `shared/js/schema.js`）

スキーマ v2.0 の定義と新しいバリデーション関数を追加する。

```javascript
// 新規エクスポート定数
export const SCHEMA_VERSION_2_0 = '2.0';
export const SCHEMA_KIND_ALARM = 'QuickLogSolo/Alarm';
export const SCHEMA_KIND_CUSTOM_ANIMATION = 'QuickLogSolo/CustomAnimation';

// 新規バリデーション関数
export function validateAlarmSchema(data)           // アラームオブジェクト1件を検証
export function validateCustomAnimationSchema(data) // カスタムアニメーションメタデータ1件を検証

// 後方互換性: 既存関数はそのまま維持
export function validateCategorySchema(data)   // v1.0 のみ対応（変更なし）
export function validateHistorySchema(data)    // v1.0 のみ対応（変更なし）
export function validateSettingsSchema(data)   // v1.0 のみ対応（変更なし）
```

**バージョン管理方針:**
- 既存の `validateCategorySchema` / `validateHistorySchema` は `version === SCHEMA_VERSION_1_0` を要求しており、変更しない
- `validateAlarmSchema` / `validateCustomAnimationSchema` は `version === SCHEMA_VERSION_2_0` を要求する
- `validateSettingsSchema` は `version` フィールドを内部で `1.0` か `2.0` の両方を受け入れるよう拡張する

### 5. Maintenance_UI（変更: `projects/app/app.html` + `projects/app/js/app.js`）

#### タブ構成変更

| 変更前 | 変更後 |
|--------|--------|
| 一般 / カテゴリ / アラーム / メンテナンス / **バックアップ** / 情報 (6タブ) | 一般 / カテゴリ / アラーム / **メンテナンス** / 情報 (5タブ) |

「バックアップ」タブの内容を「メンテナンス」タブに統合する。

#### メンテナンスタブのレイアウト

```
[メンテナンスタブ]
  ── バックアップ・リストアセクション ─────────────────────
  [バックアップを実行する] ← 保存先設定済み時のみ表示
  [バックアップ先を指定する] ← 保存先設定済み時のみ表示
  [バックアップを開始する] ← 保存先未設定時のみ表示
  [復元する] ← 常に表示
  現在の保存先: {ディレクトリ名}
  最終バックアップ: {日時}  ファイル数: {N}日分

  ── 削除/初期化セクション ────────────────────────────────
  □ 作業履歴    □ カテゴリ    □ 設定
  □ アラーム    □ カスタムアニメーション
  [削除/初期化する] ← 1件以上選択時のみ有効

  ── 端末間同期メンテナンス（同期有効時のみ表示） ──────────
  [同期履歴の再取得]
  [全同期デバイスから履歴をすべて削除]
```

#### 削除対象と対応するストア

| チェックボックス | 消去対象 |
|----------------|---------|
| 作業履歴 | `QuickLogSoloDB` の `STORE_LOGS` |
| カテゴリ | `QuickLogSoloDB` の `STORE_CATEGORIES` |
| 設定 | `QuickLogSoloDB` の `STORE_SETTINGS` |
| アラーム | `QuickLogSoloDB` の `STORE_ALARMS` |
| カスタムアニメーション | `QuickLogAnimationDB` の `blobs` ストア + `chrome.storage.local` の `custom_animation_metadata_map` |


## Data Models

### バックアップディレクトリ構造とファイル命名規則

#### ディレクトリ構造

バックアップフォルダ内は以下のサブディレクトリ構造で整理する：

```
{バックアップフォルダ}/
├── ql_categories.ndjson          ← カテゴリ（既存: categories.ndjson からリネーム）
├── ql_settings.json              ← 設定（既存: settings.json からリネーム）
├── ql_alarms.json                ← アラーム（新規）
├── ql_custom_animations.json     ← カスタムアニメーション メタデータ（新規）
├── history/                      ← 作業履歴サブディレクトリ
│   ├── 2025-01-15.ndjson
│   ├── 2025-01-16.ndjson
│   └── ...
└── animations/                   ← カスタムアニメーション GIF サブディレクトリ
    ├── {id}.gif
    └── ...
```

#### ファイル命名規則

1. **統一プレフィックス `ql_`**: すべてのトップレベル設定ファイルに `ql_` プレフィックスを付与し、QuickLog-Solo のバックアップデータであることを一目で識別可能にする
2. **履歴ファイル**: `history/` サブディレクトリ内に `YYYY-MM-DD.ndjson` 形式で格納する（これまでのフラット配置から変更）
3. **カスタムアニメーション GIF**: `animations/` サブディレクトリ内に `{id}.gif` として格納する（UUID がファイル名）
4. **カスタムアニメーションメタデータ**: `ql_custom_animations.json` としてトップレベルに配置（中身のメタデータで各 GIF との対応関係が明確）

#### 後方互換性（マイグレーション）

リストア時に旧フォルダ構造（v1.14.2 以前）のバックアップを読み込む際のフォールバック：

| 新ファイル名/パス | フォールバック（旧形式） | 備考 |
|------------------|------------------------|------|
| `ql_categories.ndjson` | `categories.ndjson` | 新ファイルが存在しない場合に旧名を読む |
| `ql_settings.json` | `settings.json` | 新ファイルが存在しない場合に旧名を読む |
| `history/YYYY-MM-DD.ndjson` | ルート直下の `YYYY-MM-DD.ndjson` | サブディレクトリ内に存在しない場合にルートをフォールバック |
| `ql_alarms.json` | （不在はスキップ） | v1.14.2 には存在しないため |
| `animations/{id}.gif` | （不在はスキップ） | v1.14.2 には存在しないため |

#### 設計判断

- **なぜサブディレクトリを使うか**: GIF ファイルが増えるとルートが乱雑になる。`animations/` に隔離することで、設定ファイルと明確に分離される。`history/` もファイル数が多い（最大 40 日分）ため隔離する。
- **なぜ `ql_` プレフィックスか**: バックアップフォルダを他の用途と共用する場合、QuickLog-Solo のファイルを即座に識別できる。また、エクスプローラで名前順ソートすると `ql_` で始まるファイルがグループ化される。
- **GIF のファイル名が UUID のみである理由**: メタデータ JSON 内で ID と名前のマッピングが管理されているため、ファイル名に名前を含めると同期の問題（名前変更時のファイル名不一致）が生じる。

### バックアップファイル形式

#### `ql_alarms.json`（新規）

```json
{
  "app": "QuickLog-Solo",
  "kind": "QuickLogSolo/Alarm",
  "version": "2.0",
  "entries": [
    {
      "enabled": true,
      "time": "23:59",
      "message": "Stop Task",
      "action": "stop",
      "actionCategory": "",
      "requireConfirmation": false,
      "type": "daily_business",
      "daysOfWeek": [1, 2, 3, 4, 5],
      "dayOfMonth": 1,
      "daysBeforeEnd": 0,
      "holidayAdjustment": "none",
      "order": 9
    }
  ]
}
```

#### `ql_custom_animations.json`（新規）

```json
{
  "app": "QuickLog-Solo",
  "kind": "QuickLogSolo/CustomAnimation",
  "version": "2.0",
  "entries": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Animation",
      "description": "Custom wave effect",
      "config": { "exclusionStrategy": "freedom" },
      "renderSpec": { "type": "gif", "fps": 30 },
      "createdAt": 1700000000000
    }
  ]
}
```

#### `animations/{id}.gif`（新規）

各カスタムアニメーションの GIF バイナリを `animations/` サブディレクトリ内に個別ファイルとして書き出す。ファイル名は UUID + `.gif`。

#### `ql_settings.json`（変更: version を `'2.0'` に更新）

```json
{
  "app": "QuickLog-Solo",
  "kind": "QuickLogSolo/Settings",
  "version": "2.0",
  "entries": [ ... ]
}
```

**後方互換性:** `ql_settings.json` の `version` フィールドを `validateSettingsSchema` で `'1.0'` と `'2.0'` の両方受け入れるよう変更する。

#### `ql_categories.ndjson` / `history/YYYY-MM-DD.ndjson`（変更なし）

既存の `version: '1.0'` 形式を維持する。新しいバックアップでも引き続き `SCHEMA_VERSION_1_0` を使用する。カテゴリは `ql_categories.ndjson` にリネーム、履歴ファイルは `history/` サブディレクトリに移動する。

### `chrome.storage.sync` のアニメーションチャンクキー

```
anim_chunk_{animationId}_{chunkIndex}
```

例: `anim_chunk_550e8400-e29b-41d4-a716-446655440000_0`

各チャンクの値は Base64 文字列で 6,000 文字以下。

### `validateAlarmSchema` の検証対象フィールド

| フィールド | 型 | 検証ルール |
|-----------|-----|----------|
| `kind` | string | `'QuickLogSolo/Alarm'` と一致 |
| `version` | string | `'2.0'` と一致 |
| `enabled` | boolean | 必須 |
| `time` | string | `/^([01]\d\|2[0-3]):([0-5]\d)$/` にマッチ |
| `message` | string | 200文字以下 |
| `action` | string | `'none' \| 'stop' \| 'pause' \| 'start'` |
| `actionCategory` | string | 100文字以下 |
| `requireConfirmation` | boolean | 必須 |
| `type` | string | `'daily_business' \| 'weekly' \| 'monthly_date' \| 'monthly_end_relative'` |
| `daysOfWeek` | number[] | 0〜6 の値のみ |
| `dayOfMonth` | number | 1〜31 |
| `daysBeforeEnd` | number | 0〜31 |
| `holidayAdjustment` | string | `'none' \| 'prev_business_day' \| 'next_business_day' \| 'skip'` |

### `validateCustomAnimationSchema` の検証対象フィールド

| フィールド | 型 | 検証ルール |
|-----------|-----|----------|
| `kind` | string | `'QuickLogSolo/CustomAnimation'` と一致 |
| `version` | string | `'2.0'` と一致 |
| `id` | string | UUID 形式、1〜50文字 |
| `name` | string | 1〜100文字 |
| `description` | string \| undefined | 500文字以下 |
| `config` | object | 必須 |
| `renderSpec` | object | 必須 |


## Correctness Properties

*プロパティとは、システムのすべての有効な実行において成立すべき特性または振る舞いのことであり、人間が読める仕様と機械によって検証可能な正確性の保証をつなぐ形式的な記述である。*

### プレワーク分析（Property Reflection）

プレワーク分析で識別されたプロパティ候補を整理する。

- **P-A**: 任意のアラーム配列 → `ql_alarms.json` のエントリーが一致（要件 1.1）
- **P-B**: 任意のメタデータマップ → `ql_custom_animations.json` が一致（要件 1.2）
- **P-C**: 任意の Blob セット → ファイル名が `animations/{id}.gif` 形式（要件 1.3）
- **P-D**: 2 回バックアップを実行しても結果が同一（冪等性）（要件 1.5）
- **P-E**: 任意の有効なバックアップデータに対して `version` フィールドが `'2.0'`（要件 2.1）
- **P-F**: 有効なアラームオブジェクトは `validateAlarmSchema` で `true`（要件 2.2）
- **P-G**: 不正なバージョン値は `validateAlarmSchema` / `validateCustomAnimationSchema` で `false`（要件 2.6）
- **P-H**: バックアップ→全消去→復元後の DB 内容がバックアップデータと等しい（要件 3.4）
- **P-I**: チェックボックス選択数 > 0 の場合のみ実行ボタンが enabled（要件 5.2）
- **P-J**: チェックボックス選択セットに対応するストアのみが消去される（要件 5.4）
- **P-K**: 任意の Base64 文字列をチャンク分割後、各チャンクが 6,000 文字以下（要件 6.1）
- **P-L**: 分割後に結合すると元の Base64 文字列に戻る（round-trip）（要件 6.6）
- **P-M**: 常にエラーのモック API に対してリトライが正確に 3 回（要件 6.4）

**Reflection（冗長性の排除）:**
- P-A と P-B は「任意の入力データがバックアップファイルに正確に反映される」という同一の構造を持つ。ただし対象が異なるため（アラーム vs メタデータ）、それぞれ独立したプロパティとして維持する。
- P-E（version='2.0'）は P-A / P-B の一部として包含できる。バックアップファイルの内容一致テストに version フィールドの検証を含めることで P-E を P-A / P-B に統合する。
- P-K と P-L はチャンク分割の round-trip として統合できる。「分割後、各チャンクが 6,000 文字以下かつ結合すると元に戻る」という単一プロパティで両方を網羅する。
- P-F と P-G はバリデーション関数の正確性として統合できる（valid → true、invalid → false）。

統合後のプロパティ一覧: **P1～P7**

---

### Property 1: バックアップのアラームデータ整合性

*任意の* アラーム配列に対して `_backupAlarms()` を実行すると、生成された `ql_alarms.json` の `entries` フィールドが入力のアラーム配列と等しく、`version` が `'2.0'` であり、`kind` が `'QuickLogSolo/Alarm'` である。

**Validates: Requirements 1.1, 2.1**

---

### Property 2: バックアップのカスタムアニメーションメタデータ整合性

*任意の* カスタムアニメーションメタデータマップに対して `_backupCustomAnimations()` を実行すると、生成された `ql_custom_animations.json` の `entries` フィールドがメタデータマップの全エントリーを含み、`version` が `'2.0'` であり、`kind` が `'QuickLogSolo/CustomAnimation'` である。

**Validates: Requirements 1.2, 2.1**

---

### Property 3: バックアップの冪等性

*任意の* 有効なデータセットに対して、バックアップを 1 回実行した後のファイル内容と 2 回実行した後のファイル内容が等しい（2回目の実行は1回目の結果を上書きするが同一内容になる）。

**Validates: Requirements 1.5**

---

### Property 4: アラーム・カスタムアニメーションスキーマバリデーションの正確性

*任意の* 有効なアラームオブジェクト（すべての必須フィールドが正しい型と値を持つ）に対して `validateAlarmSchema` は `true` を返す。*任意の* 不正なバージョン値（`'1.0'`・`null`・`undefined`・`''`・`'3.0'` 等）を持つオブジェクトに対して `validateAlarmSchema` および `validateCustomAnimationSchema` は `false` を返す。

**Validates: Requirements 2.2, 2.3, 2.6**

---

### Property 5: バックアップ・リストア round-trip

*任意の* 有効なバックアップデータセット（categories / settings / logs / alarms）に対して、バックアップ実行後に全ストアを clear し、リストアを実行すると、復元後の IndexedDB の内容がバックアップデータと意味的に等しい（`id` などの自動採番フィールドを除く）。

**Validates: Requirements 3.4**

---

### Property 6: チェックボックス選択状態と実行ボタンの有効状態の一致

*任意の* チェックボックス選択状態に対して、選択されたチェックボックスの数が 0 の場合に実行ボタンが `disabled`、1 以上の場合に `enabled` である。

**Validates: Requirements 5.2**

---

### Property 7: チャンク分割の round-trip と上限保証

*任意の* Base64 文字列に対して `splitIntoChunks(base64, 6000)` を実行すると、すべてのチャンクの長さが 6,000 文字以下であり、かつ `joinChunks(splitIntoChunks(base64, 6000)) === base64` が成立する。

**Validates: Requirements 6.1, 6.6**


## Error Handling

### BackupManager のエラー処理

| エラー箇所 | 処理方針 | 状態遷移 |
|-----------|---------|---------|
| `STORE_ALARMS` 読み取り失敗 | エラーメッセージをトーストで表示 | `FAILED` |
| `QuickLogAnimationDB` Blob 読み取り失敗 | エラーメッセージをトーストで表示 | `FAILED` |
| ファイル書き込みエラー（`createWritable` 等） | エラーメッセージをトーストで表示、部分書き込みはそのまま残す | `FAILED` |
| `readwrite` 権限が `granted` でない | `_updateStatus()` で `FAILED` に設定 | `FAILED` |
| 0バイトファイル検出 | 既存の `backup-err-0byte` 確認ダイアログを表示 | ユーザー選択によりAbort |
| バックアップ完了 | `lastBackupTime` を更新 | `SUCCESS` |

**設計判断:** バックアップ完了時刻は `backupToFiles()` と `cleanupOldFiles()` の両方が成功した後のみ更新する（要件 7.1）。

### RestoreManager のエラー処理

| エラー箇所 | 処理方針 |
|-----------|---------|
| フォルダ選択キャンセル（`AbortError`） | データ変更なし、エラー表示なし、静かに中断 |
| 確認ダイアログのキャンセル | データ変更なし、チェックボックス状態を維持 |
| `ql_categories.ndjson`（または `categories.ndjson`）と `ql_settings.json`（または `settings.json`）の両方が存在しない | エラーメッセージを表示して中断 |
| JSON パース失敗 | エラーメッセージを表示してIndexedDB書き込みをスキップ |
| スキーマバリデーション失敗レコード | スキップしてスキップ件数をUI表示、正常レコードは復元を継続 |
| IndexedDB 書き込み失敗 | エラーメッセージを表示して復元を中断（ロールバックは行わない） |
| アラームファイルが存在しない（v1.x バックアップ） | 空配列として扱い処理続行（エラーなし） |
| GIF ファイルが存在しない | そのアニメーションの復元をスキップ（他は継続） |

**設計判断:** `restoreFromDirectory()` は full clear の前にすべてのファイルの読み込みとバリデーションを完了させる。バリデーション通過後にのみ clear を実行することで、読み込みエラー起因の空DB状態を防ぐ。

### AnimationSyncManager のエラー処理

| エラー箇所 | 処理方針 |
|-----------|---------|
| `chrome.storage.sync.set` の `QUOTA_BYTES_PER_ITEM` エラー | 容量超過をユーザーに通知、そのアニメーションの書き込みをスキップ |
| `chrome.storage.sync` のその他のエラー | 最大 3 回リトライ、3 回失敗後にエラー状態を通知 |
| Base64 変換失敗（不正な Blob） | エラーメッセージをトーストで表示、そのアニメーションをスキップ |

### 削除/初期化 UI のエラー処理

| エラー箇所 | 処理方針 |
|-----------|---------|
| ストアの `clear()` 失敗 | エラーが発生した項目名を含むエラーメッセージを表示、処理を中断 |
| 実行中の二重クリック | 実行中は実行ボタンを `disabled` にして防止 |

### i18n フォールバック

対応する翻訳が未定義の言語では `en`（英語）翻訳をフォールバックとして使用する。これは既存の `t()` 関数の仕様に準拠している。


## v1.14.2 後方互換性保証

### 確認済みの前提

| 項目 | 前提 |
|------|------|
| IndexedDB | 既存データはそのまま残る。`DB_VERSION` は変更しない。オブジェクトストア構造に変更なし |
| chrome.storage.sync | 同期端末はすべて同時にアップデートされることを前提。v1.14.2 と新バージョンの混在は考慮不要 |
| backupDirectoryHandle | IndexedDB 内に保存済みのハンドルはそのまま引き継がれ、メンテナンスタブで「保存先設定済み」として認識される |
| CSV エクスポート/インポート廃止 | CSV ファイルからの復元手段は不要（バックアップ機能が全データをカバー） |

### アップデート時の動作保証

v1.14.2 のユーザーが新バージョンにアップデートした際に、以下が自動的に成立する：

1. **IndexedDB データ**: 既存の作業履歴・カテゴリ・設定・アラームは変更されずそのまま利用可能
2. **backupDirectoryHandle**: 既に設定済みの場合、メンテナンスタブを開いた際に「保存先設定済み」UI が表示される
3. **chrome.storage.sync**: 既存の同期データ（categories / alarms / settings / logs チャンク）はそのまま機能し続ける。新しい `anim_chunk_` キーは存在しないため、アニメーション同期は「0件」として扱われる
4. **バックアップファイル**: v1.14.2 で作成された旧フォルダ構造のバックアップは、リストア時にフォールバック読み込みで正常に復元可能
5. **UI**: 「バックアップ」タブは廃止されるが、同等の機能はすべて「メンテナンス」タブに移行しているため機能欠落なし
6. **マイグレーション不要**: DB バージョンアップやデータ変換等の自動マイグレーション処理は不要
7. **QuickLogAnimationDB**: v1.14.2 にはこの DB が存在しないが、新バージョンの `initAnimationDB()` が自動的に作成するため問題なし

### テスト観点（v1.14.2 互換性テスト）

以下のテストシナリオで後方互換性を検証する：

| テストシナリオ | 検証内容 |
|--------------|---------|
| v1.14.2 相当の IndexedDB 環境で起動 | `STORE_LOGS` / `STORE_CATEGORIES` / `STORE_SETTINGS` / `STORE_ALARMS` が存在し、`QuickLogAnimationDB` が存在しない状態で新バージョンを起動した際にエラーが発生しないこと |
| 旧バックアップからのリストア | v1.14.2 で作成されたバックアップフォルダ（旧ファイル名・フラット構造）からのリストアが正常に完了すること |
| backupDirectoryHandle の引き継ぎ | `backupDirectoryHandle` が既に IndexedDB に存在する状態で、メンテナンスタブが「保存先設定済み」UI を表示すること |
| anim_chunk_ キー不在時の同期 | `chrome.storage.sync` に `anim_chunk_` キーが存在しない場合に、アニメーション同期が「0件」として正常に動作すること |

### Sync 受信時の復元順序（session_sync.js + anim_sync.js）

`pullFromCloud()` 内でのアニメーション同期統合時、以下の順序で適用する：

1. アニメーションチャンク（`anim_chunk_`）を結合し `QuickLogAnimationDB` に保存 + メタデータを `chrome.storage.local` に反映
2. カテゴリ・設定の適用（既存の `applyRemoteSettings` の中で実施）
3. アラームの適用
4. 作業履歴のマージ + pauseState の同期

**設計判断:**
- `pullFromCloud()` 内でアニメーションチャンクの処理を `applyRemoteSettings()` より前に実行する
- Sync はインクリメンタルなので、アニメーションの同期が完了するまでカテゴリの適用を遅延させる
- 同期中も基本機能（計時）は利用可能にする設計のため、アニメーション同期完了前にカテゴリのアニメーション参照が解決できない場合は「デフォルト」アニメーションにフォールバックする（既存の `applyAnimation()` の仕様で対応済み）
- アラームの `actionCategory` が指すカテゴリが復元前の状態でも、アラーム発火時にカテゴリを名前で検索するため、次回 Sync 完了時に解決される


## Testing Strategy

### テスト方針

本機能は純粋関数（チャンク分割・バリデーション）とファイル I/O を伴うクラスが混在する。以下の二本柱で網羅する。

- **ユニットテスト（Jest + jsdom + fake-indexeddb）**: 具体的な例・エッジケース・エラー条件を検証
- **プロパティベーステスト（fast-check）**: 普遍的なプロパティを大量のランダム入力で検証

### プロパティベーステスト（PBT）

PBT ライブラリとして `fast-check`（devDependency として追加済みの場合）を使用する。最低 100 回のイテレーションを設定する。

テストファイル: `shared/js/anim_sync.test.js` および `projects/app/js/backup.test.js`

#### Property 7: チャンク分割の round-trip と上限保証

```javascript
// Feature: backup-restore-maintenance-overhaul, Property 7: チャンク分割 round-trip と上限保証
test.prop([fc.string({ minLength: 0, maxLength: 50000 })])('splitIntoChunks round-trip', (base64) => {
    const chunks = splitIntoChunks(base64, 6000);
    expect(chunks.every(c => c.length <= 6000)).toBe(true);
    expect(joinChunks(chunks)).toBe(base64);
});
```

#### Property 4: バリデーションの正確性（不正なバージョン）

```javascript
// Feature: backup-restore-maintenance-overhaul, Property 4: バリデーション正確性
test.prop([
    fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(''), fc.constant('3.0'),
             fc.string().filter(s => s !== '2.0'))
])('validateAlarmSchema rejects invalid versions', (version) => {
    const obj = { kind: 'QuickLogSolo/Alarm', version, /* ... */ };
    expect(validateAlarmSchema(obj)).toBe(false);
});
```

#### Property 6: チェックボックス選択状態とボタン有効状態

```javascript
// Feature: backup-restore-maintenance-overhaul, Property 6: チェックボックス選択状態とボタン有効状態
test.prop([fc.set(fc.constantFrom('logs','categories','settings','alarms','animations'))])
('execute button enabled iff at least one checkbox selected', (selected) => {
    renderMaintenanceUI(selected);
    const btn = document.getElementById('delete-initialize-btn');
    if (selected.length === 0) {
        expect(btn.disabled).toBe(true);
    } else {
        expect(btn.disabled).toBe(false);
    }
});
```

### ユニットテスト

ファイル: `projects/app/js/backup.test.js`, `projects/app/js/restore.test.js`, `shared/js/schema.test.js`, `shared/js/anim_sync.test.js`

#### BackupManager

| テストケース | 種別 |
|------------|------|
| アラームが存在する場合、`ql_alarms.json` が正しい形式で書き出される | EXAMPLE |
| カスタムアニメーションが0件の場合、`ql_custom_animations.json` が `[]` の entries で書き出される | EDGE_CASE |
| `STORE_ALARMS` 読み取り失敗時、ステータスが `FAILED` になる | EXAMPLE |
| バックアップ完了時刻はすべての書き込み完了後のみ更新される | EXAMPLE |

#### RestoreManager

| テストケース | 種別 |
|------------|------|
| フォルダ選択キャンセル時、データが変更されない | EDGE_CASE |
| 必須ファイルが両方存在しない場合、エラーを表示して中断する | EDGE_CASE |
| `ql_alarms.json` が存在しない場合（v1.x バックアップ）、空配列として扱い処理続行 | EDGE_CASE |
| 任意の有効なバックアップデータに対して、復元後 DB 内容がバックアップデータと一致する | PROPERTY (P5) |
| 不正レコードはスキップし、スキップ件数を表示する | EXAMPLE |
| IndexedDB 書き込み失敗時、エラーメッセージを表示して中断する | EXAMPLE |
| 復元順序がカスタムアニメーション→カテゴリ→設定→アラーム→作業履歴の順で実行される | EXAMPLE |

#### v1.14.2 互換性テスト

| テストケース | 種別 |
|------------|------|
| v1.14.2 相当の IndexedDB データ（`STORE_LOGS` / `STORE_CATEGORIES` / `STORE_SETTINGS` / `STORE_ALARMS` が存在し、`QuickLogAnimationDB` が存在しない状態）で新バージョンを起動した際にエラーが発生しないこと | INTEGRATION |
| v1.14.2 で作成されたバックアップフォルダ（旧ファイル名・フラット構造）からのリストアが正常に完了すること | EXAMPLE |
| `backupDirectoryHandle` が既に IndexedDB に存在する状態で、メンテナンスタブが「保存先設定済み」UI を表示すること | EXAMPLE |
| `chrome.storage.sync` に `anim_chunk_` キーが存在しない場合に、アニメーション同期が「0件」として正常に動作すること | EXAMPLE |

#### Schema_Validator

| テストケース | 種別 |
|------------|------|
| 有効なアラームオブジェクトは `validateAlarmSchema` で `true` | EXAMPLE |
| 必須フィールドが欠損したアラームオブジェクトは `false` | EDGE_CASE |
| `version: '1.0'` の既存ファイルは既存バリデーターで有効と判定される | EXAMPLE |
| `version: '2.0'` の `ql_settings.json` は `validateSettingsSchema` で有効と判定される | EXAMPLE |

#### AnimationSyncManager

| テストケース | 種別 |
|------------|------|
| 常にエラーを返すモック API に対してリトライが正確に 3 回実行される | EXAMPLE |
| 容量超過エラー時、そのアニメーションをスキップし処理を継続する | EXAMPLE |
| 端末間同期無効化時、`anim_chunk_` プレフィックスのキーがすべて削除される | EXAMPLE |

#### Maintenance_UI (削除/初期化)

| テストケース | 種別 |
|------------|------|
| すべてのチェックボックスが未選択の初期状態では実行ボタンが `disabled` | EXAMPLE |
| 「カスタムアニメーション」を選択した場合、`QuickLogAnimationDB` と `custom_animation_metadata_map` が消去される | EXAMPLE |
| 実行中は実行ボタンが `disabled` になる | EXAMPLE |

### E2E テスト

Playwright でのスモークテストとして以下を検証する（`tests/maintenance.spec.js`）:

- 設定パネルに「バックアップ」タブが存在しないことを確認
- 「メンテナンス」タブにバックアップ・復元・削除のすべての機能が表示されることを確認
- バックアップ実行後に「最終バックアップ時刻」が更新されることを確認
