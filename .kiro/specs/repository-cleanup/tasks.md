# 実装計画: リポジトリ棚卸し（Phase 0 + Phase 1）

## 概要

本計画は、リポジトリに蓄積された軽微な不整合・重複・設定誤りを解消するための実装タスクを定義する。
Phase 0 の 7 タスクは互いに独立しており並行実行可能。Phase 1 の 4 タスクも独立して実行可能だが、IF-01a/b/c が完了してから 2.4（バージョンバンプ）を実施する。

---

## タスク

- [x] 1. Phase 0: 即時修正（依存関係なし）

    - [x] 1.1 IF-02: check_root_files.py の許可リスト修正
        - `scripts/check_root_files.py` の `ALLOWED_ROOT_ITEMS` セットから `"jest.setup.js"` のエントリを削除する
        - `"jest.setup.cjs"` は残す
        - 修正後、`python scripts/check_root_files.py` を実行してエラーが出ないことを確認する
        - _Requirements: 1.1, 1.2, 1.3_

    - [x] 1.2 IF-03: background.js の重複 JSDoc 削除
        - `projects/app/js/background.js` の冒頭 3 行（`/** background.js / Chrome Extension Service Worker for QuickLog-Solo */` の簡易ブロック）を削除する
        - ファイルが `import` 文から始まるようにする
        - 行 12–17 相当の詳細版 JSDoc（`This service worker handles...` を含むもの）は保持する
        - _Requirements: 2.1, 2.2, 2.3_

    - [x] 1.3 IF-04: README_TEST.md のファイル名修正
        - `docs/README_TEST.md` のセクション「2.1.4. バックアップ・ユーティリティ・i18n」の表で、`i18n.test_node.js` と記載されている箇所を `i18n.test.js` に修正する
        - 同一行の他のセル内容は変更しない
        - _Requirements: 3.1, 3.2, 3.3_

    - [x] 1.4 IF-05: requirements.txt の重複ファイル削除
        - `.github/workflows/requirements.txt`（空ファイル）を削除する
        - ルートの `requirements.txt` はそのまま保持する
        - CI ワークフローファイルは変更しない
        - _Requirements: 4.1, 4.2, 4.3, 4.4_

    - [x] 1.5 IF-06: package.json の name フィールド修正
        - `package.json` の `"name"` フィールドを `"app"` から `"quicklog-solo"` に変更する
        - 他のフィールドは変更しない
        - _Requirements: 5.1, 5.2, 5.3_

    - [x] 1.6 RD-03: README_DEV.md のテスト実行方法を参照リンクに置換
        - `docs/README_DEV.md` の §10「テストと品質管理」内にある以下の 2 箇所を削除し、参照リンクに置き換える:
            1. `### 実行コマンド` 見出しとその下のコードブロック（`npm test` / `npx eslint .` / `npx stylelint "**/*.css"`）
            2. `### pre-commit フック` 見出しとその下の箇条書き（項目 1–5）
        - 置換後のテキスト: `詳細は [テスト計画書 (README_TEST.md)](README_TEST.md) を参照してください。`
        - `### テスト環境の仮想化` 見出し、mermaid 図、その下の詳細説明（「仮想化の詳細」以降）は保持する
        - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

    - [x] 1.7 MS-04: AGENTS.md の言語統制ルール明確化
        - `AGENTS.md` のセクション 3.2「言語統制」にある `**強制チェック:**` の行の直後（同段落末尾）に以下の一文を追加する:
          `**除外範囲（英語で構わない）:** コード内コメント（JS / Python / YAML / Shell）、CI/CD ワークフローファイル内のコメント、および \`scripts/\` 配下のスクリプト内コメント。`
        - 既存の文章はすべて保持する
        - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 2. Phase 0 チェックポイント
    - すべての Phase 0 タスクが完了したことを確認する。`npm run lint` と `python scripts/check_root_files.py` を実行してエラーがないことを確認する。問題があればユーザーに報告する。

