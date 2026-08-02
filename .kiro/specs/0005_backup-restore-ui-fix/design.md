# 設計書: バックアップ・復元 UI スタイル修正

## Overview

Spec 0004 の実行で生じたバックアップ・復元セクションの UI リグレッションを修正する。
具体的には (1) ボタンスタイルの outline 化、(2) 情報パネルのカード形式復元、(3) 説明テキスト復元、(4) セクション間の仕切り線追加を行う。

### 設計の制約

- Vanilla JS (ES Modules) のみ使用。外部ライブラリ禁止
- `innerHTML` 禁止、`textContent` を徹底する
- CSS 変数は `body` に定義
- 既存の `settings-divider` クラスを再利用する
- 既存の `backup-status-panel` CSS クラスを情報パネルに活用する
- `projects/app/` の変更は `npm run version:bump` 必須

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `projects/app/css/style.css` | `.outline-btn` クラス追加、`.outline-btn.primary` / `.outline-btn.secondary` バリアント定義 |
| `projects/app/app.html` | メンテナンスタブ内バックアップ・復元セクションの HTML 構造変更 |
| `projects/app/js/app.js` | `updateBackupUI()` 関数の情報パネル更新ロジック修正 |

## Components

### 1. Outline ボタンスタイル (`projects/app/css/style.css`)

before 画像のスタイルを再現するため、新しい `.outline-btn` クラスを定義する。

```css
/* Outline button — background transparent, border visible, icon + text */
.outline-btn {
    background-color: transparent;
    border: 1px solid var(--md-sys-color-outline);
    padding: var(--md-sys-spacing-1) var(--md-sys-spacing-2);
    border-radius: var(--md-sys-shape-full);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: bold;
    width: 100%;
    cursor: pointer;
    color: var(--md-sys-color-primary);
}

.outline-btn:hover {
    background-color: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
    box-shadow: var(--md-sys-elevation-1);
}

.outline-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.outline-btn .material-symbols-outlined {
    font-size: 20px;
}
```

**設計根拠:** Material Design 3 の Outlined Button パターンに準拠。before 画像ではアイコン + テキストの outline ボタンが使われていたため、`primary-btn`（filled）ではなくこのスタイルを適用する。

### 2. HTML 構造変更 (`projects/app/app.html`)

#### 保存先未設定時

```html
<!-- 保存先未設定時 -->
<div id="backup-not-configured" class="backup-state">
    <button id="backup-start-btn" class="outline-btn">
        <span class="material-symbols-outlined">backup</span>
        <span data-i18n="btn-backup-grant-run"></span>
    </button>
    <button id="backup-change-dir-btn-init" class="outline-btn">
        <span class="material-symbols-outlined">folder_open</span>
        <span data-i18n="btn-backup-change-dir"></span>
    </button>
</div>
```

#### 保存先設定済み時

```html
<!-- 保存先設定済み時 -->
<div id="backup-configured" class="backup-state" style="display: none;">
    <button id="backup-execute-btn" class="outline-btn">
        <span class="material-symbols-outlined">backup</span>
        <span data-i18n="backup-execute"></span>
    </button>
    <button id="restore-configured-btn" class="outline-btn">
        <span class="material-symbols-outlined">restore</span>
        <span data-i18n="restore-btn"></span>
    </button>
    <button id="backup-change-dir-btn" class="outline-btn">
        <span class="material-symbols-outlined">folder_open</span>
        <span data-i18n="backup-change-dir"></span>
    </button>

    <!-- 情報パネル -->
    <div class="setting-item">
        <label data-i18n="backup-directory"></label>
        <p id="backup-directory-name"></p>
    </div>
    <div class="backup-status-panel">
        <div class="status-row">
            <span data-i18n="backup-last-time-label"></span>
            <span id="backup-last-time"></span>
        </div>
        <div class="status-row">
            <span data-i18n="backup-file-count-label"></span>
            <span id="backup-file-count"></span>
        </div>
    </div>

    <!-- 説明テキスト -->
    <p class="setting-description" data-i18n="backup-description-new"></p>
</div>
```

#### 仕切り線

バックアップ・復元セクションの直後、削除/初期化セクションの直前に配置:

```html
</div><!-- .maintenance-section #backup-restore-section 終了 -->

<hr class="settings-divider">

<!-- 削除/初期化セクション -->
<div class="maintenance-section" id="delete-initialize-section">
```

