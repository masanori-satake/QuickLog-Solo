# QuickLog-Solo: 開発者ガイド

このドキュメントでは、QuickLog-Solo の開発ワークフローおよび実務的な手順について説明します。

設計思想、アーキテクチャ詳細、状態遷移、および内部仕様の正典については、常に [製品仕様書 (spec.md)](spec.md) を参照してください。

## 1. 開発環境のセットアップ

### 依存関係のインストール
```bash
npm ci
pip install playwright
python3 -m playwright install --with-deps chromium
```

### ローカル開発サーバー
```bash
# Vite を使用して開発サーバーを起動
npx vite --port 8080
```

## 2. 開発ワークフロー

### ディレクトリ構成
- `projects/app/`: メインプロジェクト（拡張機能）。
- `projects/alarm-editor/`: アラームエディタ。
- `projects/category-editor/`: カテゴリエディタ。
- `projects/studio/`: アニメーションスタジオ。
- `shared/`: プロジェクト間共有資産（JS, CSS, Assets）。
- `scripts/`: 各種自動化スクリプト。
- `tests/`: 単体テスト。

### ビルドとパッケージング
`npm run build` を実行すると、以下の処理が自動で行われます：
1. **PNGアイコン生成**: SVG から拡張機能用アイコンを生成。
2. **レジストリ生成**: アニメーションモジュールの自動登録。
3. **バージョン整合性チェック**: 関連ファイルのバージョン同期。
4. **パッケージ作成**: `releases/` ディレクトリへの ZIP 出力。

### バージョン管理
`npm run version:bump` コマンドを使用して、各ファイルのバージョンを一括更新します。

## 3. 品質管理
- **コード規約**: ESLint および Stylelint を遵守してください。
- **テスト**: 変更後は必ず `npm test` を実行してください。詳細は [README_TEST.md](README_TEST.md) を参照。

---

## 免責事項 (Disclaimer)
本ソフトウェアは、個人によって開発されたオープンソース・プロジェクトであり、**無保証 (AS IS)** です。
利用に際して生じたいかなる損害（データの消失、業務の中断、PCの不具合など、本ツールやドキュメントを利用したことによるすべての損害）について、開発者は一切の責任を負いません。
MIT ライセンスの規定に基づき、「現状のまま」提供されるものとします。自己責任でご利用ください。

This software is a personal open-source project and is provided **"AS IS"** without warranty of any kind.
The developer shall not be liable for any damages (including data loss, work interruption, etc.) arising from the use of this software.
Use at your own risk, as per the MIT License.
