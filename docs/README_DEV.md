# QuickLog-Solo: 開発者ガイド

本リポジトリの開発環境、ディレクトリ構成、および開発プロセスについて説明します。

## 1. 開発環境のセットアップ

### 前提条件
- Node.js (v18以上推奨)
- Python 3

### 手順
1. リポジトリをクローンします。
2. 依存関係をインストールします。
   ```bash
   npm install
   ```
3. Playwright のブラウザをインストールします（E2Eテスト用）。
   ```bash
   npx playwright install chromium --with-deps
   ```

## 2. ディレクトリ構成

- `src/`: ソースコード
  - `js/`: JavaScript ロジック
  - `css/`: スタイルシート
  - `assets/`: 画像、アイコン等のアセット
- `tests/`: テストコード (Jest, Playwright)
- `scripts/`: 開発・ビルド用ユーティリティスクリプト
- `docs/`: ドキュメント

## 3. 主要な開発コマンド

- `npm run dev`: 開発サーバーの起動 (Vite)
- `npm test`: ユニットテストの実行 (Jest)
- `npm run test:e2e`: E2Eテストの実行 (Playwright)
- `npm run build`: リリースパッケージの作成
- `npm run update-guide-images`: クイックスタートガイド用画像の更新

## 4. コーディング規約

- **Vanilla JS:** 実行時の外部ライブラリ依存は禁止です。
- **ESLint:** 静的解析による品質管理を行っています。`eslint.config.js` を参照。
- **i18n:** 全ての表示文字列は `src/js/messages.js` を通してローカライズしてください。
- **アクセシビリティ:** Material 3 のデザインガイドラインに従い、適切なコントラストとタッチターゲットを確保してください。

## 5. リリースプロセス

1. `npm run version:bump` を実行してバージョンを更新します。
2. 変更をコミットし、`v*.*.*` タグをプッシュします。
3. GitHub Actions により自動的に GitHub Release が作成されます。

---

## 6. 免責事項 (Disclaimer)
本ソフトウェアは個人開発によるオープンソースプロジェクトであり、無保証です。開発に際して生じたいかなる損害についても、開発者は責任を負いません。自己責任で開発・利用を行ってください。

This software is a personal open-source project and is provided "AS IS" without warranty of any kind. Use at your own risk.
