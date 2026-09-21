![Version](https://img.shields.io/badge/version-1.30.11-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-brightgreen) ![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange) [![Chrome Web Store](https://img.shields.io/chrome-web-store/v/kllhfalcincleolgoepnailfjendigdh?logo=google-chrome&logoColor=white&label=Chrome%20Web%20Store)](https://chrome.google.com/webstore/detail/kllhfalcincleolgoepnailfjendigdh) [![Crowdin](https://badges.crowdin.net/quicklog-solo/localized.svg)](https://crowdin.com/project/quicklog-solo) [![Tests & Lint](https://img.shields.io/github/actions/workflow/status/masanori-satake/QuickLog-Solo/tests-and-lint.yml?branch=main&label=Tests%20%26%20Lint)](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/tests-and-lint.yml) [![pre-commit.ci status](https://results.pre-commit.ci/badge/github/masanori-satake/QuickLog-Solo/main.svg)](https://results.pre-commit.ci/latest/github/masanori-satake/QuickLog-Solo/main) [![Web Deploy](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/release_web_deploy.yml/badge.svg)](https://github.com/masanori-satake/QuickLog-Solo/actions/workflows/release_web_deploy.yml)
![Chromebook / ChromeOS Optimized](https://img.shields.io/badge/Chromebook%20%2F%20ChromeOS-Optimized-blue?logo=googlechrome&logoColor=white) ![100% Offline / Local-Only](https://img.shields.io/badge/100%25%20Offline-Local--Only-brightgreen) ![Responsive & Multi-Layout Ready](https://img.shields.io/badge/Responsive-Multi--Layout%20Ready-orange) ![Pure Vanilla JS (Zero Dependencies)](https://img.shields.io/badge/Pure%20Vanilla%20JS-Zero%20Dependencies-yellow?logo=javascript&logoColor=white)

# <img src="shared/assets/icon.svg" width="32" style="vertical-align: middle; margin-right: 8px;"> QuickLog-Solo - 1-Sec Local Task Logger & Time Tracker

> **Log in 1 second, summarize in 1 second.** A minimalist, privacy-first side-panel task logger and time tracker designed for maximum productivity without compromising data security.

## Overview
Context switching and complex time-tracking tools disrupt daily focus and introduce unnecessary friction. **QuickLog-Solo** solves this by delivering an ultra-fast, lightweight Chrome extension that stays right in your browser side panel. Track tasks in a single click, boost your daily productivity, and keep your activity records 100% private with local-first storage.

## Key Features
- **⚡ 1-Sec Task Logger & Time Tracker (`time-tracker`, `task-logger`):** Click any category to start logging instantly. Previous tasks are automatically closed and transitioned seamlessly so you can focus on work.
- **🔌 Chrome Extension Side Panel (`chrome-extension`):** Runs directly in the Chrome / Edge side panel, keeping your task logger accessible without cluttering your tabs or desktop.
- **🔒 100% Privacy-First & Local-First (`privacy-first`, `local-first`):** All records stay strictly on your device inside browser IndexedDB. Zero external servers, zero telemetry, and zero tracking.
- **🚀 Maximize Productivity & Daily Summary (`productivity`):** One-click daily report copy and tag-based aggregation across projects to streamline daily standups and work log submissions.
- **🎨 Visual Healing Animations:** Over 20 retro LCD dot-matrix canvas animations that visually represent passing time and reduce daily stress.
- **⏰ Smart Alarms & Auto-Pause:** Set scheduled alarms with custom actions (start, pause, complete) to prevent unrecorded overtime.
- **📁 Local File Backup & Device Sync (Beta):** Securely export backups to a designated local folder via File System Access API or sync settings via `chrome.storage.sync`.

## 🔒 Privacy & Security
Data security and user privacy are foundational principles of QuickLog-Solo:

- **100% Local Execution:** All data is processed and stored locally in your browser's IndexedDB.
- **Zero External Server Communication:** Strict Content Security Policy (CSP) blocks all external API calls and outgoing network requests.
- **Pure Vanilla JS (Zero Dependencies):** Built without external runtime frameworks or third-party packages, eliminating supply chain vulnerabilities.
- **Zero Data Collection:** No user telemetry, analytics, cookies, or tracking scripts are included or used.
- **Continuous Security Auditing:** Automatically scanned and verified using Google OSV-Scanner and strict dependency policies.

## Chromebook & Offline Environment Friendly
QuickLog-Solo is optimized for seamless performance across Windows, macOS, ChromeOS / Chromebooks, and air-gapped network environments.

- **100% Offline Capability:** Works completely without an internet connection (no external font or script dependencies).
- **Responsive Layout Options:** Adjust display height (Normal, Compact, Mini) and category grid rows (2x8, 2x4) to fit compact Chromebook screens or large desktop displays.
- **Minimal Resource Footprint:** Lightweight Vanilla JS engine ensures smooth execution even on entry-level devices.

## Installation

### 🚀 Stable Release (Chrome Web Store) - Recommended
For automatic updates and easy installation, get QuickLog-Solo directly from the Chrome Web Store:

[![Available in the Chrome Web Store](shared/assets/badges/chrome-web-store-badge-en.png)](https://chrome.google.com/webstore/detail/kllhfalcincleolgoepnailfjendigdh)

### 🛠️ Developer Release (Zip)
To try the latest unreleased features:

1. Download and extract `releases/QuickLog-Solo-v1.30.11.zip`.
2. Open your browser's extensions page (`chrome://extensions` or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extracted directory.

## Usage Guide
- **Start Task:** Click a category button to begin tracking immediately.
- **Pause / Resume:** Click **Pause** during interruptions and click again to resume the previous task.
- **Complete Task:** Click **Finish** to conclude the active log.
- **Reports & Summaries:** Copy daily reports or tag-based summaries to your clipboard via the header icons (📋, 📊).
- **CSV Import / Export:** Export or restore full log history under Settings (⚙️) > **General**.

## Related Projects
- **[Category Editor](https://quick-log-solo.vercel.app/category-editor):** Web-based manager to edit and organize category items.
- **[Alarm Editor](https://quick-log-solo.vercel.app/alarm-editor):** Visual editor for advanced alarms and business day schedules.
- **[Animation Maker](https://quick-log-solo.vercel.app/animation-maker):** No-code editor to upload custom GIFs and generate dot-matrix canvas animations.
- **[QL-Animation Studio (Beta)](https://quick-log-solo.vercel.app/studio):** Interactive environment to create and test custom background animations.

---

## 🇯🇵 日本語

### QuickLog-Solo - 1秒で作業記録できるローカル完結型タイムトラッカー

「1秒で記録、1秒で集計」をコンセプトにした、ミニマリスト向け・サイドパネル型作業メモツールです。

#### 概要
ブラウザを開いたまま1秒でタスクやアイデアをメモ・記録。外部通信ゼロ・完全ローカル保存で、社内業務や機密性の高い作業でも安心して使える軽量タイムトラッカーです。

#### 主な機能
- **1秒で記録、1秒で集計:** カテゴリを選ぶだけで即座に計測開始。前後のタスクは自動的に連結・終了処理され、日報や集計データもワンクリックで作成できます。
- **ブラウザ・サイドバー常駐:** Chrome, Edge のサイドパネルに対応。作業を妨げず、いつでもブラウザの傍らでクイックに記録可能です。
- **Visual Healing（視覚的癒やし）:** 20種類以上のLCDドットマトリクス風アニメーションを搭載。「1秒の重み」を緩やかな変化で表現し、作業中のストレスを軽減します。
- **タグ別集計:** カテゴリにタグを紐付けることで、複数プロジェクト横断の工数集計を一瞬で行えます。
- **アラーム・自動停止機能:** 指定時刻に通知メッセージを表示し、作業を自動終了・一時停止・開始します。
- **完全ローカル & 徹底したプライバシー:** データはすべてブラウザ内の IndexedDB に保存され、CSP により技術的に外部通信を遮断しています。

---

## 免責事項 (Disclaimer)
本ソフトウェアは、個人によって開発されたオープンソース・プロジェクトであり、**無保証 (AS IS)** です。
利用に際して生じたいかなる損害（データの消失、業務の中断、PCの不具合など、本ツールやドキュメントを利用したことによるすべての損害）について、開発者は一切の責任を負いません。
MIT ライセンスの規定に基づき、「現状のまま」提供されるものとします。自己責任でご利用ください。

This software is an open-source project provided **"AS IS"** without warranty of any kind.
The developer shall not be liable for any damages (including data loss, work interruption, etc.) arising from the use of this software.
Use at your own risk, as per the MIT License.
