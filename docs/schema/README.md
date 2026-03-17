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
  - `version`: `"1.0"`
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
  - `version`: `"1.1"`
  - `type`: ログの種類 (`"task"`, `"idle"`, `"stop"`)
- **ログの種類:**
  - **task**: 通常の作業タスク。`category` プロパティが必須です。
  - **idle**: 待機または一時停止状態。必要に応じて `resumableCategory` を持ちます。
  - **stop**: 手動での明示的な停止マーカー。

#### 履歴ログの主な項目:
- `startTime`: 開始時刻 (UNIX タイムスタンプ、ミリ秒)
- `endTime`: 終了時刻 (UNIX タイムスタンプ、ミリ秒、進行中の場合は `null`)
- `category`: カテゴリ名 (`type: "task"` の場合)
- `tags`: 記録時に付与されていたタグ（文字列の配列）
- `memo`: ユーザーによる補足メモ（任意、最大 100 文字）
- `resumableCategory`: 復帰対象のカテゴリ名 (`type: "idle"` の場合)

---

### 3. カテゴリデータ (`category.schema.json`)

カテゴリのエクスポートやバックアップファイル (`categories.ndjson`) で使用されるスキーマです。
表示順序はファイル内の行の順序（上から下）によって決定されます。

- **ファイル形式:** NDJSON (各行が 1 つの JSON オブジェクト)
- **識別フィールド:**
  - `kind`: データ種別 (`"QuickLogSolo/Category"`)
  - `version`: `"1.0"`
  - `type`: カテゴリの種類 (`"category"`, `"page-break"`)
- **定義タイプ:**
  - **Regular Category (通常カテゴリ)**: `type: "category"` を持ち、名前、色、タグ、アニメーション設定を持つ。
  - **Page Break (改ページ)**: `type: "page-break"` を持ち、アプリ内のボタン配置で改ページを挿入するマーカー。

#### カテゴリの項目詳細:
- **animation**: アニメーション ID。アニメーションを表示しない場合は予約値 `"none"` を指定します。

---

## 免責事項 (Disclaimer)

本ドキュメントおよびスキーマは、データの構造を説明するためのものであり、将来のアップデートにより予告なく変更される場合があります。

This documentation and schemas are provided for informational purposes regarding data structures and are subject to change without notice due to future updates.
