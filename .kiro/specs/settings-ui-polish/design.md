# 設計書: 設定パネル・関連ツールの UI ポリッシュ

## 概要

本設計書は `requirements.md` に定義された 14 個の要件を実装するための技術設計を記述する。
変更ファイルは以下に限定される。

| ファイル | 変更内容 |
|---------|---------|
| `projects/app/css/style.css` | 仕切り線・改ページ中央揃え・スウォッチ・disabled・時刻幅 等の CSS |
| `projects/app/js/app.js` | `renderCategoryList()` の DOM 生成ロジック改修 |
| `projects/alarm-editor/js/alarm-editor.js` | `init()` の初期選択ロジック追加 |
| `projects/animation-maker/index.html` | `#drop-zone` 内シンボルテキストの変更 |
| `shared/js/locales/ja.js` | `maker-drop-hint` の文言変更 |
| `shared/js/locales/en.js` | `maker-drop-hint` の文言変更 |
| `shared/js/locales/de.js` | `maker-drop-hint` の文言変更 |
| `shared/js/locales/es.js` | `maker-drop-hint` の文言変更 |
| `shared/js/locales/fr.js` | `maker-drop-hint` の文言変更 |
| `shared/js/locales/pt.js` | `maker-drop-hint` の文言変更 |
| `shared/js/locales/ko.js` | `maker-drop-hint` の文言変更 |
| `shared/js/locales/zh.js` | `maker-drop-hint` の文言変更 |

---

## ライト / ダークモード両対応の実装方針

全変更において以下を厳守する。

- **色の直接指定は原則禁止。** 固定カラーコードを新たに追加する場合は、既存の M3 CSS 変数（`var(--md-sys-color-*)` / `var(--app-color-*)`）に代替できるか必ず確認する。代替できるものはセマンティックトークンを使用する。
- **例外 — Retro 系スウォッチ頭文字色のみ固定値を許容。** LCD 背景 `#9bbc0f` に対する `#0f380f`、CRT 背景 `#33ff33` に対する `#030c04`、Nixie 背景 `#f50` に対する `#1a0800` は、既存 Retro CSS（`style.css` の `#current-task-display.retro-*` セクション）で使われている値と統一した固定値として使用する。
- **スウォッチ背景色（`getColorCode()` の返値）は「カテゴリカラー」を表す固定情報** であり、そのまま使用してよい。ただし他の UI 要素への流用は禁止。
- **`body.theme-dark` セレクタで上書きが必要な場合** は、ライト側と対になるルールを必ず追加する。上書き漏れが視認性の低下を引き起こすため、ライト・ダーク両方でレンダリングを目視確認してからタスクを完了とする（タスク 8 参照）。

---

## 1. カテゴリタブ CSS 変更

### 1-1. 仕切り線の除去（要件 1）

`#category-editor-list` の CSS から `border-bottom` を削除する。

```css
/* BEFORE */
#category-editor-list {
    flex: 1;
    overflow-y: auto;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    padding-right: 4px;
}

/* AFTER */
#category-editor-list {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
}
```

### 1-2. 改ページアイテムの中央揃え（要件 2）

`.category-editor-item.page-break-item` に `justify-content: center` を追加し、内部の `.page-break-label` も中央揃えとする。

```css
/* AFTER */
.category-editor-item.page-break-item {
    background-color: var(--md-sys-color-surface-container-low);
    padding: 4px 12px;
    border: 1px dashed var(--md-sys-color-outline);
    display: flex;
    justify-content: center;
    align-items: center;
}
```

### 1-3. カラースウォッチの拡大（要件 3）

`renderCategoryList()` で inline style として設定している `width: 16px; height: 16px` を `24px` に変更する（CSS クラス `.category-readonly-swatch` に移動して管理）。
Retro 系の頭文字表示は JS 側で実装する（後述）。

```css
/* style.css に追加 */
.category-readonly-swatch {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    min-width: 24px;
    border-radius: 50%;
    font-size: 0.7rem;
    font-weight: bold;
    line-height: 1;
    flex-shrink: 0;
}
```

### 1-4. 業務カテゴリ名のフォントサイズ（要件 4）

```css
/* style.css に追加 */
.category-readonly-name {
    font-size: 0.925rem;
    font-weight: 500;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
}
```

### 1-5. タグ値・アニメーション値の省略（要件 9）

```css
/* style.css に追加 */
.category-readonly-detail-value {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
}
```

---

## 2. カテゴリタブ JS 変更（`renderCategoryList()` リファクタリング）

### 現状の構造

```
.category-editor-item
  ├─ .cat-editor-row.row-1 (flex: スウォッチ16px + 名前)
  └─ .cat-editor-row.row-2 (flex-direction: column, タグ + アニメ)
       ├─ tagsWrapper (条件付き: タグあり時のみ)
       └─ animWrapper (条件付き: animation !== 'none' 時のみ)
```

### 変更後の構造（要件 3〜9 を統合）

