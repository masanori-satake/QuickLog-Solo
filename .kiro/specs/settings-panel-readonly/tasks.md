# 実装計画: 設定パネルの閲覧専用化とエディタ連携強化

## 概要

設定パネルのカテゴリタブ・アラームタブのインライン編集 UI を閲覧専用 UI に置き換える。
タスクは 4 つのウェーブに分かれる。

- **Wave 0:** `app.html` の DOM 構造変更（他ウェーブの前提）
- **Wave 1:** `app.js` の描画ロジック・イベントリスナーの書き換え（Wave 0 完了後）
- **Wave 2:** i18n 翻訳ファイルの更新（Wave 0 完了後、Wave 1 と並行可）
- **Wave 3:** E2E テストの修正・バージョンバンプ（Wave 1, 2 完了後）

---

## タスク

- [ ] 1. app.html — 不要 DOM 要素の削除とラベル更新

  - [ ] 1.1 カテゴリタブの不要 UI 要素を削除する
    - `#add-category-box-settings`（「新しいカテゴリ...」入力と「カテゴリを追加」ボタン、「改ページを追加」ボタンを含むブロック全体）を HTML から削除する
    - `#category-maintenance-box-settings` 内のクリップボード入出力 UI（「カテゴリの入出力 (クリップボード)」ラベル・`export-categories-btn`・`import-categories-btn`・インポートモード選択ラジオボタン）を HTML から削除する
    - `advanced-editor-link` ボタンのラベルを `<span data-i18n="btn-launch-category-editor">編集</span>` に変更する（i18n 文字列は Wave 2 で更新するが、HTML 側のフォールバックテキストも「編集」に合わせる）
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [ ] 1.2 アラームタブの不要 UI 要素を削除し、仕切り線を追加する
    - `#alarms-fixed-footer` 内の「アラームの入出力 (クリップボード)」セクション（ラベル・`export-alarms-btn`・`import-alarms-btn` を含む `.setting-item`）を HTML から削除する
    - `alarm-editor-link` ボタンのラベルを `<span data-i18n="btn-launch-alarm-editor">編集</span>` に変更する
    - `alarm-editor-link` ボタンと `test-notification-btn` ボタンの間に `<hr class="settings-divider">` を追加する
    - _Requirements: 5.1, 5.2, 6.1, 6.4_

- [ ] 2. app.js — カテゴリタブの描画ロジック書き換え

  - [ ] 2.1 `renderCategoryEditor()` を `renderCategoryList()` に完全書き換えする
    - 関数名を `renderCategoryEditor` から `renderCategoryList` に変更する（ファイル内の全呼び出し箇所も合わせて変更）
    - 関数の実装を以下の閲覧専用 UI を生成するコードに**丸ごと置き換える**（旧実装のコードを一行も残さない）
      - 通常カテゴリエントリー: 色見本 `<span>`（`background-color: getColorCode(cat.color)`）・カテゴリ名 `<span>`（`textContent`）・タグ `<span>`（`cat.tags` が空でなければ表示）・アニメーション名 `<span>`（`cat.animation` が `'none'`/`undefined` でなければ翻訳済みラベルを表示）
      - 改ページエントリー: `insert_page_break` アイコン＋ `t('page-break')` テキストの `textContent` 表示
      - `draggable` 属性・ドラッグイベント・削除ボタン・`nameInput`・`colorDropdown`・`animSelect`・`tagInput`・`tagList` は生成しない
      - 各エントリーには `.category-readonly-item` クラスを付与し `cursor: default` を適用する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 2.2 不要な ID 定数と関連コードを削除する
    - `setupEventListeners()` 内の以下のイベントリスナー登録を**完全に除去**する
      - `ID_ADD_CATEGORY_BTN_SETTINGS`（カテゴリ追加ボタン）のリスナー
      - `'add-page-break-btn'`（改ページ追加ボタン）のリスナー
      - `ID_EXPORT_CATEGORIES_BTN`（カテゴリ Export）のリスナー（クリップボード Export の実装コードを含む）
      - `ID_IMPORT_CATEGORIES_BTN`（カテゴリ Import）のリスナー（クリップボード Import の実装コードを含む）
    - ファイル冒頭の以下の定数定義を削除する（DOM 要素が存在しなくなるため）
      - `ID_ADD_CATEGORY_BTN_SETTINGS`
      - `ID_NEW_CATEGORY_NAME_SETTINGS`
      - `ID_EXPORT_CATEGORIES_BTN`
      - `ID_IMPORT_CATEGORIES_BTN`
    - 変更後に `npm run lint` を実行し `no-unused-vars` の新規警告がないことを確認する
    - _Requirements: 2.5, 2.6_