### 3. updateBackupUI() 修正 (`projects/app/js/app.js`)

既存の `updateBackupUI()` 関数を以下のように拡張する:

- `backup-directory-name` 要素にディレクトリハンドル名を反映
- `backup-last-time` に最終バックアップ時刻を「最終バックアップ時刻　YYYY/M/D HH:MM:SS」形式で表示
- `backup-file-count` にファイル数を「N 日分」形式で表示

```javascript
// ディレクトリ名の表示
const dirNameEl = getEl('backup-directory-name');
if (dirNameEl) {
    dirNameEl.textContent = backupManager.directoryHandle
        ? backupManager.directoryHandle.name
        : '';
}

// 最終バックアップ時刻の表示（status-row 内）
const lastTimeDisplay = getEl(ID_BACKUP_LAST_TIME_DISPLAY);
if (lastTimeDisplay) {
    const config = backupManager.config;
    const timeLabel = t('backup-last-time-label');
    const timeValue = config.lastBackupTime
        ? new Date(config.lastBackupTime).toLocaleString()
        : '-';
    lastTimeDisplay.textContent = `${timeLabel}　${timeValue}`;
}

// ファイル数の表示
backupManager.getFileCount().then((count) => {
    const fileCountDisplay = getEl(ID_BACKUP_FILE_COUNT_DISPLAY);
    if (fileCountDisplay) {
        fileCountDisplay.textContent = `${count} ${t('backup-file-count-unit')}`;
    }
});
```

### 4. i18n キーの確認

以下の既存キーを使用する（追加不要）:

| キー | 用途 |
|------|------|
| `btn-backup-grant-run` | 初回ボタンラベル（「保存先にアクセスしてバックアップを保存する」） |
| `btn-backup-change-dir` | バックアップ先指定ボタン（未設定時「バックアップ先を指定する」） |
| `backup-execute` | バックアップ保存ボタン（「バックアップを保存する」） |
| `restore-btn` | 復元ボタン（「バックアップを復元する」） |
| `backup-directory` | 保存先ラベル |
| `backup-file-count-unit` | 「日分」 |
| `backup-description-new` | 説明テキスト |

**追加が必要なキー:**

| キー | ja | en | 用途 |
|------|----|----|------|
| `backup-last-time-label` | `最終バックアップ時刻` | `Last Backup` | 情報パネル行ラベル |
| `backup-file-count-label` | `ファイル数` | `File Count` | 情報パネル行ラベル |
| `backup-change-dir` | `バックアップ先を変更する` | `Change Destination` | 設定済み時のバックアップ先変更ボタン |

## レイアウト全体像（修正後）

```
[メンテナンスタブ]
┌─────────────────────────────────────────────────┐
│ バックアップ・復元（h3）                          │
│                                                   │
│  ─── 保存先未設定の場合 ───                       │
│                                                   │
│ [🔲 保存先にアクセスしてバックアップを保存する]      │  ← outline-btn
│ [🔲 バックアップ先を指定する]                      │  ← outline-btn
│                                                   │
│  ─── 保存先設定済みの場合 ───                     │
│                                                   │
│ [🔲 バックアップを保存する]                        │  ← outline-btn
│ [🔲 バックアップを復元する]                        │  ← outline-btn
│ [🔲 バックアップ先を変更する]                      │  ← outline-btn
│                                                   │
│ 保存先                                            │
│ QuickLog-Solo                                     │
│ ┌───────────────────────────────────────┐        │
│ │ 最終バックアップ時刻  2026/5/26 22:20:05│        │  ← backup-status-panel
│ │ ファイル数            0 日分            │        │
│ └───────────────────────────────────────┘        │
│                                                   │
│ ブラウザのキャッシュクリアなどで IndexedDB の...   │  ← setting-description
│                                                   │
├─────────── settings-divider ─────────────────────┤
│                                                   │
│ 削除/初期化（h3）                                 │
│ □作業履歴 □カテゴリ □設定 □アラーム □カスタム...   │
│ [削除/初期化する]                                  │  ← danger-btn
└─────────────────────────────────────────────────┘
```

## ダークテーマ対応

- `.outline-btn` は `border-color: var(--md-sys-color-outline)` を使用するため、ダークテーマ時は自動的にダーク用のカラーが適用される
- `.backup-status-panel` は `var(--md-sys-color-surface-container-low)` を使用しており、テーマ追従済み
- 追加のダークテーマ固有ルールは不要
