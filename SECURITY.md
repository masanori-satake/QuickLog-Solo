# Security Policy / セキュリティポリシー

## Supported Versions / サポート対象バージョン

We currently support the following versions for security updates.
現在、以下のバージョンについてセキュリティアップデートをサポートしています。

| Version | Supported |
| ------- | --------- |
| Latest  | :white_check_mark: |
| < 0.9.x | :x: |

---

## Reporting a Vulnerability / 脆弱性の報告方法

If you discover a potential security vulnerability, please use the **GitHub Private Vulnerability Reporting** feature.
セキュリティ上の脆弱性を発見された場合は、**GitHubのプライベート報告機能（Private Vulnerability Reporting）**を使用して報告してください。

### How to report / 報告手順:
1. On GitHub.com, navigate to the main page of the repository.
2. Under the repository name, click **Security**.
3. In the left sidebar, click **Vulnerability reporting**.
4. Click **Report a vulnerability**.
5. Fill in the details and click **Submit report**.

---

## Our Security Philosophy / セキュリティに関する設計指針

This project prioritizes user privacy and security through the following architectural choices:
本プロジェクトでは、ユーザーのプライバシーとセキュリティを最優先し、以下の設計指針を採用しています。

### 1. Local-Only Architecture / 完全ローカル動作
QuickLog-Solo operates entirely within your browser. All data is stored in **IndexedDB** on your device. No data is sent to external servers, ensuring your logs remain private.
本アプリはブラウザ内で完結して動作します。すべてのデータはデバイス上の **IndexedDB** に保存され、外部サーバーへの通信は一切行われません。

### 2. Animation Sandboxing / アニメーションのサンドボックス化
Animation modules are executed within **Web Workers**. We use a strict **Content Security Policy (CSP)** to block any network access or DOM manipulation from within the worker environment, mitigating risks from third-party animation code.
背景アニメーションのロジックは **Web Worker** 上で実行されます。強力な **コンテンツセキュリティポリシー (CSP)** を適用し、外部通信やメインスレッドのDOM操作を遮断することで、アニメーションコードによるリスクを最小化しています。

### 3. Vanilla JS (Zero Dependencies) / Vanilla JS の採用
By avoiding external frameworks and libraries, we eliminate the risk of "Dependency Hell" and supply chain attacks. The codebase is transparent and easy to audit for any security professional.
外部のフレームワークやライブラリに依存しないことで、依存関係の脆弱性やサプライチェーン攻撃のリスクを排除しています。コードの透明性が高く、セキュリティ監査も容易です。

---

## Disclaimer / 免責事項
Please refer to the [README.md](README.md) and [LICENSE](LICENSE) for our full disclaimer.
詳細な免責事項については、[README.md](README.md) および [LICENSE](LICENSE) を参照してください。