- [ ] 3. app.js — アラームタブの描画ロジック書き換え

  - [ ] 3.1 `renderAlarmList()` の各フォーム要素を閲覧専用表示に置き換える
    - 以下の要素を `<input>`/`<select>` から `<span class="alarm-field-value">` + `textContent` に置き換える
      - 時刻（`alarm.time`）
      - 実行タイミング（`alarm.type` → 翻訳済みラベル）
      - 曜日（weekly 時の `alarm.daysOfWeek` → 翻訳済み曜日名をカンマ区切りで表示）
      - 日付（monthly_date 時の `alarm.dayOfMonth`）
      - 月末起算日数（monthly_end_relative 時の `alarm.daysBeforeEnd`）
      - 非稼働日調整（`alarm.holidayAdjustment` → 翻訳済みラベル）
      - メッセージ（`alarm.message`）
      - 動作（`alarm.action` → 翻訳済みラベル）
      - 開始カテゴリ（`alarm.actionCategory`）
      - 確認が必要フラグ（`alarm.requireConfirmation` → `task_alt` アイコン表示または `-` テキスト）
    - 条件表示（型に応じた行の表示/非表示）は `alarm.type` の値で静的に判定する（`updateVisibility()` 関数は不要なので削除する）
    - 表示要素には `cursor: default` を適用する
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [ ] 3.2 有効チェックボックスの onchange のみを残し、不要コードを完全除去する
    - `enabledCheck.onchange` を以下の実装に置き換える（インライン、`updateAlarm()` 関数は廃止）
      ```javascript
      enabledCheck.onchange = async () => {
          alarm.enabled = enabledCheck.checked;
          await dbPut(STORE_ALARMS, alarm);
          broadcastSync('alarms-updated');
      };
      ```
    - `updateAlarm()`・`updateVisibility()`・`updateHolidayOptions()` の各関数定義を完全に削除する
    - 削除した各フォーム要素に対応していた `onchange` 登録コードをすべて除去する
    - `setupEventListeners()` 内の `export-alarms-btn`・`import-alarms-btn` のリスナーを**完全に除去**する（実装コードを含む）
    - 変更後に `npm run lint` を実行し `no-unused-vars` の新規警告がないことを確認する
    - _Requirements: 4.3, 5.3, 5.4_

  - [ ] 3.3 `renderBusinessDays()` を閲覧専用化し、鉛筆ボタンを追加する
    - 各チップの `chip.onclick` ハンドラを除去し、`chip.disabled = true` および `chip.style.cursor = 'default'` を設定する（`.active` クラスによる色分けは維持する）
    - `#business-days-container` と同じ flex 行に `id="business-days-edit-btn"` の鉛筆ボタンを追加する
      - アイコン: `material-symbols-outlined` の `edit`
      - `title` 属性: `t('tooltip-edit-business-days')` （i18n 対応）
      - `data-i18n-title` 属性: `'tooltip-edit-business-days'`
      - クリックで `alarm-editor-link` と同じ `getLaunchProjectUrl` ロジックでアラーム・エディタを起動する
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 4. app.js — BroadcastChannel 即時反映とリファクタリング後整合性確認

  - [ ] 4.1 `handleSyncMessage()` にカテゴリタブの即時反映を追加する
    - `data.type === 'sync'` のブランチに以下を追加する
      ```javascript
      const categoriesTab = getEl('categories-tab');
      if (categoriesTab && !categoriesTab.classList.contains('hidden')) {
          renderCategoryList();
      }
      ```
    - `data.type === 'alarms-updated'` のブランチに `renderBusinessDays()` の呼び出しを追加する
    - _Requirements: 8.1, 8.2, 8.4_

  - [ ] 4.2 設定パネル表示時の初期描画を更新する
    - `setupEventListeners()` 内の `#settings-toggle` クリックハンドラで呼ばれている `renderCategoryEditor()` を `renderCategoryList()` に変更する
    - タブ切替ハンドラ内の `renderCategoryEditor()` 呼び出しを `renderCategoryList()` に変更する
    - _Requirements: 8.3_

