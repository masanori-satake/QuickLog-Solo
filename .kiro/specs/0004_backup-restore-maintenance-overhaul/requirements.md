# 要件定義書: バックアップ・リストア・メンテナンス機能のオーバーホール

## はじめに

QuickLog-Solo のバックアップ機能を拡張し、リストア（復元）機能を追加するとともに、設定パネルのタブ構成を整理する機能仕様を定義する。具体的には以下の6つの変更を行う。

1. **バックアップ対象の拡張** — アラーム設定とカスタムアニメーション（GIF Blob ＋メタデータ）を追加
2. **リストア機能の追加** — バックアップファイルからの全件上書き復元
3. **設定パネルのタブ統合** — 「バックアップ」タブを廃止し、すべてを「メンテナンス」タブに統合
4. **メンテナンスタブの削除/初期化 UI 改善** — 個別ボタンをチェックボックス＋実行ボタン方式に刷新
5. **chrome.storage.sync へのカスタムアニメーション同期** — Base64 分割同期と進捗表示
6. **バックアップデータ形式の更新** — スキーマ一貫性の確保と v1.14.2 からのマイグレーション保証

現在の v1.14.2（Chrome Web Store 公開版）にはカスタムアニメーション機能は存在しないため、v1.14.2 からのマイグレーション時にカスタムアニメーション関連の後方互換性は考慮不要。

---

## 用語集

- **Backup_Manager**: ローカルファイルバックアップの管理クラス（`projects/app/js/backup.js`）
- **Restore_Manager**: バックアップファイルからの復元を担うロジック（新規追加）
- **Animation_Sync_Manager**: カスタムアニメーションの `chrome.storage.sync` 同期を担うロジック（新規追加）
- **Maintenance_UI**: 設定パネルの「メンテナンス」タブ UI
- **Schema_Validator**: バックアップファイルのスキーマ検証モジュール（`shared/js/schema.js`）
- **QuickLogSoloDB**: 作業履歴・カテゴリ・設定・アラームを格納するメイン IndexedDB
- **QuickLogAnimationDB**: カスタムアニメーション Blob を格納する専用 IndexedDB
- **NDJSON**: Newline Delimited JSON。1 行 1 レコードのテキスト形式
- **Blob_Base64**: GIF などのバイナリ Blob を Base64 文字列に変換したもの
- **Backup_Archive**: バックアップディレクトリに書き出すファイル群の総称
- **Schema_Version**: バックアップファイルのスキーマバージョン識別子
- **Migration**: 旧バージョンのバックアップファイルを新スキーマに変換する処理
- **Overwrite_Restore**: 既存データを全消去してからバックアップデータで再構築する復元方式
- **Sync_Chunk**: `chrome.storage.sync` の 1 キーに格納するデータの分割単位
- **File_System_Access_API**: ブラウザのローカルファイルシステムへのアクセス API

---

## 要件

### 要件 1: バックアップ対象の拡張

**ユーザーストーリー:** ユーザーとして、アラーム設定とカスタムアニメーションを含むすべてのデータをローカルファイルにバックアップしたい。そうすることで、再インストールや別環境への移行時に完全な状態を復元できる。

#### 受け入れ条件

1. WHEN バックアップを実行する, THE Backup_Manager SHALL `ql_alarms.json` ファイルを生成し、`STORE_ALARMS` の全レコードを書き出す
2. WHEN バックアップを実行する, THE Backup_Manager SHALL カスタムアニメーションのメタデータ（名前・ID・登録日時を含む）を `ql_custom_animations.json` として書き出す
3. WHEN バックアップを実行する, THE Backup_Manager SHALL `QuickLogAnimationDB` の各 Blob を `animations/` サブディレクトリ内に個別ファイルとして書き出す（形式: `animations/{id}.gif`）
4. THE Backup_Manager SHALL バックアップ対象として作業履歴 / カテゴリ / 設定 / アラーム / カスタムアニメーションの 5 種類をすべて含める
5. THE Backup_Manager SHALL バックアップ実行時に既存の `ql_alarms.json` および `ql_custom_animations.json` を上書きする
6. IF バックアップ対象のカスタムアニメーションが 0 件である, THEN THE Backup_Manager SHALL `ql_custom_animations.json` を空配列の内容で書き出す
7. IF `STORE_ALARMS` の読み取りに失敗する, THEN THE Backup_Manager SHALL エラーメッセージを表示しバックアップ状態を `FAILED` に更新する
8. IF `QuickLogAnimationDB` の Blob 読み取りに失敗する, THEN THE Backup_Manager SHALL エラーメッセージを表示しバックアップ状態を `FAILED` に更新する

