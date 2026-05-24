# QuickLog-Solo: テスト計画・ケース定義書

本プロジェクトでは、コアロジックおよびデータアクセス層の品質を担保するため、自動テストを実施しています。

詳細なテストケース（ユニットテスト/E2E）およびテスト環境の仮想化戦略については、[製品仕様書 (spec.md) の付録](spec.md#付録-テストと品質管理詳細-testing--quality)を参照してください。

## 1. テストの実行方法

### ユニットテスト (Jest)
Node.js 環境で実行します。
```bash
npm test
```

### E2Eテスト (Playwright)
事前にローカルサーバーを起動しておく必要があります。
```bash
npm run test:e2e
```

### アニメーション評価テスト
描画密度や変化率が基準を満たしているかを検証します。
```bash
npm run test:animation-eval
```

## 2. 特殊な検証用パラメータ
URLパラメータを使用することで、特定の状態（長時間計測など）を即座に再現可能です。

- **タスク強制開始**: `?test_cat=[カテゴリ名]&test_elapsed=[経過ms]`
- **一時停止状態**: `?test_cat=__IDLE__&test_resumable=[カテゴリ名]`

---

## 免責事項 (Disclaimer)
本ソフトウェアは、個人によって開発されたオープンソース・プロジェクトであり、**無保証 (AS IS)** です。
利用に際して生じたいかなる損害（データの消失、業務の中断、PCの不具合など、本ツールやドキュメントを利用したことによるすべての損害）について、開発者は一切の責任を負いません。
MIT ライセンスの規定に基づき、「現状のまま」提供されるものとします。自己責任でご利用ください。

This software is a personal open-source project and is provided **"AS IS"** without warranty of any kind.
The developer shall not be liable for any damages (including data loss, work interruption, etc.) arising from the use of this software.
Use at your own risk, as per the MIT License.