- [ ] 5. i18n — 全 8 言語の翻訳ファイル更新

  - [ ] 5.1 `btn-launch-category-editor` キーを全言語で更新する
    - `shared/js/locales/ja.js`: `'業務カテゴリ・エディタを起動'` → `'編集'`
    - `shared/js/locales/en.js`: `'Launch Category Editor'` → `'Edit'`
    - `shared/js/locales/de.js`: `'Geschäftskategorie-Editor starten'` → `'Bearbeiten'`
    - `shared/js/locales/es.js`: `'Iniciar el editor de categorías'` → `'Editar'`
    - `shared/js/locales/fr.js`: `'Lancer l\'éditeur de catégories'` → `'Modifier'`
    - `shared/js/locales/pt.js`: `'Iniciar o Editor de Categorias'` → `'Editar'`
    - `shared/js/locales/ko.js`: `'업무 카테고리 에디터 실행'` → `'편집'`
    - `shared/js/locales/zh.js`: 現在の値 → `'编辑'`
    - _Requirements: 3.2, 9.1_

  - [ ] 5.2 `btn-launch-alarm-editor` キーを全言語で更新する
    - `shared/js/locales/ja.js`: `'アラーム・エディタを起動'` → `'編集'`
    - `shared/js/locales/en.js`: `'Launch Alarm Editor'` → `'Edit'`
    - `shared/js/locales/de.js`: `'Alarm-Editor starten'` → `'Bearbeiten'`
    - `shared/js/locales/es.js`: `'Iniciar el editor de alarmas'` → `'Editar'`
    - `shared/js/locales/fr.js`: `'Lancer l\'éditeur d\'alarmes'` → `'Modifier'`
    - `shared/js/locales/pt.js`: `'Iniciar o Editor de Alarmes'` → `'Editar'`
    - `shared/js/locales/ko.js`: `'알람 에디터 실행'` → `'편집'`
    - `shared/js/locales/zh.js`: `'启动闹钟编辑器'` → `'编辑'`
    - _Requirements: 6.2, 9.2_

  - [ ] 5.3 `tooltip-edit-business-days` キーを全言語に追加する
    - `shared/js/locales/ja.js`: `'アラーム・エディタで稼働曜日を編集します'`
    - `shared/js/locales/en.js`: `'Edit business days in the Alarm Editor'`
    - `shared/js/locales/de.js`: `'Arbeitstage im Alarm-Editor bearbeiten'`
    - `shared/js/locales/es.js`: `'Editar días laborables en el Editor de alarmas'`
    - `shared/js/locales/fr.js`: `'Modifier les jours ouvrables dans l\'éditeur d\'alarmes'`
    - `shared/js/locales/pt.js`: `'Editar dias úteis no Editor de Alarmes'`
    - `shared/js/locales/ko.js`: `'알람 에디터에서 근무 요일 편집'`
    - `shared/js/locales/zh.js`: `'在闹钟编辑器中编辑工作日'`
    - _Requirements: 7.5, 9.3_

  - [ ] 5.4 削除候補の i18n キーを整理する
    - 以下のキーについて全ファイル（`app.html`・`app.js`・`alarm-editor/`・`category-editor/` 内の HTML/JS）を検索し、参照がゼロになったキーのみ全 8 言語ファイルから削除する
      - `alarm-io-title`（`alarm-editor/` 内を要確認）
      - `category-backup`（`category-editor/` 内を要確認）
      - `placeholder-new-category`（`category-editor/` 内を要確認）
      - `btn-add-category`・`btn-add-page-break`（`category-editor/` 内を要確認）
      - `btn-export-json`・`btn-import-json`（両エディタ内を要確認）
      - `import-setting`・`import-append`・`import-overwrite`（両エディタ内を要確認）
    - 参照が残るキーは削除しない
    - _Requirements: 9.4_

- [ ] 6. E2E テストの修正と最終確認

  - [ ] 6.1 `tests/maintenance.spec.js` を修正する
    - `#new-category-name-settings` / `#add-category-btn-settings` を使ったカテゴリ追加操作を削除する
    - カテゴリが存在することの確認を `.category-edit-name[value="..."]`（旧 `<input>`）から新しい閲覧専用セレクタ（`.category-readonly-name` 相当）またはメインUI の `.category-btn` で検証する形に変更する
    - 「should reset settings only」テストのカテゴリ存在確認を同様に修正する
    - 「should reset categories and settings」テストのカテゴリ非存在確認を同様に修正する
    - _Requirements: 10.2_

  - [ ] 6.2 `tests/ui_settings.spec.js` を修正する
    - 「should persist alarm settings」テストで `.alarm-time`・`.alarm-message`・`.alarm-action`（閲覧専用化後は `<input>`/`<select>` でなくなる）への `fill()`・`selectOption()` を削除する
    - 有効チェックボックス（`.alarm-enabled`）のトグルと再ロード後の状態確認のみを残す
    - _Requirements: 10.2_

  - [ ] 6.3 `npm test` と `npm run lint` を実行し、全テストパスを確認する
    - Jest ユニットテストが全件パスすることを確認する
    - ESLint に新規エラー・警告がないことを確認する（特に `no-unused-vars`）
    - `python scripts/verify_project_policies.py` を実行し、ポリシー違反がないことを確認する
    - _Requirements: 10.1, 10.3_

  - [ ] 6.4 マイナーバージョンバンプを実行する
    - `projects/app/` および `shared/` への変更を伴うため `npm run version:bump` を実行する（機能変更のためマイナーバンプ）
    - バンプ後に `npm test` を再実行し、バージョン整合性チェックがパスすることを確認する
    - _Requirements: バージョンバンプ（非機能要件）_

---

## 注意事項

- タスク 1 は Wave 0。タスク 2〜4 （Wave 1）およびタスク 5（Wave 2）はタスク 1 完了後に開始できる。Wave 1 と Wave 2 は並行実行可能。
- タスク 2 と 3 は `app.js` の異なる関数群を扱うため並行実行可能だが、同一ファイルを編集するため 1 つずつ順番に実施することを推奨する。
- タスク 3.1 と 3.2 は同じ `renderAlarmList()` 関数を扱うため、**必ず 3.1 → 3.2 の順**で実施する。
- タスク 5.4 の i18n キー削除は必ず参照調査を先に行い、誤って使用中のキーを削除しないこと。
- タスク 6.4（バージョンバンプ）は必ず最後に実施する。

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "3.2", "3.3", "4.1", "4.2", "5.1", "5.2", "5.3", "5.4"] },
    { "id": 2, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 3, "tasks": ["6.4"] }
  ]
}
```
