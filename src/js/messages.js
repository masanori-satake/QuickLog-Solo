/**
 * QuickLog-Solo: Message Bundle for Multi-language Support
 */

export const messages = {
    _common: {
        'lang-ja-native': '日本語',
        'lang-en-native': 'English',
        'glyph-language': 'translate'
    },
    ja: {
        // UI Header & Sections
        'title': 'QuickLog-Solo',
        'copy-report-btn': '日報コピー',
        'copy-aggregation-btn': '集計コピー',
        'settings': '設定',
        'delete': '削除',

        // Controls
        'pause': '一時停止',
        'resume': '再開',
        'stop': '終了',

        // Settings Modal
        'tab-general': '一般',
        'tab-categories': 'カテゴリ',
        'tab-maintenance': 'メンテナンス',
        'tab-about': 'About',

        // General Tab
        'setting-language': '表示言語',
        'lang-auto': 'ブラウザの表示言語',
        'lang-ja': '日本語',
        'lang-en': '英語',
        'setting-theme': 'テーマ',
        'theme-system': 'システム設定に従う',
        'theme-light': 'ライトモード',
        'theme-dark': 'ダークモード',
        'setting-font': '表示フォント',
        'setting-animation': '背景アニメーション',
        'btn-export-csv': 'CSVエクスポート',
        'btn-import-csv': 'CSVインポート',

        // Categories Tab
        'placeholder-new-category': '新しいカテゴリ...',
        'category-backup': 'カテゴリーのバックアップ',
        'btn-export-json': 'エクスポート (JSON)',
        'btn-import-json': 'インポート (JSON)',
        'import-setting': 'インポート設定:',
        'import-append': '追記',
        'import-overwrite': '上書き',

        // About Tab
        'version': 'バージョン',
        'developer': '開発者',
        'about-description': 'QuickLog-Solo は、プライバシー重視のミニマリストな作業ログツールです。データはブラウザ内の IndexedDB にのみ保存され、外部送信は一切行われません。外部ライブラリを使用しない軽量・セキュアな設計で、サイドパネルからいつでも素早く記録できます。',

        // Maintenance Tab
        'maintenance-clear-logs': 'ログの削除',
        'btn-clear-logs': 'ログをすべて削除',
        'maintenance-reset-all': '設定とカテゴリの初期化',
        'maintenance-reset-all-desc': 'ログは維持されます。',
        'btn-reset-all': 'カテゴリ・設定を初期化',
        'maintenance-reset-settings': '設定のみの初期化',
        'maintenance-reset-settings-desc': 'ログとカテゴリは維持されます。',
        'btn-reset-settings': '設定のみを初期化',

        // Messages & Dialogs
        'confirm-end-task': '本当に作業を終了しますか？',
        'confirm-cancel': 'キャンセル',
        'confirm-delete-category': 'カテゴリ「{name}」を削除しますか？\n（過去のログからはカテゴリ色が消えます）',
        'confirm-import-overwrite': '既存のカテゴリーをすべて削除して上書きしますか？',
        'confirm-export-csv': 'ログデータをCSVとして書き出します。実行中の作業がある場合は終了されます。よろしいですか？',
        'confirm-import-csv': 'CSVファイルからログデータを読み込みます。既存のデータに追記されます。実行中の作業がある場合は終了されます。よろしいですか？',
        'confirm-clear-logs': '全てのログを削除します。実行中の作業がある場合は終了されます。よろしいですか？',
        'confirm-reset-all': 'カテゴリと各種設定を初期化します。実行中の作業がある場合は終了されます。よろしいですか？（ログは維持されます）',
        'confirm-reset-settings': '各種設定を初期化します。実行中の作業がある場合は終了されます。よろしいですか？（ログとカテゴリは維持されます）',

        'alert-invalid-category': '無効なカテゴリ名です。（50文字以内、「{idle}」は使用不可）',
        'alert-duplicate-category': '同名のカテゴリが既に存在します。',
        'alert-import-error': 'カテゴリーのインポートに失敗しました。ファイル形式を確認してください。',
        'alert-init-error': 'アプリの初期化に失敗しました。ページを再読み込みしてください。',

        'toast-copied': 'コピーしました！',
        'toast-done': '完了しました！',
        'toast-imported': 'インポートが完了しました。',
        'toast-cat-imported': 'カテゴリーをインポートしました',
        'toast-deleted': '削除が完了しました',

        // Dynamic Elements
        'day-names': ['日', '月', '火', '水', '木', '金', '土'],
        'idle-category': '(待機)',
        'font-system': 'システムフォント',
        'anim-default': 'デフォルトを使用',

        // Initial Categories
        'init-cat-dev': '💻 開発・プログラミング',
        'init-cat-meeting': '🤝 チームミーティング・定例会',
        'init-cat-research': '🔍 調査・リサーチ・技術検証',
        'init-cat-admin': '事務作業・メール対応 📝',
        'init-cat-focus': '🔥 深い集中が必要なタスク',
        'init-cat-skill': '📚 自己研鑽・スキルアップ',
        'init-cat-idea': '💡 アイデア出し・企画立案',
        'init-cat-break': '☕ メンタル休憩・リフレッシュ',
        'init-cat-client': '📞 クライアント連絡・電話',
        'init-cat-doc': '📝 資料作成・レポート',
        'init-cat-design': '🎨 デザイン・UI/UX検討',
        'init-cat-bug': '🐛 バグ修正・品質改善',
        'init-cat-release': '🚀 リリース・デプロイ作業',
        'init-cat-tool': '🛠 ツール整備・自動化',
        'init-cat-schedule': '🗓 スケジュール調整・タスク管理',
        'init-cat-chat': '💬 チャット対応・Slack/Teams',
        'init-cat-wiki': '📖 ドキュメント整備・Wiki更新',
        'init-cat-qa': '🧪 テスト・QA作業',
        'init-cat-sales': '💼 営業・提案活動',
        'init-cat-arch': '🏗 アーキテクチャ設計',
        'init-cat-sec': '🔐 セキュリティ対応・監査',
        'init-cat-data': '📊 データ分析・SQL',
        'init-cat-wfh': '🏠 在宅ワーク環境整備',
        'init-cat-move': '🚶 移動・外出'
    },
    en: {
        // UI Header & Sections
        'title': 'QuickLog-Solo',
        'copy-report-btn': 'Copy Daily Report',
        'copy-aggregation-btn': 'Copy Stats',
        'settings': 'Settings',
        'delete': 'Delete',

        // Controls
        'pause': 'Pause',
        'resume': 'Resume',
        'stop': 'Stop',

        // Settings Modal
        'tab-general': 'General',
        'tab-categories': 'Categories',
        'tab-maintenance': 'Maintenance',
        'tab-about': 'About',

        // General Tab
        'setting-language': 'Language',
        'lang-auto': 'Browser Language',
        'lang-ja': 'Japanese',
        'lang-en': 'English',
        'setting-theme': 'Theme',
        'theme-system': 'Follow System',
        'theme-light': 'Light Mode',
        'theme-dark': 'Dark Mode',
        'setting-font': 'Display Font',
        'setting-animation': 'Background Animation',
        'btn-export-csv': 'Export CSV',
        'btn-import-csv': 'Import CSV',

        // Categories Tab
        'placeholder-new-category': 'New category...',
        'category-backup': 'Category Backup',
        'btn-export-json': 'Export (JSON)',
        'btn-import-json': 'Import (JSON)',
        'import-setting': 'Import Mode:',
        'import-append': 'Append',
        'import-overwrite': 'Overwrite',

        // About Tab
        'version': 'Version',
        'developer': 'Developer',
        'about-description': 'QuickLog-Solo is a privacy-focused minimalist work log tool. Data is saved only in IndexedDB within your browser and is never sent externally. It features a lightweight, secure design with no external libraries, allowing for quick recording anytime from the sidebar.',

        // Maintenance Tab
        'maintenance-clear-logs': 'Clear Logs',
        'btn-clear-logs': 'Delete All Logs',
        'maintenance-reset-all': 'Reset Settings & Categories',
        'maintenance-reset-all-desc': 'Logs will be preserved.',
        'btn-reset-all': 'Reset Categories & Settings',
        'maintenance-reset-settings': 'Reset Settings Only',
        'maintenance-reset-settings-desc': 'Logs and categories will be preserved.',
        'btn-reset-settings': 'Reset Settings Only',

        // Messages & Dialogs
        'confirm-end-task': 'Do you really want to end the task?',
        'confirm-cancel': 'Cancel',
        'confirm-delete-category': 'Do you want to delete category "{name}"?\n(Category colors will be removed from past logs)',
        'confirm-import-overwrite': 'Delete all existing categories and overwrite?',
        'confirm-export-csv': 'Logs will be exported as CSV. Any active task will be ended. Proceed?',
        'confirm-import-csv': 'Logs will be imported from CSV and appended. Any active task will be ended. Proceed?',
        'confirm-clear-logs': 'All logs will be deleted. Any active task will be ended. Proceed?',
        'confirm-reset-all': 'Categories and settings will be reset. Any active task will be ended. Proceed? (Logs will be preserved)',
        'confirm-reset-settings': 'Settings will be reset. Any active task will be ended. Proceed? (Logs and categories will be preserved)',

        'alert-invalid-category': 'Invalid category name. (Max 50 chars, "{idle}" is reserved)',
        'alert-duplicate-category': 'A category with the same name already exists.',
        'alert-import-error': 'Failed to import categories. Please check the file format.',
        'alert-init-error': 'Failed to initialize the application. Please reload the page.',

        'toast-copied': 'Copied!',
        'toast-done': 'Done!',
        'toast-imported': 'Import completed.',
        'toast-cat-imported': 'Categories imported',
        'toast-deleted': 'Deletion completed',

        // Dynamic Elements
        'day-names': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        'idle-category': '(Idle)',
        'font-system': 'System Default',
        'anim-default': 'Use Default',

        // Initial Categories
        'init-cat-dev': '💻 Development/Coding',
        'init-cat-meeting': '🤝 Team Meeting/Regular Sync',
        'init-cat-research': '🔍 Investigation/Research',
        'init-cat-admin': 'Admin/Email 📝',
        'init-cat-focus': '🔥 Deep Focus Tasks',
        'init-cat-skill': '📚 Self-Improvement/Skills',
        'init-cat-idea': '💡 Ideation/Planning',
        'init-cat-break': '☕ Mental Break/Refresh',
        'init-cat-client': '📞 Client Call/Communication',
        'init-cat-doc': '📝 Documentation/Reporting',
        'init-cat-design': '🎨 Design/UI/UX',
        'init-cat-bug': '🐛 Bug Fix/Quality Imp.',
        'init-cat-release': '🚀 Release/Deployment',
        'init-cat-tool': '🛠 Tooling/Automation',
        'init-cat-schedule': '🗓 Scheduling/Task Mgmt',
        'init-cat-chat': '💬 Chat/Slack/Teams',
        'init-cat-wiki': '📖 Wiki/Documentation',
        'init-cat-qa': '🧪 Testing/QA Work',
        'init-cat-sales': '💼 Sales/Proposal',
        'init-cat-arch': '🏗 Architecture Design',
        'init-cat-sec': '🔐 Security/Audit',
        'init-cat-data': '📊 Data Analysis/SQL',
        'init-cat-wfh': '🏠 Home Office Setup',
        'init-cat-move': '🚶 Travel/Outing'
    }
};
