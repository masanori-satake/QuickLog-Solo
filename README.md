[![CI](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/ci.yml/badge.svg)](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/ci.yml) [![Deploy to Vercel](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/deploy.yml/badge.svg)](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/deploy.yml) ![Version](https://img.shields.io/badge/version-0.19.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange) ![Privacy](https://img.shields.io/badge/Privacy-Local%20Only-brightgreen)

# QuickLog-Solo

「1秒で記録、1秒で集計」をコンセプトにした、ミニマリスト向け・サイドパネル型作業メモツールです。
業務記録を負担に感じるが、ツールの透明性や安全性に厳しい技術者や、プライバシーを重視するすべての人のために設計されました。

設計思想や行動指針については [AGENTS.md](AGENTS.md) を参照してください。

## 特徴
- **1秒で記録、1秒で集計:** カテゴリを選ぶだけで即座に計測開始。前後のタスクは自動的に連結・終了処理され、日報や集計データもワンクリックで作成できます。
- **ブラウザ・サイドバー常駐:** Chrome, Edge, Firefoxのサイドパネルに対応。作業を妨げず、いつでもブラウザの傍らでクイックに記録可能です。
- **Visual Healing（視覚的癒やし）:** 20種類以上のLCDドットマトリクス風アニメーションを搭載。「1秒の重み」を緩やかな変化で表現し、作業中のストレスを軽減する心地よい体験を提供します。
- **タグ別集計:** カテゴリにタグを紐付けることで、複数のカテゴリにまたがるプロジェクト横断の工数集計を一瞬で行えます。
- **終了忘れ防止（Auto-stop）:** 毎日23:59:59に自動終了し、翌日の記録がクリーンに始められるようガードします。
- **ローカルファイルバックアップ:** 指定したローカルフォルダへの自動同期に対応。ブラウザのキャッシュクリア等による予期せぬデータ消失から記録を守ります（File System Access API を利用）。同期状況はヘッダー右側のインジケーターで一目で確認可能です。
- **徹底したプライバシーと透明性:**
    - **完全ローカル:** 記録されたデータはすべてブラウザ内の IndexedDB にのみ保存されます。
    - **外部通信ゼロ:** CSP（Content Security Policy）により技術的に外部通信を遮断しています。
    - **ピュアで長寿命な設計:** 外部ライブラリを一切使用しない Vanilla JS 構成。OSS のライフサイクルやトレンドに左右されないため、10年後も変わらず使い続けられる長期的安心感を提供します。また、依存関係によるブラックボックスを排除し、技術者が安心して利用・検証できる透明性を確保しています。

## インストール方法（開発者モード）
現在、本拡張機能は各ブラウザのストアには公開されていません。以下の手順でインストールしてください。

### Chrome / Edge の場合
1. `releases/QuickLog-Solo-Chrome.zip` をダウンロードして解凍します。
2. ブラウザで拡張機能管理ページを開きます（Chrome: `chrome://extensions` / Edge: `edge://extensions`）。
3. 「デベロッパー モード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリックし、解凍したフォルダを選択します。
5. ツールバーの拡張機能アイコンをクリックし、QuickLog-Solo をピン留めして使用します。

### Firefox の場合
1. `releases/QuickLog-Solo-Firefox.zip` をダウンロードして解凍します。
2. Firefox で `about:debugging#/runtime/this-firefox` を開きます。
3. 「一時的な拡張機能を読み込む...」をクリックし、解凍したフォルダ内の `manifest.json` を選択します。

## 使用方法
- **タスク開始:** カテゴリボタンをクリックすると、即座に計測が始まります。
- **一時停止/再開:** 「一時停止」ボタンで休憩や割り込みに対応。再度クリックで元のタスクを再開します。
- **タスク終了:** 「終了」ボタンで現在の作業を完了します。
- **データ出力:** 設定（⚙️）から日報形式や集計データをコピーしたり、CSVとしてエクスポートできます。

## データの保存場所
- ブラウザ内ストレージ（IndexedDB）に保存されます。
- **バックアップ:** ブラウザのサイトデータ消去などでデータが消える可能性があるため、設定の「バックアップ」タブからローカルフォルダへの自動同期を有効にすることを推奨します。また、従来通りCSV形式での手動エクスポートも可能です。

## プライバシーとセキュリティ
- **Local Only:** 本アプリは、外部への通信を一切行いません。
- **透明性:** 開発者ツール（F12）から IndexedDB の中身を直接確認することが可能です。

## カスタマイズ
- **テーマ:** ライトモード / ダークモードの切り替えが可能です。
- **アクセントカラー:** カテゴリごとに 14 色のカラーバリエーションから選択できます。
- **フォント切り替え:** 言語ごとに最適化された複数のフォントから選択可能です。
- **背景アニメーション:** 20 種類以上の LCD ドットマトリクス風アニメーションを搭載。

## QL-Animation Studio (β版)
ブラウザ上でオリジナルの背景アニメーションを作成・テストできる [開発環境](https://quicklog-solo.vercel.app/src/studio.html) を公開しています。自分の作品を製品に組み込むことも可能です。

## 開発者向け情報
開発環境の構築、ディレクトリ構成、テスト方法などの技術的な詳細は [docs/README_DEV.md](docs/README_DEV.md) を参照してください。

## 免責事項 (Disclaimer)
本ソフトウェアは、個人によって開発されたオープンソース・プロジェクトです。
利用に際して生じたいかなる損害についても、開発者は一切の責任を負いません。
MIT ライセンスの規定に基づき、「現状のまま」提供されるものとします。

This software is a personal open-source project.
The developer shall not be liable for any damages arising from the use of this software.
It is provided "AS IS" without warranty of any kind, as per the MIT License.
