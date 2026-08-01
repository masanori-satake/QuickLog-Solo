# QuickLog-Solo: プロジェクト構成

## ディレクトリ構造

```
QuickLog-Solo/
├── projects/                  # サブプロジェクト群
│   ├── app/                   # メインアプリ（Chrome拡張機能本体）★主要
│   │   ├── app.html
│   │   ├── css/style.css
│   │   ├── js/
│   │   │   ├── app.js         # UI層オーケストレーター（DOM操作・イベント）
│   │   │   ├── background.js  # Service Worker（アラーム・通知）
│   │   │   └── backup.js      # ローカルファイルバックアップ
│   │   ├── manifest.chrome.json
│   │   ├── version.json
│   │   ├── samples/           # サンプルアニメーションファイル (.qlanim)
│   │   └── _locales/          # 拡張機能向け i18n (en/ja/de/es/fr/pt/ko/zh)
│   ├── studio/                # QL-Animation Studio（アニメーション開発ツール）
│   ├── category-editor/       # QL-Category Editor（カテゴリ一括管理）
│   ├── alarm-editor/          # Alarm Editor（アラーム設定ツール）
│   ├── animation-maker/       # Animation Maker（アニメーション作成支援）
│   └── web/                   # ランディングページ・ガイド（Vercel デプロイ）
│
├── shared/                    # 全サブプロジェクト共通モジュール ★重要
│   ├── js/
│   │   ├── logic.js           # ビジネスロジック層（DOM非依存・純粋関数）
│   │   ├── db.js              # データアクセス層（IndexedDB カプセル化）
│   │   ├── utils.js           # 共通ユーティリティ・バリデーション・エスケープ
│   │   ├── i18n.js            # 多言語対応ロジック
│   │   ├── messages.js        # 翻訳リソース集約
│   │   ├── animations.js      # Animation Engine（Canvas描画統括）
│   │   ├── animation_worker.js # Web Worker（アニメーション隔離実行）
│   │   ├── animation_registry.js # アニメーションモジュール登録（自動生成）
│   │   ├── animation_base.js  # アニメーション基底クラス
│   │   ├── schema.js          # データスキーマ定義
│   │   ├── session_sync.js    # BroadcastChannel によるタブ間同期
│   │   ├── idb_storage.js     # IndexedDB ストレージユーティリティ
│   │   ├── animation/         # 各アニメーションモジュール (.js)
│   │   ├── locales/           # 言語別翻訳ファイル (en.js / ja.js / ...)
│   │   └── utils/             # ユーティリティサブモジュール
│   ├── css/                   # 共通 CSS（variables.css 等）
│   └── assets/                # 共通アセット
│
├── tests/                     # E2E テスト（Playwright）
│   └── *.spec.js
│
├── scripts/                   # ビルド・検証 Python/Node スクリプト
│   ├── bump_version.py
│   ├── generate_animation_registry.py
│   ├── verify_project_policies.py
│   └── ...
│
├── docs/                      # ドキュメント
│   ├── spec.md                # ★製品仕様書（設計の唯一の正典）
│   ├── README_DEV.md          # 開発者ガイド
│   ├── README_TEST.md         # テスト計画
│   ├── schema/                # JSON スキーマ定義
│   └── images/
│
├── .github/
│   └── workflows/             # GitHub Actions CI/CD
│
├── package.json               # npm スクリプト・devDependencies・Prettier 設定
├── eslint.config.js
├── jest.config.cjs
├── playwright.config.js
├── AGENTS.md                  # AI エージェント・開発者行動指針
└── .pre-commit-config.yaml
```

## アーキテクチャ層

```
UI層          projects/app/js/app.js       DOM操作・イベント・UI同期
  ↓
ロジック層    shared/js/logic.js           純粋なビジネスロジック（DOM非依存）
  ↓
データ層      shared/js/db.js              IndexedDB CRUD・マイグレーション
  ↓
ストレージ    IndexedDB (Local Only)
```

- `app.js` は高レベルの関数呼び出しに徹し（SLAP原則）、ロジックを直接書かない
- `logic.js` は DOM に一切依存しない。テスト容易性のために純粋関数として設計
- `shared/` モジュールはメインアプリ・Studio・Category Editor など複数のサブプロジェクトで共有

## 重要な規約

### 変更時のバージョンバンプ
`projects/app/` または `shared/` を変更した場合、CI 通過のために `npm run version:bump` によるバンプが必須。

### ルートディレクトリのクリーンネス
ルートに一時スクリプト（`reproduce_*.py`, `verify_*.py` 等）を置いてはならない。検証スクリプトは `scripts/` に配置する。

### 仕様書の優先順位
`docs/spec.md` がすべての設計判断の正典（Source of Truth）。実装の根拠が不明な場合は必ず参照する。

### セキュリティ
- `innerHTML` は原則禁止。テキスト出力は `textContent` を使用する
- 例外は QL-Animation Studio の PR ガイド表示（`data-i18n-html` + 信頼済み翻訳文字列のみ）

### CSS 変数の定義場所
テーマ変数は `:root` ではなく `body` に定義する（テーマ切り替え時の確実な伝播のため）。

### i18n
- 日本語（`shared/js/locales/ja.js`）が翻訳の正典（Source of Truth）
- 技術用語・固有名詞（IndexedDB 等）は原文を維持する
- UI 言語の標準順序: English → 日本語 → Deutsch → Español → Français → Português → 한국어 → 简体中文
