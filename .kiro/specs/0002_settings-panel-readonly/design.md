# 設計書: 設定パネルの閲覧専用化とエディタ連携強化

## 概要

設定パネルのカテゴリタブ・アラームタブをリファクタリングし、インライン編集 UI をすべて閲覧専用の表示 UI に置き換える。
変更の主体は `projects/app/app.html`（DOM 構造）と `projects/app/js/app.js`（描画ロジック・イベントリスナー）、および `shared/js/locales/*.js`（翻訳）の 3 ファイル群。

変更後のカテゴリタブは「一覧確認＋「編集」ボタンでエディタ起動」のみを行う。
アラームタブは「一覧確認＋各エントリーの有効トグル＋「編集」ボタンでエディタ起動」に限定する。

---

## アーキテクチャ

変更のレイヤー構造は以下の通り。

```
変更対象
├── UI 層 (app.html)
│   ├── #categories-tab — 不要要素削除・DOM 構造の簡素化
│   └── #alarms-tab    — 不要要素削除・フッターレイアウト調整
│
├── UI 層 (app.js)
│   ├── renderCategoryEditor() → renderCategoryList() に完全書き換え
│   ├── renderAlarmList()      — 閲覧専用化（有効チェックボックスのみ残存）
│   ├── renderBusinessDays()   — onclick 除去・鉛筆ボタン追加
│   ├── setupEventListeners()  — 不要リスナー除去・鉛筆ボタンリスナー追加
│   └── handleSyncMessage()    — カテゴリタブへの即時反映を追加
│
└── i18n 層 (shared/js/locales/*.js — 全 8 言語)
    ├── btn-launch-category-editor → 各言語の「編集」相当に更新
    ├── btn-launch-alarm-editor    → 各言語の「編集」相当に更新
    ├── tooltip-edit-business-days → 新規追加（8 言語）
    └── 不要キー削除（参照箇所確認後）
```

---

## コンポーネントと変更インターフェース

### 1. `projects/app/app.html` — カテゴリタブ

#### 削除する要素

| 要素 | ID / セレクタ | 理由 |
|------|-------------|------|
| 新規カテゴリ入力ボックス全体 | `#add-category-box-settings` | エディタでのみ追加する |
| カテゴリの入出力セクション全体 | `#category-maintenance-box-settings` 内のクリップボードUI | エディタとの受け渡しに不要 |

#### 「編集」ボタンのラベル変更

```html
<!-- 変更前 -->
<button id="advanced-editor-link" class="secondary-btn">
    <span class="material-symbols-outlined">edit_note</span>
    <span data-i18n="btn-launch-category-editor">業務カテゴリ・エディタを起動</span>
</button>

<!-- 変更後 -->
<button id="advanced-editor-link" class="secondary-btn">
    <span class="material-symbols-outlined">edit_note</span>
    <span data-i18n="btn-launch-category-editor">編集</span>
</button>
```

---

### 2. `projects/app/app.html` — アラームタブ

#### 削除する要素

| 要素 | ID / セレクタ | 理由 |
|------|-------------|------|
| アラームの入出力セクション全体 | `export-alarms-btn` / `import-alarms-btn` を含む `.setting-item` | エディタとの受け渡しに不要 |

#### 「編集」ボタンと仕切り線

```html
<!-- 変更後の alarms-fixed-footer 内フッター構造 -->
<div id="alarms-fixed-footer">
    <div class="setting-item">
        <button id="alarm-editor-link" class="secondary-btn">
            <span class="material-symbols-outlined">edit_notifications</span>
            <span data-i18n="btn-launch-alarm-editor">編集</span>
        </button>
    </div>

    <hr class="settings-divider">

    <div class="setting-item">
        <button id="test-notification-btn" class="secondary-btn" style="width: 100%;">
            <span class="material-symbols-outlined">notifications_active</span>
            <span data-i18n="btn-test-notification">通知のテストを実行する</span>
        </button>
    </div>
</div>
```

---

### 3. `app.js` — `renderCategoryList()` (旧 `renderCategoryEditor()`)

旧実装の `renderCategoryEditor()` は完全に書き換え、関数を `renderCategoryList()` に改名する（または内部実装を丸ごと置換する）。

