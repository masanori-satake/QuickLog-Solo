# 設計書: リポジトリ棚卸し（Phase 0 + Phase 1）

## 概要

本 spec は QuickLog-Solo リポジトリに蓄積された 11 件の軽微な不整合・重複・設定誤りを解消するための変更セットを定義する。
変更はすべて既存の動作を破壊しない「修正・整理」の範囲に収まる。

**Phase 0（7件）:** 依存関係なし。各タスクは並行実行可能。`shared/` への変更なし、バージョンバンプ不要。
**Phase 1（4件）:** `shared/js/*.js` を修正するため、完了後にパッチバンプが必要。各タスクは独立して実行可能。

---

## アーキテクチャ

変更は以下の 4 つのカテゴリに分類される。

```
変更カテゴリ
├── 設定スクリプト修正    IF-02, AM-02 (scripts/, eslint.config.js)
├── ソースコード整理       IF-03, IF-01 (projects/app/js/, shared/js/)
├── ドキュメント修正       IF-04, RD-03, MS-04 (docs/, AGENTS.md)
└── CI/CD 設定修正         IF-05, IF-06, RD-04, OD-04 (package.json, .pre-commit-config.yaml, .github/)
```

---

## コンポーネントと変更インターフェース

### Phase 0

#### IF-02: `scripts/check_root_files.py`

**変更内容:** `ALLOWED_ROOT_ITEMS` セットから `"jest.setup.js"` を削除する。

```python
# 変更前
ALLOWED_ROOT_ITEMS = {
    ...
    "jest.setup.js",   # ← 削除
    "jest.setup.cjs",
    ...
}

# 変更後
ALLOWED_ROOT_ITEMS = {
    ...
    "jest.setup.cjs",
    ...
}
```

**理由:** `jest.setup.js` は実在しない（実在するのは `jest.setup.cjs` のみ）。存在しないファイルを許可リストに残すと、同名ファイルが誤って追加された際に検知できなくなる。

---

#### IF-03: `projects/app/js/background.js`

**変更内容:** ファイル冒頭（行 1–3）の簡易版 JSDoc ブロックを削除し、行 12–17 の詳細版を残す。

```javascript
// 変更前（行 1–17）
/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 */

import { ... } from '../shared/js/db.js';
import { ... } from '../shared/js/logic.js';
import { ... } from '../shared/js/i18n.js';
import { ... } from '../shared/js/session_sync.js';

/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 *
 * This service worker handles background alarms and notifications,
 * and executes task logic even when the side panel is closed.
 */

// 変更後（行 1 から import が始まる）
import { ... } from '../shared/js/db.js';
import { ... } from '../shared/js/logic.js';
import { ... } from '../shared/js/i18n.js';
import { ... } from '../shared/js/session_sync.js';

/**
 * background.js
 * Chrome Extension Service Worker for QuickLog-Solo
 *
 * This service worker handles background alarms and notifications,
 * and executes task logic even when the side panel is closed.
 */
```

**理由:** 同一内容のコメントが 2 箇所にあると、片方だけが更新されて内容が乖離するリスクがある。詳細説明を含む後者を残す。

---

#### IF-04: `docs/README_TEST.md`

**変更内容:** セクション 2.1.4 の表内の `i18n.test_node.js` を `i18n.test.js` に修正する。

```markdown
<!-- 変更前 -->

| 正常系 | `i18n.test_node.js` | i18n ロジック検証 (Node) | ...

<!-- 変更後 -->

| 正常系 | `i18n.test.js` | i18n ロジック検証 (Node) | ...
```

**理由:** 実際のファイル名は `tests/i18n.test.js` であり、`i18n.test_node.js` は存在しない。ドキュメントの誤記をそのままにすると、開発者が誤ったファイルを参照してしまう。

---

#### IF-05: `.github/workflows/requirements.txt` の削除

**変更内容:** 空ファイル `.github/workflows/requirements.txt` を削除する。

**削除対象ファイル:** `.github/workflows/requirements.txt`（内容: 空）

**理由:** ルートの `requirements.txt`（`playwright==1.60.0`）が正典。CI ワークフロー 4 本はすでにルートを参照しており、空の重複ファイルは混乱のもとになる。

---

#### IF-06: `package.json`

**変更内容:** `name` フィールドを `"app"` から `"quicklog-solo"` に変更する。

```json
// 変更前
{
  "name": "app",
  ...
}

// 変更後
{
  "name": "quicklog-solo",
  ...
}
```

