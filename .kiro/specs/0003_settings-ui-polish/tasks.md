# 実装タスク: 設定パネル・関連ツールの UI ポリッシュ

## タスク一覧

---

### タスク 1: CSS — カテゴリリストの仕切り線除去と改ページ中央揃え

**対象ファイル:** `projects/app/css/style.css`

- [ ] `#category-editor-list` から `border-bottom: 1px solid var(--md-sys-color-outline-variant);` を削除する（要件 1）
- [ ] `.category-editor-item.page-break-item` に `display: flex; justify-content: center; align-items: center;` を追加する（要件 2）

---

### タスク 2: CSS — カラースウォッチ・カテゴリ名・詳細値のスタイル追加

**対象ファイル:** `projects/app/css/style.css`

- [ ] `.category-readonly-swatch` クラスのスタイルを追加する（24px 正円・inline-flex・中央揃え・0.7rem bold）（要件 3）
- [ ] `.category-readonly-name` クラスのスタイルを追加する（0.925rem・font-weight 500・overflow hidden・white-space nowrap・text-overflow ellipsis）（要件 4, 9）
- [ ] `.category-readonly-detail-value` クラスのスタイルを追加する（overflow hidden・white-space nowrap・text-overflow ellipsis・min-width 0）（要件 9）
- [ ] `.cat-detail-row` クラスのスタイルを追加する（display flex・align-items center・gap 4px・font-size 0.8rem・color on-surface-variant）

---

### タスク 3: CSS — アラームタブの Disabled / 時刻幅 / 右寄せ

**対象ファイル:** `projects/app/css/style.css`

- [ ] `#alarms-tab #business-days-container .filter-chip:disabled` セレクタで `opacity: 1; cursor: default;` を設定する（要件 10）
- [ ] `body.theme-dark` の対応セレクタでも `opacity: 1` を上書きする（要件 10）
- [ ] `#business-days-edit-btn` に `width: 36px; min-width: 36px; max-width: 36px; flex-shrink: 0;` を設定する（要件 11）
- [ ] `.alarm-time` を `flex: none; width: fit-content; min-width: 4.5rem; text-align: center;` に変更する（要件 12）
- [ ] `.alarm-confirm` に `margin-left: auto; display: flex; align-items: center;` を追加/変更する（要件 12）

---

### タスク 4: JS — `renderCategoryList()` の DOM 生成ロジック全面改修

**対象ファイル:** `projects/app/js/app.js`

- [ ] 通常カテゴリアイテムのスウォッチを `width/height` inline style から `.category-readonly-swatch` CSS クラスに変更し、Retro 系（retro-lcd / retro-crt / retro-nixie）のとき textContent に頭文字（L / C / N）と文字色を設定する（要件 3）
- [ ] `nameSpan` に `.category-readonly-name` クラスを付与する（要件 4）
- [ ] タグ行（row-2）を item に直接追加する独立 div として生成する: `sell` シンボル + タグ値（未設定時は空テキスト）・`padding-left: 32px`（スウォッチ 24px + gap 8px）（要件 5, 6, 7, 9）
- [ ] アニメーション行（row-3）を item に直接追加する独立 div として生成する: `animation` シンボル + アニメーション名（未設定時は `t('anim-none')`）・`padding-left: 32px`（要件 5, 6, 8, 9）
- [ ] 旧 row-2（タグとアニメを 1 つの div にまとめた実装）と `tags.length > 0 || anim !== 'none'` の条件分岐を削除する（要件 7, 8）
- [ ] タグ値とアニメーション値のテキストを含む `span` に `.category-readonly-detail-value` クラスを付与する（要件 9）

---

### タスク 5: JS — アラーム・エディタの初期選択追加

**対象ファイル:** `projects/alarm-editor/js/alarm-editor.js`

- [ ] `init()` 内の `state.recordAction(); state.isDirty = false;` の後に、`state.alarms.length > 0` かつ `!state.selectedAlarmId` のとき `state.selectedAlarmId = state.alarms[0].id;` を設定する（要件 13）
- [ ] 初期選択を設定した後に `ui.renderAlarmList()` と `ui.renderDetail()` を呼んで表示に反映させる（要件 13）

---

### タスク 6: HTML + i18n — アニメーション・メーカーの変更

**対象ファイル:**
- `projects/animation-maker/index.html`
- `shared/js/locales/ja.js`
- `shared/js/locales/en.js`
- `shared/js/locales/de.js`
- `shared/js/locales/es.js`
- `shared/js/locales/fr.js`
- `shared/js/locales/pt.js`
- `shared/js/locales/ko.js`
- `shared/js/locales/zh.js`

- [ ] `projects/animation-maker/index.html` の `#drop-zone` 内シンボルを `cloud_upload` → `gif_box` に変更する（要件 14）
- [ ] `shared/js/locales/ja.js` の `maker-drop-hint` を「ここにアニメーションGIFをドロップするか、クリックして選択してください」に変更する（要件 14）
- [ ] 他 7 言語（en / de / es / fr / pt / ko / zh）の `maker-drop-hint` を設計書の訳文で更新する（要件 14）

---

### タスク 7: バージョンバンプ

- [ ] `npm run version:bump` を実行してマイナーバンプを行い、CI が通ることを確認する
  - `projects/app/` および `shared/` への変更が含まれるため **マイナーバンプ**

---

### タスク 8: 動作確認

**ライトモードとダークモードの両方で以下を確認すること。**

- [ ] カテゴリタブ: リストと「編集」ボタン間の仕切り線がない
- [ ] カテゴリタブ: 改ページアイテムのシンボルと文字が中央揃えになっている
- [ ] カテゴリタブ: スウォッチが 24px になり、Retro 系で L/C/N が表示される（ライト / ダーク両モードで文字が視認できる）
- [ ] カテゴリタブ: 業務カテゴリ名が大きく表示されている（ライト / ダーク両モードで読みやすい）
- [ ] カテゴリタブ: タグ・アニメーション設定の項目名がシンボル 1 文字（sell / animation）になっている（ライト / ダーク両モードで視認できる）
- [ ] カテゴリタブ: 名前（row-1）・タグ（row-2）・アニメーション値（row-3）の左端がそろっている
- [ ] カテゴリタブ: タグ未設定カテゴリでも `sell` シンボルが表示される
- [ ] カテゴリタブ: アニメーション未設定カテゴリで「無し」が表示される
- [ ] カテゴリタブ: 長い名前・タグ・アニメーション名が `...` で省略表示される
- [ ] アラームタブ: 稼働曜日チップが disabled でも色が正しく表示される（日曜・土曜の色がライト / ダーク両モードで識別できる）
- [ ] アラームタブ: 稼働曜日「編集」ボタンが適切な幅（36px 程度）に収まっている
- [ ] アラームタブ: 時刻が内容幅に収まり、確認アイコンが行の右端に表示される（ライト / ダーク両モードで視認できる）
- [ ] アラーム・エディタ: 開いた直後に先頭アラームが選択されて右ペインに詳細が表示される
- [ ] アニメーション・メーカー: ドロップゾーンのシンボルが `gif_box` になっている
- [ ] アニメーション・メーカー: ドロップゾーンの文言が新しい文言になっている（日本語確認）
- [ ] `npm test` が通る
