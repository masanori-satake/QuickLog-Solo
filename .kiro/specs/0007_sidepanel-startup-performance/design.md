# Design Document: sidepanel-startup-performance

## Overview

サイドパネル起動時の体感速度を改善するため、2つの最適化アプローチを適用する:

1. **CSS 非同期化** — ローカル CSS を preload パターンで非同期読み込みし、レンダリングブロックを排除
2. **DocumentFragment バッチ処理** — DOM レンダリング関数で個別 appendChild を fragment への一括挿入に変更

いずれも既存の機能に影響を与えず、パフォーマンスのみを向上させるリファクタリングである。

## Architecture

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `projects/app/app.html` | CSS 読み込みパターン変更、FOUC 防止用インライン style/script 追加 |
| `projects/app/js/app.js` | `renderCategories()`, `renderLogs()`, `renderPaginationDots()` の DocumentFragment 化 |

### 変更の影響範囲

```
app.html (CSS loading)
├── <style> inline: FOUC防止 (body{opacity:0})
├── <link rel="preload"> × 2: m3-theme.css, style.css
├── <noscript><link rel="stylesheet"> × 2: フォールバック
└── <script> inline: CSS読み込み完了検知 → opacity:1

app.js (DOM rendering)
├── renderCategories(): DocumentFragment使用
├── renderLogs(): DocumentFragment使用
└── renderPaginationDots(): DocumentFragment使用
```

## Components

### 1. CSS 非同期読み込み機構 (app.html)

#### Preload パターン

従来の同期 `<link rel="stylesheet">` を以下のパターンに置き換える:

```html
<link rel="preload" href="shared/css/m3-theme.css" as="style"
      onload="this.onload=null;this.rel='stylesheet'" />
<link rel="preload" href="css/style.css" as="style"
      onload="this.onload=null;this.rel='stylesheet'" />
```

`onload` ハンドラ内で `this.rel='stylesheet'` に切り替えることで、プリロード完了後にスタイルが適用される。`this.onload=null` は無限ループ防止。

#### FOUC 防止メカニズム

```html
<style>body{opacity:0;transition:opacity 0.15s}</style>
```

インライン style で body を初期非表示にし、CSS 読み込み完了後に JavaScript で `opacity:1` に切り替える:

```html
<script>
(function(){
  var loaded = 0;
  var total = 2;
  function check() {
    if (++loaded >= total) document.body.style.opacity = '1';
  }
  document.querySelectorAll('link[rel="preload"][as="style"]').forEach(function(link) {
    if (link.sheet) { check(); }
    else { link.addEventListener('load', check); }
  });
})();
</script>
```

#### noscript フォールバック

JavaScript が無効な環境でも CSS が読み込まれるよう、`<noscript>` 内に従来の同期読み込みを配置:

```html
<noscript>
  <link rel="stylesheet" href="shared/css/m3-theme.css" />
  <link rel="stylesheet" href="css/style.css" />
</noscript>
```

#### Material Symbols Outlined

外部 Google Fonts CDN からの Material Symbols Outlined は同期読み込み（`rel="stylesheet"`）のまま維持する。理由:
- アイコンフォントが未読込だとレイアウトシフトが発生する
- CDN からの読み込みは preconnect で十分に最適化済み
- ローカルファイルと異なり、ネットワーク遅延が主要因であり preload の効果が限定的

### 2. DocumentFragment バッチレンダリング (app.js)

#### 設計原則

各 render 関数で以下のパターンを適用する:

```javascript
// Before (個別 appendChild)
parent.replaceChildren();
items.forEach(item => {
  const el = createEl('div');
  // ... configure el ...
  parent.appendChild(el);  // N回のDOM操作
});

// After (DocumentFragment バッチ)
const fragment = document.createDocumentFragment();
items.forEach(item => {
  const el = createEl('div');
  // ... configure el ...
  fragment.appendChild(el);  // メモリ内操作のみ
});
parent.replaceChildren(fragment);  // 1回のDOM操作
```

#### renderCategories() の変更