**理由:** `"app"` は汎用的すぎるため、`npm info` や依存関係グラフで正しく識別されない。バンプ不要（`package.json` はバージョンバンプの検証対象外フィールド変更）。

---

#### RD-03: `docs/README_DEV.md`

**変更内容:** §10 の「実行コマンド」コードブロックと「pre-commit フック」箇条書きを参照リンクに置換する。「テスト環境の仮想化」セクション（mermaid 図と詳細説明）は保持する。

````markdown
<!-- 変更前（§10 末尾付近） -->

### 実行コマンド

```bash
# 全テストの実行
npm test

# リンターの実行
npx eslint .
npx stylelint "**/*.css"
```
````

### pre-commit フック

コミット時に以下のチェックが自動的に実行されます。

1. **check-version:** ...
2. **create-package:** ...
3. **eslint:** ...
4. **stylelint:** ...
5. **jest:** ...

<!-- 変更後 -->

詳細は [テスト計画書 (README_TEST.md)](README_TEST.md) を参照してください。

````

**理由:** テスト実行コマンドと pre-commit フック一覧は `README_TEST.md` のセクション 4 にも記載されており、二重管理状態にある。`README_DEV.md` の記述が更新されず古くなるリスクを避けるため、参照リンクに一本化する。

---

#### MS-04: `AGENTS.md`

**変更内容:** セクション 3.2「言語統制」の「強制チェック」の行の後に除外範囲の注記を追記する。

```markdown
<!-- 変更前（3.2 末尾） -->
**強制チェック:** `submit` 前に `scripts/language_check.py` を実行し、日本語が含まれていることを確認せよ。

<!-- 変更後 -->
**強制チェック:** `submit` 前に `scripts/language_check.py` を実行し、日本語が含まれていることを確認せよ。

**除外範囲（英語で構わない）:** コード内コメント（JS / Python / YAML / Shell）、CI/CD ワークフローファイル内のコメント、および `scripts/` 配下のスクリプト内コメント。
````

**理由:** コードコメントについての方針が未定義だったため、エージェントが混乱しやすかった。適用除外を明示することで誤解を防ぐ。

---

### Phase 1

#### IF-01: `eslint.config.js` + `shared/js/utils.js`, `schema.js`, `i18n.js`

**変更内容（eslint.config.js）:** 以下の 3 エントリを `ignores` から削除する。

```javascript
// 削除するエントリ
'shared/js/utils.js',
'shared/js/schema.js',
'shared/js/i18n.js',
```

**解除順序と修正方針:**

1. **`shared/js/utils.js`** — 副作用のない純粋関数群。`no-unused-vars` エラーが発生する場合は未使用変数を削除または `_` プレフィックスを付与。`prettier/prettier` エラーは `npm run format` 対象に追加して自動修正。
2. **`shared/js/schema.js`** — 定数定義のみ。同上の方針で対応。
3. **`shared/js/i18n.js`** — i18n ロジック。同上の方針で対応。

**`package.json` の `format` スクリプト更新（必要な場合）:**

```json
// 変更前
"format": "prettier --write shared/css/variables.css shared/js/utils/storage.js eslint.config.js"