---

### 要件 2: バックアップデータ形式の更新（スキーマ v2.0）

**ユーザーストーリー:** ユーザーとして、一貫したスキーマに基づくバックアップファイルを利用したい。そうすることで、バックアップファイルの内容を安全に検証・マイグレーションできる。

#### 受け入れ条件

1. THE Schema_Validator SHALL スキーマバージョン定数 `SCHEMA_VERSION_2_0 = '2.0'` をエクスポートし、新たに書き出すすべてのバックアップファイル（`ql_alarms.json`、`ql_custom_animations.json`、`ql_settings.json`）の `version` フィールドに `'2.0'` を使用する
2. THE Schema_Validator SHALL `SCHEMA_KIND_ALARM = 'QuickLogSolo/Alarm'` をエクスポートし、アラームスキーマの検証関数（`validateAlarmSchema`）の中で `kind` フィールドの照合に使用する
3. THE Schema_Validator SHALL `SCHEMA_KIND_CUSTOM_ANIMATION = 'QuickLogSolo/CustomAnimation'` をエクスポートし、カスタムアニメーションメタデータスキーマの検証関数（`validateCustomAnimationSchema`）の中で `kind` フィールドの照合に使用する
4. WHEN `version` が `'1.0'` のバックアップファイルを読み込む, THE Schema_Validator SHALL バリデーションエラーを発生させずに既存の `categories.ndjson` / `settings.json` / 日別 NDJSON の各レコードをバリデーション可能にする
5. WHEN v1.14.2 以前のバックアップフォルダを読み込みアラームファイル（`ql_alarms.json`）が存在しない, THE Restore_Manager SHALL アラームの復元対象を空配列として扱い、既存の IndexedDB アラームデータを変更せずに処理を続行する
6. IF バックアップファイルの `version` フィールドが `'1.0'` でも `'2.0'` でもない値（`null`・`undefined`・空文字・その他の文字列を含む）である, THEN THE Schema_Validator SHALL `false` を返してバリデーション失敗として報告する

---

### 要件 3: リストア（復元）機能の追加

**ユーザーストーリー:** ユーザーとして、バックアップファイルが保存されたフォルダを指定して全データを一括復元したい。そうすることで、再インストール後や別端末への移行時に元の状態を素早く再現できる。

#### 受け入れ条件

1. WHEN ユーザーが「復元する」ボタンを押す, THE Maintenance_UI SHALL フォルダ選択ダイアログを表示する
2. WHEN ユーザーがフォルダ選択ダイアログをキャンセルする（フォルダを選択せずに閉じる）, THE Restore_Manager SHALL データを変更せず操作を中断する（エラー表示も行わない）
3. WHEN ユーザーがフォルダを選択する, THE Restore_Manager SHALL 復元内容と既存データが上書き消去される旨の確認ダイアログを表示する
4. WHEN ユーザーが確認ダイアログに同意する, THE Restore_Manager SHALL 対象の IndexedDB ストア（作業履歴 / カテゴリ / 設定 / アラーム）を全消去してから復元データを書き込む
5. WHEN ユーザーが確認ダイアログに同意する, THE Restore_Manager SHALL `QuickLogAnimationDB` の Blob ストアを全消去してからカスタムアニメーション Blob を書き込む
6. WHEN 復元が完了する, THE Restore_Manager SHALL ページをリロードして設定を即時反映する
7. WHEN ユーザーが復元フォルダを選択する, THE Backup_Manager SHALL その選択フォルダを IndexedDB に保存してその後の「バックアップを実行する」の保存先として設定する
8. IF ユーザーが確認ダイアログをキャンセルする, THEN THE Restore_Manager SHALL データを変更せず操作を中断する
9. IF バックアップフォルダに必須ファイル（`ql_categories.ndjson` または `categories.ndjson` と `ql_settings.json` または `settings.json`）のいずれも存在しないか読み取れない, THEN THE Restore_Manager SHALL エラーメッセージを表示して復元を中断する
10. THE Restore_Manager SHALL 復元対象の各ファイルが存在しない場合、そのデータ種別の復元をスキップする（他の種別は正常に復元する）
11. IF 復元処理中に IndexedDB への書き込みが失敗する, THEN THE Restore_Manager SHALL エラーメッセージを表示し復元を中断する（ただし、すでに消去済みのデータのロールバックは保証しない）

---

### 要件 4: 設定パネルのタブ統合

**ユーザーストーリー:** ユーザーとして、バックアップ・リストア・削除・初期化などのデータ管理操作を「メンテナンス」タブ 1 か所で完結させたい。そうすることで、設定パネルをシンプルに保ちつつ必要な操作を素早く見つけられる。

