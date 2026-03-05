[![CI](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/ci.yml/badge.svg)](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/ci.yml) [![Deploy to Vercel](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/deploy.yml/badge.svg)](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/deploy.yml) ![Version](https://img.shields.io/badge/version-0.7.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange) ![Privacy](https://img.shields.io/badge/Privacy-Local%20Only-brightgreen)

# QuickLog-Solo

「1秒で記録、1秒で集計、1秒で安心」をコンセプトにした、ミニマリスト向け・サイドパネル型作業メモツールです。
「作業の記録」という、本来の業務ではないけれど避けては通れないタスクを、極限まで楽に、そして少しだけ楽しくすることを目指しています。
設計思想や行動指針については [AGENTS.md](AGENTS.md) を参照してください。

## 特徴
- **ブラウザ・サイドバー常駐:** Chrome, Edge, Firefoxのサイドバー（サイドパネル）に寄り添い、作業の傍らでいつでも記録が可能です。
- **「前の作業を止める」手間を排除:** 新しいタスクを開始すると、直前のタスクは自動的に終了処理されます。「止める」という余計な操作を忘れさせてくれる、徹底した効率化（Zero Friction）を実現。
- **完全ローカル動作 & プライバシー:** データはすべてブラウザ内の IndexedDB に保存されます。外部サーバーへの送信やトラッキングは一切ありません。
- **クリーンな環境:** DLLのインストールやレジストリの変更は行いません。アンインストールすれば跡形もなく消える、PC環境を汚さない安心設計です。
- **癒やしの背景アニメーション:** 集中を妨げない20種類以上のドットアニメーションが、殺伐としがちな業務記録に温かみを与え、愛着の持てる道具へと変えてくれます。
- **一瞬で集計・出力:** 日報形式（Markdown, HTML Table等）のコピーや、カテゴリを横断した「タグ集計」により、自分の働きを一瞬で振り返ることができます。
- **メンテナンスフリー:** 40日を過ぎた古いデータは自動的にクリーンアップ。導入したら、あとは使うだけです。

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
- **バックアップ:** ブラウザのサイトデータ消去などでデータが消える可能性があるため、重要なデータは定期的にCSVエクスポートを行うことを推奨します。

## プライバシーとセキュリティ
- **Local Only:** 本アプリは、外部への通信を一切行いません。
- **No Tracking:** アクセス解析や広告、トラッキングコードは一切含まれていません。
- **透明性:** 外部フレームワークに依存しない Vanilla JS で構築されており、コードの透明性が保たれています。また、開発者ツール（F12）から IndexedDB の中身を直接確認することが可能です。

## 免責事項 (Disclaimer)
本ソフトウェアは、個人によって開発されたオープンソース・プロジェクトです。
利用に際して生じたいかなる損害についても、開発者は一切の責任を負いません。
MIT ライセンスの規定に基づき、「現状のまま」提供されるものとします。

This software is a personal open-source project.
The developer shall not be liable for any damages arising from the use of this software.
It is provided "AS IS" without warranty of any kind, as per the MIT License.

## カスタマイズ
- **テーマ:** ライトモード / ダークモードの切り替えが可能です。
- **アクセントカラー:** 設定パネルからお好みの色（ブルー、グリーン、オレンジ等）を選択できます。
- **フォント切り替え:** 視認性の高い複数のフォントから、好みに合わせて表示を切り替えられます。

## 開発者向け情報
開発環境の構築、ディレクトリ構成、テスト方法などの技術的な詳細は [docs/README_DEV.md](docs/README_DEV.md) を参照してください。