スウォッチ幅（24px）と gap（8px）で合計 32px を左オフセットとして、row-2・row-3 に `padding-left` を設定し、名前・タグ・アニメーション行の左端をそろえる。タグとアニメーション設定は row-2 / row-3 として独立した行に分けて配置する。

```
.category-editor-item
  ├─ .cat-editor-row.row-1 (flex: スウォッチ24px + 名前 [overflow:hidden, text-overflow:ellipsis])
  ├─ .cat-detail-row.row-2 (padding-left: 32px — タグ行)
  │    ├─ <span class="material-symbols-outlined">sell</span>
  │    └─ <span class="category-readonly-detail-value">{タグ値 or 空}</span>
  └─ .cat-detail-row.row-3 (padding-left: 32px — アニメーション行)
       ├─ <span class="material-symbols-outlined">animation</span>
       └─ <span class="category-readonly-detail-value">{アニメ名 or t('anim-none')}</span>
```

### スウォッチへの Retro 頭文字追加（要件 3）

```javascript
const swatch = createEl('span');
swatch.className = 'category-readonly-swatch';
swatch.style.backgroundColor = getColorCode(cat.color);

// Retro 系の頭文字と文字色
const retroMap = { 'retro-lcd': 'L', 'retro-crt': 'C', 'retro-nixie': 'N' };
const retroTextColor = { 'retro-lcd': '#0f380f', 'retro-crt': '#030c04', 'retro-nixie': '#1a0800' };
if (retroMap[cat.color]) {
    swatch.textContent = retroMap[cat.color];
    swatch.style.color = retroTextColor[cat.color];
}
```

### row-2 の左オフセット

`row-2` に `paddingLeft: '32px'` (= スウォッチ24px + gap8px) を設定することで、
row-1 の名前テキストの開始位置と row-2 の内容の開始位置がそろう。

### タグ行（常に表示・要件 7）— row-2

```javascript
const tagsRow = createEl('div');
tagsRow.className = 'cat-detail-row row-2';
tagsRow.style.paddingLeft = '32px'; // スウォッチ24px + gap8px

const tagIcon = createEl('span');
tagIcon.className = 'material-symbols-outlined';
tagIcon.style.fontSize = '0.9rem';
tagIcon.textContent = 'sell';

const tagValue = createEl('span');
tagValue.className = 'category-readonly-detail-value';
// タグあり: "tag1, tag2"、タグなし: textContent は空のまま
const tagStr = (cat.tags || '').split(',').map(s => s.trim()).filter(Boolean).join(', ');
tagValue.textContent = tagStr;

tagsRow.appendChild(tagIcon);
tagsRow.appendChild(tagValue);
item.appendChild(tagsRow); // item に直接追加
```

### アニメーション行（常に表示・要件 8）— row-3

```javascript
const animRow = createEl('div');
animRow.className = 'cat-detail-row row-3';
animRow.style.paddingLeft = '32px'; // スウォッチ24px + gap8px

const animIcon = createEl('span');
animIcon.className = 'material-symbols-outlined';
animIcon.style.fontSize = '0.9rem';
animIcon.textContent = 'animation';

const animValue = createEl('span');
animValue.className = 'category-readonly-detail-value';
const anim = cat.animation || 'none';
if (anim === 'none') {
    animValue.textContent = t('anim-none');
} else if (anim === 'default') {
    animValue.textContent = t('anim-default');
} else {
    // 既存のアニメーション名解決ロジックを流用
    const stdAnim = animations.find(a => a.id === anim);
    if (stdAnim) {
        animValue.textContent = typeof stdAnim.metadata.name === 'object'
            ? (stdAnim.metadata.name[lang] || stdAnim.metadata.name['en'] || stdAnim.id)
            : stdAnim.metadata.name;
    } else if (customAnims[anim]) {
        animValue.textContent = customAnims[anim].name;
    } else {
        animValue.textContent = anim;
    }
}

animRow.appendChild(animIcon);
animRow.appendChild(animValue);
item.appendChild(animRow); // item に直接追加
```

### item への追加順序

```javascript
item.appendChild(row1);     // row-1: スウォッチ + 業務カテゴリ名
item.appendChild(tagsRow);  // row-2: タグシンボル + タグ値（常時）
item.appendChild(animRow);  // row-3: アニメーションシンボル + アニメーション名（常時）
// 旧 row-2 の item.appendChild(row2) および条件分岐は削除

---

## 3. アラームタブ CSS 変更

### 3-1. 稼働曜日 Disabled スタイル解除（要件 10）

設定パネル内の `#business-days-container` に限定して `disabled` の opacity を上書きする。
アラームエディタの稼働曜日（`#business-days-container` が `alarm-editor/index.html` 内にある場合）には影響しない。

