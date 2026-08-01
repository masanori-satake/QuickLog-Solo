# 要件定義書: リポジトリ棚卸し（Phase 0 + Phase 1）

## はじめに

QuickLog-Solo リポジトリに蓄積された軽微な不整合・重複・設定誤りを解消し、コードベースの品質と保守性を向上させる。
本 spec は Phase 0（コスト低・リスクゼロの即時修正）と Phase 1（中規模・影響度大の段階的改善）を対象とする。

## 用語集

- **Cleanup_System**: 本 spec の変更対象となるリポジトリ全体
- **check_root_files.py**: ルートディレクトリの許可アイテムを検証する pre-commit スクリプト
- **ALLOWED_ROOT_ITEMS**: `check_root_files.py` 内で定義された許可リスト（Python の `set`）
- **eslint.config.js**: ESLint の flat config 設定ファイル（ignores リストを含む）
- **shared/**: 複数サブプロジェクトで共有されるモジュール群（変更時はバージョンバンプ必須）
- **pre-commit フック**: `.pre-commit-config.yaml` で定義されたコミット前自動チェック
- **バージョンバンプ**: `npm run version:bump` による `projects/app/` および関連ファイルのバージョン同期

---

## 要件一覧

### Phase 0 — 即時修正（コスト低・リスクゼロ）

---

### 要件 1: IF-02 — check_root_files.py の許可リスト修正

**ユーザーストーリー:** 開発者として、ルートファイル検証スクリプトが実在しないファイル名を許可リストに含まないようにしたい。それにより、誤検知のない正確な検証が実施できる。

#### 受け入れ基準

1. THE Cleanup_System SHALL remove `"jest.setup.js"` from the `ALLOWED_ROOT_ITEMS` set in `scripts/check_root_files.py`
2. WHEN `check_root_files.py` is executed, THE Cleanup_System SHALL retain `"jest.setup.cjs"` in `ALLOWED_ROOT_ITEMS` as the only Jest setup file entry
3. IF `"jest.setup.js"` remains in `ALLOWED_ROOT_ITEMS`, THEN THE Cleanup_System SHALL be considered non-compliant with this requirement

---

### 要件 2: IF-03 — background.js の重複 JSDoc 削除

**ユーザーストーリー:** 開発者として、`background.js` 冒頭の重複したファイル概要コメントを削除したい。それにより、ファイルの可読性が向上し、どのコメントが正規の説明であるかが明確になる。

#### 受け入れ基準

1. THE Cleanup_System SHALL remove the 3-line block comment at lines 1–3 of `projects/app/js/background.js` (the brief comment containing only the filename and service worker description)
2. WHEN the file is modified, THE Cleanup_System SHALL preserve the detailed JSDoc block (lines 12–17 of the original file) that includes the `functions` description section
3. IF both comment blocks remain after the change, THEN THE Cleanup_System SHALL be considered non-compliant with this requirement

---

### 要件 3: IF-04 — README_TEST.md のテストファイル名修正

**ユーザーストーリー:** 開発者として、`README_TEST.md` に記載されたテストファイル名が実際のファイル名と一致していることを確認したい。それにより、ドキュメントを参照したときに正しいファイルを特定できる。

#### 受け入れ基準

1. THE Cleanup_System SHALL update the test file name in the "2.1.4. バックアップ・ユーティリティ・i18n" table of `docs/README_TEST.md` from `i18n.test_node.js` to `i18n.test.js`
2. WHEN the file is modified, THE Cleanup_System SHALL preserve all other content in the table row unchanged
3. IF `i18n.test_node.js` remains as the test file name in the table after the change, THEN THE Cleanup_System SHALL be considered non-compliant

---

### 要件 4: IF-05 — requirements.txt の二重管理解消

**ユーザーストーリー:** 開発者として、`requirements.txt` が一箇所だけで管理されるようにしたい。それにより、Python 依存ライブラリのバージョン更新が一か所の変更で完結し、メンテナンスコストが削減される。

#### 受け入れ基準

1. THE Cleanup_System SHALL delete the empty file `.github/workflows/requirements.txt`
2. WHEN `.github/workflows/requirements.txt` is deleted, THE Cleanup_System SHALL confirm that the root-level `requirements.txt` (containing `playwright==1.60.0`) remains as the single source of truth
3. THE Cleanup_System SHALL NOT modify any CI workflow files, as they already reference the root-level `requirements.txt` via `pip install -r requirements.txt`
4. IF `.github/workflows/requirements.txt` still exists after the change, THEN THE Cleanup_System SHALL be considered non-compliant

---

### 要件 5: IF-06 — package.json の name フィールド修正

**ユーザーストーリー:** 開発者として、`package.json` の `name` フィールドがプロジェクトの実際の名称を正確に反映していることを確認したい。それにより、パッケージのメタデータが一貫性を持ち、外部ツールやリポジトリ検索で正しく識別される。

#### 受け入れ基準

1. THE Cleanup_System SHALL change the `"name"` field value in `package.json` from `"app"` to `"quicklog-solo"`
2. WHEN the field is updated, THE Cleanup_System SHALL preserve all other fields in `package.json` unchanged
3. IF `"name": "app"` remains in `package.json` after the change, THEN THE Cleanup_System SHALL be considered non-compliant

---

### 要件 6: RD-03 — README_DEV.md のテスト実行方法を参照リンクに置換

**ユーザーストーリー:** 開発者として、`README_DEV.md` の §10 に記載されたテスト実行コマンドが `README_TEST.md` への参照リンクに統一されていることを確認したい。それにより、テスト情報の二重管理を防ぎ、最新情報を一か所で参照できる。

#### 受け入れ基準

1. THE Cleanup_System SHALL replace the "実行コマンド" code block (containing `npm test`, `npx eslint .`, `npx stylelint`) in §10 of `docs/README_DEV.md` with a reference link to `README_TEST.md`
2. THE Cleanup_System SHALL replace the "pre-commit フック" bulleted list in §10 of `docs/README_DEV.md` with the same reference link
3. WHEN the replacements are made, THE Cleanup_System SHALL preserve the "テスト環境の仮想化" subsection (including the mermaid diagram and its detailed description) in §10
4. THE reference link text SHALL be: `詳細は [テスト計画書 (README_TEST.md)](README_TEST.md) を参照してください。`
5. IF the "実行コマンド" code block or "pre-commit フック" bulleted list remains after the change, THEN THE Cleanup_System SHALL be considered non-compliant

---

### 要件 7: MS-04 — AGENTS.md の言語統制ルール適用範囲の明確化

**ユーザーストーリー:** 開発者として、`AGENTS.md` のセクション 3.2 に、コードコメントが言語統制ルールの除外範囲であることが明記されていることを確認したい。それにより、エージェントがコードコメントを英語で書いても違反にならないことが明確になる。

#### 受け入れ基準

1. THE Cleanup_System SHALL add an exclusion scope note to section 3.2 of `AGENTS.md` after the existing "強制チェック" line
2. THE exclusion scope note SHALL explicitly list: コード内コメント（JS / Python / YAML / Shell）、CI/CD ワークフローファイル内のコメント、および `scripts/` 配下のスクリプト内コメント
3. WHEN the note is added, THE Cleanup_System SHALL preserve all existing content in section 3.2 unchanged
4. IF the exclusion scope note is absent from section 3.2 after the change, THEN THE Cleanup_System SHALL be considered non-compliant

---

### Phase 1 — 段階的改善（コスト中・影響大）

---

### 要件 8: IF-01 — ESLint 除外の段階的解除

**ユーザーストーリー:** 開発者として、`shared/js/utils.js`、`shared/js/schema.js`、`shared/js/i18n.js` が ESLint の検査対象に含まれていることを確認したい。それにより、これらのファイルのコード品質が継続的に保証される。

#### 受け入れ基準

1. THE Cleanup_System SHALL remove `'shared/js/utils.js'` from the `ignores` list in `eslint.config.js`
2. THE Cleanup_System SHALL remove `'shared/js/schema.js'` from the `ignores` list in `eslint.config.js`
3. THE Cleanup_System SHALL remove `'shared/js/i18n.js'` from the `ignores` list in `eslint.config.js`
4. WHEN each file is removed from `ignores`, THE Cleanup_System SHALL fix all resulting ESLint errors in that file according to the following rules:
    - `no-unused-vars`: 未使用変数を削除するか `_` プレフィックスを付与する
    - `prettier/prettier`: `npm run format` の対象に当該ファイルを追加してフォーマットを修正する
5. WHEN `shared/js/*.js` files are modified, THE Cleanup_System SHALL execute a patch version bump via `npm run version:bump`
6. IF any of the three files remain in the `ignores` list after the change, THEN THE Cleanup_System SHALL be considered non-compliant for this requirement

---

### 要件 9: AM-02 — ESLint 除外理由のコメント追記

**ユーザーストーリー:** 開発者として、`eslint.config.js` の `ignores` リストに除外理由が記録されていることを確認したい。それにより、なぜファイルが除外されているかを後から参照できる。

#### 受け入れ基準

1. THE Cleanup_System SHALL add a comment block immediately before the `ignores` array in `eslint.config.js` explaining the reason each group of files is excluded
2. THE comment block SHALL describe at minimum: legacy コードのため一時除外中であること、`chrome.*` API 使用コードで当初エラー多発したこと、サブプロジェクトは別フェーズで対応予定であること
3. WHEN the comment is added, THE Cleanup_System SHALL preserve all existing `ignores` entries unchanged
4. IF the `ignores` array has no explanatory comment before it after the change, THEN THE Cleanup_System SHALL be considered non-compliant

---

### 要件 10: RD-04 — pre-commit の jest フックをJS変更時のみ実行に変更

**ユーザーストーリー:** 開発者として、`jest` の pre-commit フックが JS ファイルを変更したときのみ実行されることを確認したい。それにより、ドキュメントや設定ファイルだけを変更した場合のコミット時間が短縮される。

#### 受け入れ基準

1. THE Cleanup_System SHALL change `always_run: true` to `always_run: false` for the `jest` hook in `.pre-commit-config.yaml`
2. THE Cleanup_System SHALL add `files: \.(js|cjs)$` to the `jest` hook configuration in `.pre-commit-config.yaml`
3. WHEN the hook is modified, THE Cleanup_System SHALL preserve all other hook configuration options unchanged
4. IF `always_run: true` remains for the `jest` hook after the change, THEN THE Cleanup_System SHALL be considered non-compliant

---

### 要件 11: OD-04 — release_web_deploy.yml の releases/** トリガー削除

**ユーザーストーリー:** 開発者として、`release_web_deploy.yml` の push トリガーが `releases/**` パスを含まないことを確認したい。それにより、リリース ZIP ファイルが変更されただけでデプロイワークフローが不必要に起動することがなくなる。

#### 受け入れ基準

1. THE Cleanup_System SHALL remove `- 'releases/**'` from the `on.push.paths` list in `.github/workflows/release_web_deploy.yml`
2. WHEN the entry is removed, THE Cleanup_System SHALL preserve all other `on.push.paths` entries unchanged
3. IF `- 'releases/**'` remains in `on.push.paths` after the change, THEN THE Cleanup_System SHALL be considered non-compliant