- [ ] 3. Phase 1: 段階的改善

    - [-] 3.1 IF-01a: shared/js/utils.js の ESLint 除外解除と修正
        - `eslint.config.js` の `ignores` リストから `'shared/js/utils.js'` を削除する
        - `npx eslint shared/js/utils.js` を実行して発生したエラーをすべて修正する:
            - `no-unused-vars`: 未使用変数を削除するか変数名の先頭に `_` を付与する
            - `prettier/prettier`: `package.json` の `format` スクリプトに `shared/js/utils.js` を追加して `npm run format` を実行する
            - その他のエラーは動作変更を最小限にして個別対応する
        - _Requirements: 8.1, 8.4_

    - [-] 3.2 IF-01b: shared/js/schema.js の ESLint 除外解除と修正
        - `eslint.config.js` の `ignores` リストから `'shared/js/schema.js'` を削除する
        - `npx eslint shared/js/schema.js` を実行して発生したエラーをすべて修正する（方針は 3.1 と同じ）
        - _Requirements: 8.2, 8.4_

    - [-] 3.3 IF-01c: shared/js/i18n.js の ESLint 除外解除と修正
        - `eslint.config.js` の `ignores` リストから `'shared/js/i18n.js'` を削除する
        - `npx eslint shared/js/i18n.js` を実行して発生したエラーをすべて修正する（方針は 3.1 と同じ）
        - _Requirements: 8.3, 8.4_

    - [~] 3.4 IF-01d: ESLint 除外解除後のバージョンバンプ（パッチ）
        - タスク 3.1, 3.2, 3.3 がすべて完了し、`npm run lint` がエラーなしで通ることを確認する
        - `npm run version:bump` を実行してパッチバージョンをインクリメントする
        - `npm test` を実行してユニットテストがすべてパスすることを確認する
        - _Requirements: 8.5_

    - [-] 3.5 AM-02: ESLint 除外理由のコメント追記
        - `eslint.config.js` の `export default [` の直後、最初の `{` ブロック（`ignores` を含む）の直前に、以下のコメントブロックを追加する:
            ```javascript
            // TODO: 以下は段階的に除外解除予定。現在除外している理由:
            // - shared/js/db.js, logic.js, session_sync.js 等: ESLint 導入以前から存在する legacy コード。
            //   エラー数が多く一括対応が困難なため一時除外中。Phase 1 以降で順次解除予定。
            // - projects/app/js/background.js, backup.js: chrome.* API 使用コードで
            //   当初エラーが多発したため除外。globals 設定追加後も未解除のまま。
            // - projects/studio/, alarm-editor/ 等: サブプロジェクトはメインとは別フェーズで対応予定。
            ```
        - 既存の `ignores` エントリはすべて保持する
        - _Requirements: 9.1, 9.2, 9.3, 9.4_

    - [-] 3.6 RD-04: pre-commit の jest フックをJS変更時のみ実行に変更
        - `.pre-commit-config.yaml` の `jest` フック設定を以下のように変更する:
            - `always_run: true` → `always_run: false`
            - `files: \.(js|cjs)$` を追加する
        - 他のフックの設定は変更しない
        - _Requirements: 10.1, 10.2, 10.3, 10.4_

    - [-] 3.7 OD-04: release_web_deploy.yml のトリガー修正
        - `.github/workflows/release_web_deploy.yml` の `on.push.paths` リストから `- 'releases/**'` の行を削除する
        - 他の `paths` エントリは変更しない
        - _Requirements: 11.1, 11.2, 11.3_

- [~] 4. 最終チェックポイント
    - すべてのタスクが完了したことを確認する。`npm run lint` と `npm test` を実行してエラーがないことを確認する。問題があればユーザーに報告する。

---

## 注意事項

- Phase 0 のタスク（1.1〜1.7）はすべて独立しており、任意の順序・並行で実行可能
- Phase 1 の IF-01a/b/c（3.1〜3.3）も互いに独立しているが、バンプ（3.4）はこれら 3 つが完了してから実施すること
- `shared/` 配下のファイルを変更するのは IF-01（3.1〜3.3）のみ。それ以外の変更はバージョンバンプ不要
- ESLint の flat config では `ignores` 配列内にコメントを直接書けないため、AM-02 では `ignores` ブロックの直前にコメントを置く形式を採用する
- タスクに `*` は付いていない（すべて必須タスク）

## Task Dependency Graph

```json
{
    "waves": [
        { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"] },
        { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.5", "3.6", "3.7"] },
        { "id": 2, "tasks": ["3.4"] }
    ]
}
```