#### 新しい描画内容（各カテゴリエントリー）

```
┌─────────────────────────────────────────────┐
│ ● カテゴリ名                                │  ← 色見本(●) + textContent
│   タグ: tag1, tag2    アニメ: digital_rain  │  ← サブテキスト行
└─────────────────────────────────────────────┘
```

- 色見本：小さな `<span>` に `background-color: getColorCode(cat.color)` を適用。`<input>` や dropdown は使わない。
- カテゴリ名：`<span>` の `textContent`。
- タグ：`cat.tags` が空でなければ `タグ: …` として `textContent` 表示。
- アニメーション名：`cat.animation` が `'none'`・`undefined` でなければ翻訳済みラベルを `textContent` 表示。
- 改ページ：アイコン（`insert_page_break`）＋ `t('page-break')` テキスト。
- `draggable` 属性・ドラッグイベント・削除ボタン・`nameInput`・`colorDropdown`・`animSelect`・`tagInput`・`tagList` は**一切生成しない**。

#### 閲覧専用スタイリング指針

```css
/* 編集不可能であることを示すスタイル */
.category-readonly-item {
    cursor: default;
    /* フォーム要素を模したボーダー・背景は付けない */
    /* ホバー時にハイライトなし → :hover { background: none } */
}
```

---

### 4. `app.js` — `renderAlarmList()` の閲覧専用化

#### 変更方針

`updateAlarm()` 内の処理を `enabledCheck` の onchange **のみ**に絞る。
他のフォーム要素（`timeInput`・`typeSelect`・`msgInput` 等）はすべて `<input>` / `<select>` の代わりに `<span>` + `textContent` で値を表示する。

#### 有効チェックボックス（変更なし）

```javascript
// 残存するコード
const enabledCheck = createEl('input');
enabledCheck.type = 'checkbox';
enabledCheck.className = 'alarm-enabled';
enabledCheck.checked = alarm.enabled;
enabledCheck.onchange = async () => {
    alarm.enabled = enabledCheck.checked;
    await dbPut(STORE_ALARMS, alarm);
    broadcastSync('alarms-updated');
};
```

#### 閲覧専用フィールドの表示例（時刻）

```javascript
// 変更前
const timeInput = createEl('input');
timeInput.type = 'time';
timeInput.value = alarm.time || '09:00';

// 変更後
const timeText = createEl('span');
timeText.className = 'alarm-field-value';
timeText.textContent = alarm.time || '09:00';
timeText.style.cursor = 'default';
```

#### 不要コードの完全削除対象

以下の変数定義・要素生成・イベント登録はすべて除去する。

- `timeInput`・`confirmCheck`・`typeSelect`
- `rowWeekly`・`rowMonthlyDate`・`rowMonthlyEnd`・`rowHoliday`
- `msgInput`・`actionSelect`・`catSelect`・`rowCategory`
- `updateAlarm()` 関数（`enabledCheck.onchange` に直接インライン化）
- `updateVisibility()` 関数
- `updateHolidayOptions()` 関数

---

### 5. `app.js` — `renderBusinessDays()` の閲覧専用化と鉛筆ボタン

#### 変更方針

各チップの `chip.onclick` を除去（ハンドラなし）。
`#business-days-container` と同じ行に鉛筆ボタンを追加するため、ラッパー要素でコンテナと鉛筆ボタンを横並びにする。

```javascript
// 変更後の構造イメージ
const wrapper = createEl('div');
wrapper.className = 'business-days-wrapper'; // display: flex; align-items: center; gap: 8px;

const container = getEl(ID_BUSINESS_DAYS_CONTAINER);
// チップ生成（onclick なし）
[0,1,2,3,4,5,6].forEach((day) => {
    const chip = createEl('button');
    chip.className = 'filter-chip' + (businessDays.includes(day) ? ' active' : '');
    // ...省略...
    chip.disabled = true;       // クリック無効
    chip.style.cursor = 'default';
    container.appendChild(chip);
});

const editBtn = createEl('button');
editBtn.className = 'icon-btn';
editBtn.title = t('tooltip-edit-business-days');
editBtn.setAttribute('data-i18n-title', 'tooltip-edit-business-days');
const editIcon = createEl('span');
editIcon.className = 'material-symbols-outlined';
editIcon.textContent = 'edit';
editBtn.appendChild(editIcon);
editBtn.onclick = () => launchAlarmEditor();  // alarm-editor-link と同じ処理
```