```css
/* 設定パネル内の稼働曜日チップは disabled でも通常の表示を維持 */
#alarms-tab #business-days-container .filter-chip:disabled,
#alarms-tab #business-days-container .filter-chip[disabled] {
    opacity: 1;
    cursor: default;
}

/* dark テーマの button:disabled { opacity: 0.5 } を上書き */
body.theme-dark #alarms-tab #business-days-container .filter-chip:disabled,
body.theme-dark #alarms-tab #business-days-container .filter-chip[disabled] {
    opacity: 1;
}
```

### 3-2. 稼働曜日編集ボタンの横幅（要件 11）

`renderBusinessDays()` で `editBtn.style.marginLeft = '8px'` として inline style が付与されているが、
`icon-btn` クラスは `width: 36px; height: 36px` を持つ。実際に過剰に広く見える原因が CSS で `width` が上書きされているか確認し、必要なら以下を追加する。

```css
#business-days-edit-btn {
    width: 36px !important;
    min-width: 36px !important;
    max-width: 36px !important;
    flex-shrink: 0;
}
```

### 3-3. 時刻フィールドの横幅最適化と「確認が必要」の右寄せ（要件 12）

`.alarm-row` は `flex` レイアウト。`.alarm-enabled-label` は `min-width: 80px`。
`.alarm-time` は現在 `flex: 1` で伸長している。

```css
/* BEFORE */
.alarm-time {
    flex: 1;
    font-size: 1rem;
    padding: 2px 8px !important;
    border-radius: var(--md-sys-shape-extra-small);
    border: 1px solid var(--md-sys-color-outline);
    background-color: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface);
}

/* AFTER */
.alarm-time {
    flex: none;
    width: fit-content;
    min-width: 4.5rem;   /* 時刻テキスト "09:00" が確実に収まる最低幅 */
    font-size: 1rem;
    padding: 2px 8px !important;
    border-radius: var(--md-sys-shape-extra-small);
    border: 1px solid var(--md-sys-color-outline);
    background-color: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface);
    text-align: center;
}
```

`.alarm-confirm` の右寄せ:

```css
.alarm-confirm {
    /* width: 16px !important; height: 16px !important; を変更 */
    margin-left: auto;     /* 行の右端に押し出す */
    display: flex;
    align-items: center;
}
```

---

## 4. アラーム・エディタ 初期選択（要件 13）

`projects/alarm-editor/js/alarm-editor.js` の `init()` 関数内で、
`state.recordAction(); state.isDirty = false;` の直後に先頭アラームを選択する処理を追加する。

```javascript
// Spec: 先頭アラームを初期選択（アラームが存在する場合のみ）
if (state.alarms.length > 0 && !state.selectedAlarmId) {
    state.selectedAlarmId = state.alarms[0].id;
}
```

この後 `syncUI()` が呼ばれるフローには乗らないため、`ui.renderAlarmList()` と `ui.renderDetail()` を明示的に呼ぶか、または `syncUI()` を 1 度呼ぶ形で実装する。
`syncUI()` は `async` なので、`init()` 末尾で `await syncUI()` を呼ぶことで統一的に処理できる。
ただし `syncUI()` 内部で `saveAllAlarms` / `saveBusinessDays` が呼ばれるため、初期状態の不要な保存が発生しないよう、選択状態の設定後に `state.isDirty` を `false` に戻す処理を維持する。

---

## 5. アニメーション・メーカー 変更（要件 14）

### HTML 変更（`projects/animation-maker/index.html`）

`#drop-zone` 内のシンボルを変更する。

```html
<!-- BEFORE -->
<span class="material-symbols-outlined cloud-icon" style="font-size:36px;">cloud_upload</span>

<!-- AFTER -->
<span class="material-symbols-outlined cloud-icon" style="font-size:36px;">gif_box</span>
```

### i18n 変更（全言語ファイル）

`maker-drop-hint` キーの値を変更する。各言語の翻訳は以下のとおり。

| 言語 | 変更後の文言 |
|------|------------|
| ja | ここにアニメーションGIFをドロップするか、クリックして選択してください |
| en | Drop an animated GIF here, or click to select |
| de | Animiertes GIF hier ablegen oder zum Auswählen klicken |
| es | Suelta un GIF animado aquí o haz clic para seleccionarlo |
| fr | Déposez un GIF animé ici ou cliquez pour le sélectionner |
| pt | Solte um GIF animado aqui ou clique para selecionar |
| ko | 여기에 애니메이션 GIF를 드롭하거나 클릭하여 선택하세요 |
| zh | 将动态GIF拖放到此处，或点击选择 |

---

## 変更量の見積もり

| ファイル | 変更規模 |
|---------|---------|
| `projects/app/css/style.css` | ~50 行（追加・修正） |
| `projects/app/js/app.js` | ~60 行（`renderCategoryList` の row-2 ロジック全面書き換え） |
| `projects/alarm-editor/js/alarm-editor.js` | ~5 行 |
| `projects/animation-maker/index.html` | 1 行 |
| `shared/js/locales/ja.js` 他 8 ファイル | 各 1 行 |

バージョンバンプ対象: `projects/app/` および `shared/` への変更が含まれるため、**マイナーバンプ**が必要。