#### 受け入れ条件

1. THE Maintenance_UI SHALL 設定パネルのタブを「一般」「カテゴリ」「アラーム」「メンテナンス」「情報」の 5 タブに変更する（「バックアップ」タブを廃止）
2. THE Maintenance_UI SHALL 「メンテナンス」タブにバックアップ実行・保存先変更・復元の各機能を含める
3. THE Maintenance_UI SHALL 「一般」タブから「履歴 (CSV)」エクスポート/インポートの個別 UI を削除する（同等の一括バックアップ操作はメンテナンスタブで提供する）
4. THE Maintenance_UI SHALL カテゴリ・エディタの個別エクスポート/インポート機能の UI を削除する（同等の一括バックアップ操作はメンテナンスタブで提供する）
5. THE Maintenance_UI SHALL アラーム・エディタの個別エクスポート/インポート機能の UI を削除する（同等の一括バックアップ操作はメンテナンスタブで提供する）
6. IF バックアップ保存先が未設定の状態でメンテナンスタブを表示する, THEN THE Maintenance_UI SHALL 「バックアップを開始する」ボタンと「復元する」ボタンを表示し、「バックアップを実行する」ボタンと「バックアップ先を指定する」ボタンは表示しない
7. IF バックアップ保存先が設定済みの状態でメンテナンスタブを表示する, THEN THE Maintenance_UI SHALL 「バックアップを実行する」「バックアップ先を指定する」「復元する」ボタンと現在の保存先を表示し、「バックアップを開始する」ボタンは表示しない
8. WHEN メンテナンスタブを表示する, THE Maintenance_UI SHALL バックアップ保存先の設定状態を評価してボタン表示を切り替える

---

### 要件 5: メンテナンスタブの削除/初期化 UI 改善

**ユーザーストーリー:** ユーザーとして、削除・初期化したい項目をチェックボックスで選択して一括実行したい。そうすることで、何が削除・初期化されて何が残るかを直感的に理解した上で操作できる。

#### 受け入れ条件

1. THE Maintenance_UI SHALL 削除/初期化の対象を選択する複数チェックボックスを提供する（項目: 作業履歴 / カテゴリ / 設定 / アラーム / カスタムアニメーション）
2. THE Maintenance_UI SHALL チェックボックスが 1 件以上選択された場合に「削除/初期化する」実行ボタンを有効化し、0 件の場合は `disabled` 属性を付与して無効状態を維持する
3. WHEN ユーザーが「削除/初期化する」を押す, THE Maintenance_UI SHALL 選択された項目名と「操作は元に戻せない」旨の警告を含む確認ダイアログを表示する
4. WHEN ユーザーが確認ダイアログに同意する, THE Maintenance_UI SHALL チェックされた項目に対応する `QuickLogSoloDB` の IndexedDB ストアを消去する
5. WHEN ユーザーが確認ダイアログに同意し「カスタムアニメーション」にチェックが入っている, THE Maintenance_UI SHALL `QuickLogAnimationDB` の Blob ストアと `chrome.storage.local` の `custom_animation_metadata_map` を消去する
6. WHEN 削除/初期化が完了する, THE Maintenance_UI SHALL チェックボックスをすべてリセットし、完了を示すトースト通知を 1 件表示する
7. WHILE 削除/初期化の実行中である, THE Maintenance_UI SHALL 実行ボタンを無効化してユーザーの二重実行を防ぐ
8. IF ユーザーが確認ダイアログをキャンセルする, THEN THE Maintenance_UI SHALL データを変更せずチェックボックスの選択状態を維持したまま操作を中断する
9. IF ストアの消去中にエラーが発生する, THEN THE Maintenance_UI SHALL エラーが発生した項目名を含むエラーメッセージを表示し処理を中断する

---

### 要件 6: chrome.storage.sync へのカスタムアニメーション同期

**ユーザーストーリー:** ユーザーとして、カスタムアニメーションを複数端末で共有したい。そうすることで、どの端末でも同じカスタムアニメーションを利用できる。

#### 受け入れ条件

