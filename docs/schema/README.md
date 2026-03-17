# QuickLog-Solo データスキーマ定義

本ディレクトリでは、QuickLog-Solo がバックアップ、インポート、エクスポートに使用するデータの JSON スキーマを定義しています。
これらのスキーマは、将来的な実装の改善を見据えた「あるべき姿」として設計されており、現在の実装（カンマ区切りの文字列など）よりも構造化された形式（配列など）を採用しています。

また、各データは `kind` プロパティなどを持つことで、他のデータと明確に識別できるようになっています。

## スキーマ一覧

1. [設定データ (`settings.schema.json`)](#1-設定データ-settingsschemajson)
2. [履歴ログデータ (`history.schema.json`)](#2-履歴ログデータ-historyschemajson)
3. [カテゴリデータ (`category.schema.json`)](#3-カテゴリデータ-categoryschemajson)

---

### 1. 設定データ (`settings.schema.json`)

`settings.json` ファイルに使用されるスキーマです。ファイル全体が 1 つのオブジェクトとして構成されます。

- **ファイル形式:** JSON オブジェクト
- **識別フィールド:**
  - `app`: アプリケーション識別子 (`"QuickLog-Solo"`)
  - `kind`: データ種別 (`"Settings"`)
  - `version`: スキーマバージョン
- **主な項目:**
  - `entries`: 設定項目の配列。各項目は `key` と `value` を持ちます。

#### 設定項目詳細:
- **theme**: テーマ設定 (`system`, `light`, `dark`)
- **font**: 使用フォント名
- **animation**: デフォルトの背景アニメーション ID
- **language**: 表示言語 (`auto`, `ja`, `en`, `de`, `es`, `fr`, `pt`, `ko`, `zh`)
- **autoStop**: 日付変更時の自動停止を有効にするか (`boolean`)
- **reportSettings**: 日報出力時の詳細設定 (フォーマット、絵文字の有無、終了時刻の表示など)

---

### 2. 履歴ログデータ (`history.schema.json`)

日ごとの履歴バックアップファイル (`YYYY-MM-DD.ndjson`) で使用されるスキーマです。

- **ファイル形式:** NDJSON (各行が 1 つの JSON オブジェクト)
- **識別フィールド:**
  - `kind`: データ種別 (`"QuickLogSolo/History"`)
- **主な項目:**
  - `category`: カテゴリ名。待機状態の場合は `__IDLE__` となります。
  - `startTime`: 開始時刻 (UNIX タイムスタンプ、ミリ秒)
  - `endTime`: 終了時刻 (UNIX タイムスタンプ、ミリ秒、未終了の場合は `null`)
  - `color`: 記録時のカテゴリ色
  - `isManualStop`: ユーザーが手動で「停止」ボタンを押した記録かどうか (`boolean`)
  - `resumableCategory`: 一時停止（待機）状態から復帰する際のカテゴリ名
  - `tags`: 記録時に付与されていたタグ（**文字列の配列**）

---

### 3. カテゴリデータ (`category.schema.json`)

カテゴリのエクスポートやバックアップファイル (`categories.ndjson`) で使用されるスキーマです。

- **ファイル形式:** NDJSON (各行が 1 つの JSON オブジェクト)
- **識別フィールド:**
  - `kind`: データ種別 (`"QuickLogSolo/Category"`)
- **定義タイプ:**
  - **Regular Category (通常カテゴリ)**: 名前、色、タグ、アニメーション設定を持つ。
  - **Page Break (改ページ)**: アプリ内のボタン配置で改ページを挿入するマーカー。

#### カテゴリの項目詳細:
- **name**: カテゴリの表示名。システム予約語（`__PAGE_BREAK__`, `__IDLE__`）は使用できません。
- **color**: カテゴリのテーマ色
- **tags**: デフォルトのタグ（**文字列の配列**）
- **animation**: このカテゴリがアクティブな時に流すアニメーション ID
- **order**: 表示順序を示す数値
- **type**: 改ページの場合に `"page-break"` と指定される（クリップボード経由の場合）

---

## 免責事項 (Disclaimer)

本ドキュメントおよびスキーマは、データの構造を説明するためのものであり、将来のアップデートにより予告なく変更される場合があります。

This documentation and schemas are provided for informational purposes regarding data structures and are subject to change without notice due to future updates.