---

### 6. `app.js` — `handleSyncMessage()` と `setupEventListeners()` の修正

#### `handleSyncMessage()` — カテゴリタブへの即時反映追加

```javascript
function handleSyncMessage(data) {
    if (!data) return;
    if (data.type === 'reload') {
        location.reload();
    } else if (data.type === 'alarms-updated') {
        const alarmsTab = getEl('alarms-tab');
        if (alarmsTab && !alarmsTab.classList.contains('hidden')) {
            renderAlarmList();
            renderBusinessDays();   // 追加
        }
    } else if (data.type === 'sync') {
        // カテゴリタブが開いていれば即時再描画
        const categoriesTab = getEl('categories-tab');
        if (categoriesTab && !categoriesTab.classList.contains('hidden')) {
            renderCategoryList();   // 追加
        }
        if (document.visibilityState === 'visible') {
            syncState();
        }
    }
}
```

#### `setupEventListeners()` — 削除するリスナー

以下の `addEventListener` 登録を **完全に除去**する。

| 削除対象 | 対応する ID 定数 |
|----------|---------------|
| 「カテゴリを追加」ボタン | `ID_ADD_CATEGORY_BTN_SETTINGS` |
| 「改ページを追加」ボタン | `'add-page-break-btn'` |
| カテゴリ Export ボタン | `ID_EXPORT_CATEGORIES_BTN` |
| カテゴリ Import ボタン | `ID_IMPORT_CATEGORIES_BTN` |
| アラーム Export ボタン | `'export-alarms-btn'` |
| アラーム Import ボタン | `'import-alarms-btn'` |

#### 削除対象の ID 定数（`app.js` 冒頭）

以下の定数は DOM 要素が削除されるため、参照箇所がゼロになり次第、定数定義ごと除去する。

- `ID_ADD_CATEGORY_BTN_SETTINGS`
- `ID_NEW_CATEGORY_NAME_SETTINGS`
- `ID_EXPORT_CATEGORIES_BTN`
- `ID_IMPORT_CATEGORIES_BTN`

鉛筆ボタン（`business-days-edit-btn`）の ID 定数は必要に応じて追加する。

---

### 7. `shared/js/locales/*.js` — i18n 更新

#### 更新キー: `btn-launch-category-editor` / `btn-launch-alarm-editor`

| ファイル | `btn-launch-category-editor` | `btn-launch-alarm-editor` |
|---------|------------------------------|--------------------------|
| `ja.js` | `編集` | `編集` |
| `en.js` | `Edit` | `Edit` |
| `de.js` | `Bearbeiten` | `Bearbeiten` |
| `es.js` | `Editar` | `Editar` |
| `fr.js` | `Modifier` | `Modifier` |
| `pt.js` | `Editar` | `Editar` |
| `ko.js` | `편집` | `편집` |
| `zh.js` | `编辑` | `编辑` |

#### 新規追加キー: `tooltip-edit-business-days`

| ファイル | 値 |
|---------|-----|
| `ja.js` | `アラーム・エディタで稼働曜日を編集します` |
| `en.js` | `Edit business days in the Alarm Editor` |
| `de.js` | `Arbeitstage im Alarm-Editor bearbeiten` |
| `es.js` | `Editar días laborables en el Editor de alarmas` |
| `fr.js` | `Modifier les jours ouvrables dans l'éditeur d'alarmes` |
| `pt.js` | `Editar dias úteis no Editor de Alarmes` |
| `ko.js` | `알람 에디터에서 근무 요일 편집` |
| `zh.js` | `在闹钟编辑器中编辑工作日` |

#### 削除候補キー（参照調査後に判断）

以下のキーは `app.html` / `app.js` からの参照がなくなるが、エディタ側や他コンポーネントを確認してから削除する。