1. WHEN 端末間同期が有効な状態でカスタムアニメーションが追加・変更・削除される, THE Animation_Sync_Manager SHALL 各 GIF Blob を Base64 に変換し 6,000 文字以下のチャンクに分割して、`anim_chunk_{animationId}_{chunkIndex}` の命名規則で `chrome.storage.sync` に書き込む
2. WHILE カスタムアニメーションの同期中である, THE Animation_Sync_Manager SHALL 同期進捗を「完了件数 / 全件数」の形式（例: 「1 / 3」）で UI インジケーターに表示する
3. WHILE カスタムアニメーションの同期中である, THE Animation_Sync_Manager SHALL 作業カテゴリの計時という基本機能を同期完了を待たずに利用可能にする
4. WHEN 同期の途中で API エラーが発生する, THE Animation_Sync_Manager SHALL 最大 3 回のリトライを実施する
5. IF 3 回のリトライ後もエラーが解消しない, THEN THE Animation_Sync_Manager SHALL エラー状態をユーザーに通知し、同期を中断する
6. WHEN リモートから `anim_chunk_` プレフィックスに一致するキーの同期データを受信する, THE Animation_Sync_Manager SHALL 同一 animationId のチャンクをすべて結合して Blob を再構築し、`QuickLogAnimationDB` に保存する
7. IF `chrome.storage.sync` への書き込み時に容量超過エラーが発生する, THEN THE Animation_Sync_Manager SHALL ユーザーに容量超過を通知し、そのアニメーションの書き込みを行わない
8. WHEN 端末間同期が無効にされる, THE Animation_Sync_Manager SHALL `chrome.storage.sync` から `anim_chunk_` プレフィックスに一致するすべてのキーを削除する
9. WHEN リモートのアニメーションがローカルに既に存在する, THE Animation_Sync_Manager SHALL リモートのデータでローカルを上書きする

---

### 要件 7: バックアップデータ整合性の保証

**ユーザーストーリー:** ユーザーとして、バックアップファイルの読み書きが確実に行われることを期待する。そうすることで、データの破損や欠損を防げる。

#### 受け入れ条件

1. WHEN バックアップを実行する, THE Backup_Manager SHALL すべてのファイルの書き込みおよびクローズが完了した後にのみ最終バックアップ時刻を更新する
2. IF バックアップ実行中にファイル書き込みエラーが発生する, THEN THE Backup_Manager SHALL エラーメッセージを表示し、バックアップ状態を `FAILED` に更新する（部分書き込み済みのファイルはそのまま残す）
3. IF 読み込んだバックアップファイルの JSON パースに失敗する, THEN THE Restore_Manager SHALL エラーメッセージを表示して IndexedDB への書き込みを行わず復元を中断する
4. IF 読み込んだバックアップファイルの内容がスキーマバリデーションに失敗するレコードを含む, THEN THE Restore_Manager SHALL 不正なレコードをスキップしてスキップ件数を UI に表示し、正常なレコードのみを復元する
5. IF バックアップファイルが 0 バイトである, THEN THE Backup_Manager SHALL 既存の確認ダイアログ（`backup-err-0byte`）を表示して処理を中断する
6. WHEN バックアップ保存先の `readwrite` 権限確認を実行する, THE Backup_Manager SHALL 権限が `granted` でない場合に `FAILED` 状態として UI に反映する

---

### 要件 8: バックアップ機能の UI テキスト・i18n 対応

**ユーザーストーリー:** ユーザーとして、バックアップ・リストア・メンテナンス機能のすべての UI テキストを設定した言語で確認したい。

#### 受け入れ条件

1. THE Maintenance_UI SHALL 新たに追加されるすべての UI テキスト（ボタンラベル・説明文・確認メッセージ・エラーメッセージ・トースト通知）について i18n キーを `shared/js/locales/ja.js`（および対応する各言語ファイル）に定義し、8 言語（en / ja / de / es / fr / pt / ko / zh）の翻訳を提供する
2. THE Maintenance_UI SHALL 復元確認ダイアログのタイトルに `confirm-restore` キーを、説明文に `confirm-restore-desc` キーを使用する
3. THE Maintenance_UI SHALL 削除/初期化確認ダイアログに `confirm-delete-initialize` の i18n キーを使用し、動的に生成された選択項目名のリストを含む文字列を表示する
4. THE Maintenance_UI SHALL チェックボックス項目ラベルに対して `maintenance-clear-{対象名}` の命名規則（例: `maintenance-clear-logs`、`maintenance-clear-categories`）で i18n キーを定義する
5. WHEN 新しい i18n キーを追加する, THE Maintenance_UI SHALL `ja.js` に日本語の正典文字列を最初に定義してから他の 7 言語ファイルに翻訳を追加する
6. IF i18n キーに対応する翻訳が定義されていない言語で UI を表示する, THEN THE Maintenance_UI SHALL 英語（`en`）の翻訳をフォールバックとして使用する
7. WHEN 削除/初期化確認ダイアログを表示する, THE Maintenance_UI SHALL 選択されたチェックボックスの項目名を動的にダイアログ本文に列挙する

