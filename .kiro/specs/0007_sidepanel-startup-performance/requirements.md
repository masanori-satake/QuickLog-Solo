# Requirements Document

## Introduction

サイドパネル起動時の体感速度を改善するための最適化。app.html のローカル CSS 読み込みを非同期化し、app.js の DOM 操作を DocumentFragment によるバッチ処理に変更する。機能性を一切損なわず、パフォーマンスのみを向上させる。

## Glossary

- **App**: QuickLog-Solo のメインサイドパネルアプリケーション（`projects/app/`）
- **CSS_Loader**: app.html 内のローカル CSS ファイル読み込み機構
- **Render_Engine**: app.js 内のカテゴリ・ログ・ページネーションの DOM レンダリング処理
- **DocumentFragment**: DOM API が提供する軽量なドキュメントフラグメント。複数の DOM ノードをまとめて一括挿入するためのコンテナ
- **FOUC**: Flash of Unstyled Content。スタイルシート適用前にスタイルなしのコンテンツが一瞬表示される現象
- **Preload_Pattern**: `rel="preload"` と `onload` イベントを組み合わせた CSS 非同期読み込みパターン

## Requirements

### Requirement 1: ローカル CSS の非同期読み込み

**User Story:** As a ユーザー, I want サイドパネルの起動時にローカル CSS が非同期で読み込まれること, so that 体感的な表示開始が速くなる

#### Acceptance Criteria

1. WHEN app.html が読み込まれる, THE CSS_Loader SHALL `shared/css/m3-theme.css` を `rel="preload"` と `onload` イベントの組み合わせで非同期に読み込む
2. WHEN app.html が読み込まれる, THE CSS_Loader SHALL `css/style.css` を `rel="preload"` と `onload` イベントの組み合わせで非同期に読み込む
3. WHEN JavaScript が無効化されている, THE CSS_Loader SHALL `<noscript>` 要素内の通常の `<link rel="stylesheet">` によるフォールバックを提供する
4. THE CSS_Loader SHALL Material Symbols Outlined フォントの読み込みを同期的な `<link rel="stylesheet">` のまま維持する

### Requirement 2: FOUC 防止

**User Story:** As a ユーザー, I want CSS 読み込み完了前にスタイルなしのコンテンツが表示されないこと, so that 起動時に画面がちらつかない

#### Acceptance Criteria

1. WHILE ローカル CSS の読み込みが完了していない状態, THE App SHALL body 要素に `opacity: 0` を適用してコンテンツを非表示にする
2. WHEN すべてのローカル CSS の読み込みが完了した, THE App SHALL body 要素の opacity を 1 に変更してコンテンツをフェードイン表示する
3. THE App SHALL FOUC 防止用のスタイルをインライン `<style>` 要素で定義する
4. WHEN JavaScript が無効化されている, THE App SHALL `<noscript>` 内のインラインスタイルにより body 要素の opacity を 1 に設定してコンテンツを表示する

### Requirement 3: DocumentFragment によるカテゴリレンダリングの最適化

**User Story:** As a ユーザー, I want カテゴリボタンの描画が高速であること, so that サイドパネル起動直後のカテゴリ表示が速い

#### Acceptance Criteria

1. WHEN renderCategories 関数がカテゴリボタンを生成する, THE Render_Engine SHALL 各ボタン要素を DocumentFragment に追加する
2. WHEN すべてのカテゴリボタンの生成が完了した, THE Render_Engine SHALL `list.replaceChildren(fragment)` による一括挿入で DOM を更新する
3. THE Render_Engine SHALL 既存の変更検出ロジック（JSON.stringify による比較）を維持する

### Requirement 4: DocumentFragment によるログレンダリングの最適化

**User Story:** As a ユーザー, I want 作業履歴の描画が高速であること, so that ログ一覧の表示が速い

#### Acceptance Criteria

1. WHEN renderLogs 関数がログ要素を生成する, THE Render_Engine SHALL 各ログ要素（日付ヘッダーおよびログアイテム）を DocumentFragment に追加する
2. WHEN すべてのログ要素の生成が完了した, THE Render_Engine SHALL `logList.replaceChildren(fragment)` による一括挿入で DOM を更新する
3. THE Render_Engine SHALL 既存の変更検出ロジック（JSON.stringify による比較）を維持する

### Requirement 5: DocumentFragment によるページネーションドットレンダリングの最適化

**User Story:** As a ユーザー, I want ページネーションドットの描画が高速であること, so that カテゴリページ切り替えのレスポンスが良い

#### Acceptance Criteria

1. WHEN renderPaginationDots 関数がドット要素を生成する, THE Render_Engine SHALL 各ドット要素を DocumentFragment に追加する
2. WHEN すべてのドット要素の生成が完了した, THE Render_Engine SHALL `container.replaceChildren(fragment)` による一括挿入で DOM を更新する

### Requirement 6: バージョンバンプ

**User Story:** As a 開発者, I want 変更に伴うパッチバージョンバンプが行われること, so that CI のバージョン検証が通過する

#### Acceptance Criteria

1. WHEN 本機能の実装が完了した, THE App SHALL パッチバージョンがインクリメントされた状態である

### Requirement 7: 既存機能の非退行

**User Story:** As a ユーザー, I want パフォーマンス最適化後もすべての既存機能が正常に動作すること, so that 安心してアップデートできる

#### Acceptance Criteria

1. THE App SHALL 既存の Jest ユニットテストをすべてパスする
2. THE App SHALL 既存の Playwright E2E テストをすべてパスする
3. THE Render_Engine SHALL カテゴリボタンのクリックイベント、アクティブ状態表示、disabled 属性の付与を従来通り動作させる
4. THE Render_Engine SHALL ログアイテムのクリックイベント（履歴操作モーダル表示）を従来通り動作させる
5. THE Render_Engine SHALL ページネーションドットのクリックイベント（ページ切り替え）を従来通り動作させる
