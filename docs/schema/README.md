# QuickLog-Solo データスキーマ定義

本ディレクトリでは、QuickLog-Solo がバックアップ、インポート、エクスポートに使用するデータの JSON スキーマを定義しています。
これらのスキーマは、将来的な実装の改善を見据えた「あるべき姿」として設計されており、現在の実装よりも構造化された形式を採用しています。

全てのデータは `kind` プロパティ（データ種別）、`version` プロパティ（スキーマバージョン）、および `type` プロパティ（詳細種別）を持つことで、他のデータと明確に識別・検証できるようになっています。

## バージョニング方針

本スキーマの `version` は以下のルールに従って更新されます。

- **メジャーバージョン (X.0)**: 後方互換性を維持できない破壊的な変更が行われた場合にカウントアップされます。
- **マイナーバージョン (0.Y)**: 後方互換性が維持される追加や改善が行われた場合にカウントアップされます。

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
  - `kind`: データ種別 (`"QuickLogSolo/Settings"`)
  - `version`: スキーマバージョン
- **主な項目:**
  - `entries`: 設定項目の配列。

#### 設定項目詳細:
- **theme**: テーマ設定 (`system`, `light`, `dark`)
- **font**: 使用フォント名
- **defaultAnimation**: 標準（共通）の背景アニメーション ID
- **language**: 表示言語 (`auto`, `ja`, `en`, `de`, `es`, `fr`, `pt`, `ko`, `zh`)
- **reportSettings**: 日報出力時の詳細設定 (フォーマット、絵文字の有無、終了時刻の表示など)

---

### 2. 履歴ログデータ (`history.schema.json`)

日ごとの履歴バックアップファイル (`YYYY-MM-DD.ndjson`) で使用されるスキーマです。

- **ファイル形式:** NDJSON (各行が 1 つの JSON オブジェクト)
- **識別フィールド:**
  - `kind`: データ種別 (`"QuickLogSolo/History"`)
  - `version`: スキーマバージョン
  - `type`: ログの種類 (`"task"`, `"idle"`, `"stop"`)

---

### 3. カテゴリデータ (`category.schema.json`)

カテゴリのエクスポートやバックアップファイル (`categories.ndjson`) で使用されるスキーマです。
表示順序はファイル内の行の順序（上から下）によって決定されます。

- **ファイル形式:** NDJSON (各行が 1 つの JSON オブジェクト)
- **識別フィールド:**
  - `kind`: データ種別 (`"QuickLogSolo/Category"`)
  - `version`: スキーマバージョン
  - `type`: カテゴリの種類 (`"category"`, `"page-break"`)

---

## 免責事項 (Disclaimer)

本ドキュメントおよびスキーマは、データの構造を説明するためのものであり、将来のアップデートにより予告なく変更される場合があります。

This documentation and schemas are provided for informational purposes regarding data structures and are subject to change without notice due to future updates.
