# GitHub Actions ワークフロー構成

本プロジェクトにおける CI/CD および自動化プロセスの運用についてまとめます。

ワークフローの全体設計（プロセス・フロー）については、[製品仕様書 (spec.md)](spec.md#github-actions-ワークフロー設計) を参照してください。

## 1. ワークフロー一覧

| グループ | ワークフロー名 | ファイル | 役割 |
| :--- | :--- | :--- | :--- |
| Audit | 監査 | `audit.yml` | 整合性、バージョン、OSS脆弱性検査 |
| Test | 品質・ユニット | `test_quality.yml` | ESLint, Stylelint, Jest |
| Test | E2E | `test_e2e.yml` | Playwright による End-to-End テスト |
| Test | アニメーション | `test_animation.yml` | モジュールの描画品質評価 |
| Release | Webデプロイ | `release_web_deploy.yml` | Vercelへの自動反映 |
| Release | パッケージ公開 | `release_extension_packages.yml` | GitHub Release への ZIP アップロード |
| Update | スクリーンショット | `update_guide_screenshots.yml` | ガイド用画像の自動更新 |

## 2. トラブルシューティング

### GitHub Security タブに "Action workflow file not found" と表示される場合
以前存在していたワークフローが削除・統合された際、古い登録が残ることがあります。

1. リポジトリの **Security > Code scanning** を開く。
2. **Tool status** ボタンをクリック。
3. 不要になった構成の「...」メニューから **Delete** を選択してください。

---

## 免責事項 (Disclaimer)
本ソフトウェアは、個人によって開発されたオープンソース・プロジェクトであり、**無保証 (AS IS)** です。
利用に際して生じたいかなる損害（データの消失、業務の中断、PCの不具合など、本ツールやドキュメントを利用したことによるすべての損害）について、開発者は一切の責任を負いません。
MIT ライセンスの規定に基づき、「現状のまま」提供されるものとします。自己責任でご利用ください。

This software is a personal open-source project and is provided **"AS IS"** without warranty of any kind.
The developer shall not be liable for any damages (including data loss, work interruption, etc.) arising from the use of this software.
Use at your own risk, as per the MIT License.
