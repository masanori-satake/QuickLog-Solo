# Implementation Plan: sidepanel-startup-performance

## Overview

サイドパネル起動時の体感速度を改善するため、app.html の CSS 読み込みを preload パターンに変更し FOUC 防止を追加、app.js の 3 つの render 関数を DocumentFragment によるバッチ処理に変更する。最後にパッチバージョンバンプを行い、既存テストが全パスすることを確認する。

## Tasks

- [x] 1. app.html の CSS 非同期読み込みと FOUC 防止
  - [x] 1.1 ローカル CSS を preload パターンに変更し FOUC 防止用インライン style/script を追加する
    - `shared/css/m3-theme.css` と `css/style.css` の `<link rel="stylesheet">` を `<link rel="preload" href="..." as="style" onload="this.onload=null;this.rel='stylesheet'" />` に置き換える
    - Material Symbols Outlined の `<link rel="stylesheet">` は変更しない（同期読み込み維持）
    - `<head>` 内に FOUC 防止用インライン style を追加: `<style>body{opacity:0;transition:opacity 0.15s}</style>`
    - preload リンクの直後に CSS 読み込み完了検知スクリプトを追加（loaded カウンタ方式で total=2 を検知し `document.body.style.opacity='1'` を設定）
    - タイムアウト（3秒）による安全フォールバック: `setTimeout(function(){ document.body.style.opacity='1'; }, 3000);`
    - `<noscript>` 内に従来の同期 `<link rel="stylesheet">` を 2 つ配置（JavaScript 無効時のフォールバック）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

- [x] 2. app.js の DocumentFragment バッチレンダリング化
  - [x] 2.1 renderCategories() を DocumentFragment によるバッチ処理に変更する
    - `list.replaceChildren()` 後に `const fragment = document.createDocumentFragment()` を作成
    - ループ内の `list.appendChild(btn)` を `fragment.appendChild(btn)` に変更
    - ループ後に `list.replaceChildren(fragment)` で一括挿入
    - 既存の変更検出ロジック（`lastCategoryRenderData` による JSON.stringify 比較）はそのまま維持
    - _Requirements: 3.1, 3.2, 3.3, 7.3_

  - [x] 2.2 renderPaginationDots() を DocumentFragment によるバッチ処理に変更する
    - `container.replaceChildren()` 後に `const fragment = document.createDocumentFragment()` を作成
    - ループ内の `container.appendChild(dot)` を `fragment.appendChild(dot)` に変更
    - ループ後に `container.replaceChildren(fragment)` で一括挿入
    - _Requirements: 5.1, 5.2, 7.5_

  - [x] 2.3 renderLogs() を DocumentFragment によるバッチ処理に変更する
    - `logList.replaceChildren()` 後に `const fragment = document.createDocumentFragment()` を作成
    - ループ内の `logList.appendChild(header)` と `logList.appendChild(li)` を `fragment.appendChild(header)` と `fragment.appendChild(li)` に変更
    - ループ後に `logList.replaceChildren(fragment)` で一括挿入
    - 既存の変更検出ロジック（`lastLogsRenderData` による JSON.stringify 比較）はそのまま維持
    - _Requirements: 4.1, 4.2, 4.3, 7.4_

- [x] 3. Checkpoint - 既存テストの動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. バージョンバンプ
  - [x] 4.1 パッチバージョンをインクリメントする
    - `npm run version:bump` を実行してパッチバージョンをインクリメントする（現在 1.25.0）
    - _Requirements: 6.1_

- [x] 5. Final Checkpoint - 全テストパス確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- 本変更は純粋なパフォーマンスリファクタリングであり、機能追加は一切含まない
- DocumentFragment の変更は既存のイベントハンドラ（onclick）に影響を与えない
- CSS preload パターンは主要モダンブラウザ（Chrome/Edge）で十分にサポートされている
- タイムアウトフォールバック（3秒）により、CSS 読み込み失敗時もアプリが使用不能にならない
- Checkpoints ensure incremental validation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3"] },
    { "id": 2, "tasks": ["4.1"] }
  ]
}
```