| キー | 参照が残る可能性のある場所 |
|------|--------------------------|
| `alarm-io-title` | `alarm-editor/` 内 HTML の `data-i18n` 属性 |
| `category-backup` | `category-editor/` 内 HTML の `data-i18n` 属性 |
| `btn-export-json` | `category-editor/` および `alarm-editor/` 内で共用の可能性 |
| `btn-import-json` | 同上 |
| `import-append` / `import-overwrite` | `category-editor/` 内で使用中の可能性 |
| `placeholder-new-category` | `category-editor/` 内で使用中の可能性 |
| `btn-add-category` / `btn-add-page-break` | `category-editor/` 内で使用中の可能性 |

---

## データモデル

本 spec はデータモデルを変更しない。IndexedDB の `STORE_CATEGORIES`・`STORE_ALARMS`・`STORE_SETTINGS` のスキーマはすべて現状維持。
有効チェックボックスのトグルは既存の `dbPut(STORE_ALARMS, alarm)` をそのまま使用する。

---

## エラー処理

| 状況 | 対処方針 |
|------|----------|
| `renderCategoryList()` が DB エラーで失敗した場合 | 既存の `updateUI()` の try/catch パターンを踏襲し、`console.error` を出力してリスト表示を空にする |
| `handleSyncMessage()` の即時再描画中に設定パネルが閉じられた場合 | `getEl('categories-tab')` / `getEl('alarms-tab')` が `null` またはクラスに `hidden` を含む場合はスキップ。DOM の存在チェックは各 `renderXxx()` 関数先頭の `if (!list) return;` ガードが担保する |
| 有効チェックボックスのトグル中に DB 書き込みが失敗した場合 | `dbPut` のエラーを catch して `showToast(t('alert-error'))` を表示し、チェックボックスを元の状態に戻す |

---

## テスト戦略

### 修正が必要な既存 E2E テスト

以下のテストは閲覧専用化後に存在しない要素を参照するため、修正が必要。

| テストファイル | 修正が必要な箇所 | 修正方針 |
|--------------|---------------|---------|
| `tests/maintenance.spec.js` | `.category-edit-name[value="KeepMe"]` / `.category-edit-name[value="DeleteMe"]`（`<input>` を前提） | 新しい閲覧専用セレクタ（例：`.category-readonly-name`）に変更。またはカテゴリ追加操作そのものを「設定パネルから追加」ではなく「エディタから追加」に変更するか、カテゴリ追加の検証はタイムアウト後にメインUI（カテゴリボタン）で確認する形に変更する |
| `tests/maintenance.spec.js` | `#new-category-name-settings` への `.fill()`・`#add-category-btn-settings` への `.click()` | これらの要素は削除されるため、テスト内でカテゴリを作成する手順を書き直す（URL パラメータ経由の DB 初期データ注入、または API 直接呼び出しに変更） |
| `tests/ui_settings.spec.js` | `.alarm-time`・`.alarm-message`・`.alarm-action`（`<input>`/`<select>` を前提）への `fill()`・`selectOption()` | これらは閲覧専用 `<span>` になるため、アラーム設定の永続化テストはアラーム・エディタ側のテスト（`alarm_editor_layout.spec.js` 等）で担保する。`ui_settings.spec.js` の当該テストは有効チェックボックスのみ確認する形に縮小する |

### 新規確認項目（手動または自動）

| 確認項目 | 検証方法 |
|---------|---------|
| カテゴリタブの閲覧専用エントリーに `<input>` が含まれないこと | `expect(page.locator('#category-editor-list input')).toHaveCount(0)` |
| アラームタブのエントリーに `<input type="checkbox">.alarm-enabled` が存在すること | `expect(page.locator('.alarm-enabled')).toBeVisible()` |
| 有効チェックボックスのトグルが DB に保存されリロード後も維持されること | トグル → リロード → 状態確認 |
| 稼働曜日の鉛筆ボタンが存在しクリックで新タブが開くこと | `page.waitForEvent('popup')` で検証 |
| 「編集」ボタン（カテゴリ・アラーム）クリックで新タブが開くこと | `page.waitForEvent('popup')` で検証 |
| アラームエディタ適用後、アラームタブが即時更新されること | BroadcastChannel を疑似送信して `renderAlarmList()` の再実行を確認 |