// 変更後（解除した各ファイルを追加）
"format": "prettier --write shared/css/variables.css shared/js/utils/storage.js eslint.config.js shared/js/utils.js shared/js/schema.js shared/js/i18n.js"
```

**バージョンバンプ:** `shared/js/*.js` を変更するため、IF-01a/b/c の完了後に `npm run version:bump`（パッチ）を実行する。

---

#### AM-02: `eslint.config.js`

**変更内容:** `ignores` 配列の直前にコメントブロックを追加する。

```javascript
// 変更後（ignores の前に追加）
// TODO: 以下は段階的に除外解除予定。現在除外している理由:
// - shared/js/db.js, logic.js, session_sync.js 等: ESLint 導入以前から存在する legacy コード。
//   エラー数が多く一括対応が困難なため一時除外中。Phase 1 以降で順次解除予定。
// - projects/app/js/background.js, backup.js: chrome.* API 使用コードで
//   当初エラーが多発したため除外。globals 設定追加後も未解除のまま。
// - projects/studio/, alarm-editor/ 等: サブプロジェクトはメインとは別フェーズで対応予定。
{
    ignores: [
        ...
    ],
},
```

**理由:** `ignores` リストを見ただけでは除外の理由がわからず、将来の開発者（またはエージェント）が意図を誤解するリスクがある。

---

#### RD-04: `.pre-commit-config.yaml`

**変更内容:** `jest` フックの `always_run: true` を `always_run: false` に変更し、`files` フィルタを追加する。

```yaml
# 変更前
- id: jest
  name: jest
  entry: npm test
  language: system
  pass_filenames: false
  always_run: true

# 変更後
- id: jest
  name: jest
  entry: npm test
  language: system
  pass_filenames: false
  always_run: false
  files: \.(js|cjs)$
```

**理由:** ドキュメントや YAML ファイルだけのコミットでも Jest が実行されていたため、コミット時間が不必要に長くなっていた。JS/CJS ファイルが変更されたときのみ実行することで DX を改善する。

---

#### OD-04: `.github/workflows/release_web_deploy.yml`

**変更内容:** `on.push.paths` から `- 'releases/**'` を削除する。

```yaml
# 変更前
on:
    push:
        branches:
            - main
        paths:
            - 'projects/**'
            - 'shared/**'
            - 'scripts/**'
            - 'tests/**'
            - 'releases/**' # ← 削除
            - 'package.json'
            - 'package-lock.json'
            - 'vercel.json'
            - '.github/workflows/release_web_deploy.yml'

# 変更後（'releases/**' 行が存在しない）
on:
    push:
        branches:
            - main
        paths:
            - 'projects/**'
            - 'shared/**'
            - 'scripts/**'
            - 'tests/**'
            - 'package.json'
            - 'package-lock.json'
            - 'vercel.json'
            - '.github/workflows/release_web_deploy.yml'
```

**理由:** `releases/` への変更（ZIP の更新）は `create_package.py` が `projects/` や `shared/` の変更に連動して自動生成するものであり、`releases/` 単体の push でデプロイが再実行されるのは不要かつコスト無駄になる。

---

## データモデル

本 spec の変更はデータモデルを導入しない。変更対象はすべてテキストファイル（スクリプト・設定・ドキュメント）の内容修正である。

---

## エラー処理

| 状況                                                     | 対処方針                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ESLint 解除後に `no-unused-vars` が多数発生する場合      | 変数を削除するか `_` プレフィックスを付与。動作に影響する変数は削除せず `_` を付与する |
| ESLint 解除後に `prettier/prettier` エラーが発生する場合 | `format` スクリプトの対象に追加して自動修正                                            |
| ESLint 解除後に上記以外のエラーが発生する場合            | 個別に対応。動作変更を最小限にとどめる                                                 |
| バージョンバンプ後に CI が失敗する場合                   | `npm run version:bump` を再実行してバージョン整合性を確認                              |

---

## テスト戦略

本 spec の変更は設定ファイル・ドキュメント・スクリプトのテキスト修正が中心であり、固有のビジネスロジックを含まない。そのため、プロパティベーステスト（PBT）は適用しない。

**なぜ PBT を適用しないか:**

- 変更内容がテキスト置換・削除・設定値変更であり、「任意の入力に対して普遍的な性質が成り立つ」というPBTの前提が成り立たない
- 各変更は 1–2 個の具体的な期待値で検証可能（例: ファイルが存在しない、特定文字列が含まれない）

**検証アプローチ:**

| タスク | 検証方法                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------- |
| IF-02  | `check_root_files.py` を実行し終了コード 0 を確認                                                       |
| IF-03  | `background.js` を目視確認。冒頭 3 行が削除され import 文から始まることを確認                           |
| IF-04  | `README_TEST.md` の該当セルが `i18n.test.js` であることを確認                                           |
| IF-05  | `.github/workflows/requirements.txt` が存在しないことを確認                                             |
| IF-06  | `package.json` の `name` が `quicklog-solo` であることを確認                                            |
| RD-03  | `README_DEV.md` §10 に `npm test` コードブロックが存在しないことを確認                                  |
| MS-04  | `AGENTS.md` 3.2 に除外範囲の注記が存在することを確認                                                    |
| IF-01  | `npm run lint` がエラーなしで完了することを確認                                                         |
| AM-02  | `eslint.config.js` の `ignores` 直前にコメントブロックが存在することを確認                              |
| RD-04  | `.pre-commit-config.yaml` の `jest` フックに `always_run: false` と `files:` が設定されていることを確認 |
| OD-04  | `release_web_deploy.yml` の `on.push.paths` に `releases/**` が含まれないことを確認                     |