```javascript
async function renderCategories() {
  // ... 既存の変更検出ロジック（維持）...

  const list = getEl(ID_CATEGORY_LIST);
  if (!list) return;

  const fragment = document.createDocumentFragment();
  pageCategories.forEach((cat) => {
    const btn = createEl('button');
    btn.className = `category-btn cat-${cat.color || 'primary'}`;
    const isActive = activeTask && activeTask.category === cat.name;
    if (isActive) {
      btn.classList.add('active');
      btn.disabled = true;
    }
    btn.textContent = cat.name;
    btn.title = cat.name;
    btn.onclick = () => startTask(cat.name);
    fragment.appendChild(btn);
  });
  list.replaceChildren(fragment);

  renderPaginationDots(totalPages);
}
```

#### renderLogs() の変更

```javascript
async function renderLogs() {
  // ... 既存の変更検出ロジック（維持）...

  const logList = getEl(ID_LOG_LIST);
  if (!logList) return;

  const fragment = document.createDocumentFragment();
  let lastDate = '';
  const days = t('day-names');

  visibleLogs.forEach((log) => {
    // ... 日付ヘッダー生成 ...
    if (dateStr !== lastDate) {
      const header = createEl('li');
      header.className = 'log-date-header';
      header.textContent = dateStr;
      fragment.appendChild(header);
      lastDate = dateStr;
    }

    const li = createLogElement(log, categoryMap);
    li.style.cursor = 'pointer';
    li.onclick = () => openHistoryActionModal(log);
    fragment.appendChild(li);
  });
  logList.replaceChildren(fragment);
}
```

#### renderPaginationDots() の変更

```javascript
function renderPaginationDots(totalPages) {
  const container = getEl(ID_CATEGORY_PAGINATION);
  if (!container) return;

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < totalPages; i++) {
    const dot = createEl('div');
    dot.className = 'pagination-dot' + (i === currentCategoryPage ? ' active' : '');
    dot.onclick = () => {
      if (currentCategoryPage !== i) {
        currentCategoryPage = i;
        renderCategories();
      }
    };
    fragment.appendChild(dot);
  }
  container.replaceChildren(fragment);
}
```

## Data Models

本変更ではデータモデルの追加・変更は一切ない。既存の IndexedDB スキーマ（categories, logs, settings）をそのまま使用する。

## Error Handling

### CSS 読み込みエラー

preload リンクの `onerror` は明示的にハンドルしない。理由:
- CSS 読み込み失敗時、`opacity:0` のままだとアプリが使用不能になる
- フォールバックとして、インラインスクリプト内でタイムアウト（3秒）を設定し、CSS 読み込みが完了しなくても body を表示する

```javascript
setTimeout(function() { document.body.style.opacity = '1'; }, 3000);
```

### DocumentFragment

DocumentFragment の使用はエラーを発生させない純粋な最適化であり、追加のエラーハンドリングは不要。既存の try-catch（dbGetAll の失敗時のガード）はそのまま維持される。

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Category rendering correctness

*For any* list of categories and any active task state, after `renderCategories()` completes, the `category-list` element SHALL contain exactly one button per visible category in page order, each with correct class name, text content, title attribute, and—if the category matches the active task—the `active` class and `disabled=true` attribute, with a click handler that calls `startTask` with the category name.

**Validates: Requirements 3.1, 3.2, 7.3**

### Property 2: Category rendering idempotence

*For any* category data and active task state, calling `renderCategories()` twice consecutively with the same underlying data SHALL result in no DOM mutation on the second call (early return via change detection).

**Validates: Requirements 3.3**

### Property 3: Log rendering correctness

*For any* list of log entries sorted by descending start time, after `renderLogs()` completes, the `log-list` element SHALL contain date header elements followed by log item elements in correct chronological grouping, with each log item having a click handler that opens the history action modal with that specific log's data.

**Validates: Requirements 4.1, 4.2, 7.4**

### Property 4: Log rendering idempotence

*For any* log data, calling `renderLogs()` twice consecutively with the same underlying data SHALL result in no DOM mutation on the second call (early return via change detection).

**Validates: Requirements 4.3**

### Property 5: Pagination rendering correctness

*For any* total page count and current page index, after `renderPaginationDots()` completes, the pagination container SHALL contain exactly `totalPages` dot elements, with only the dot at index `currentCategoryPage` having the `active` class, and each dot having a click handler that sets `currentCategoryPage` to its index and re-renders.

**Validates: Requirements 5.1, 5.2, 7.5**
