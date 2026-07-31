import js from '@eslint/js';
import globals from 'globals';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
    // TODO: 以下は段階的に除外解除予定。現在除外している理由:
    // - shared/js/db.js, logic.js, session_sync.js 等: ESLint 導入以前から存在する legacy コード。
    //   エラー数が多く一括対応が困難なため一時除外中。Phase 1 以降で順次解除予定。
    // - projects/app/js/background.js, backup.js: chrome.* API 使用コードで
    //   当初エラーが多発したため除外。globals 設定追加後も未解除のまま。
    // - projects/studio/, alarm-editor/ 等: サブプロジェクトはメインとは別フェーズで対応予定。
    {
        ignores: [
            'node_modules/',
            'test-results/',
            'dist_web/',
            'releases/',
            'tests/',
            'scripts/',
            'projects/web/',
            'projects/studio/',
            'projects/alarm-editor/',
            'projects/app/js/background.js',
            'projects/app/js/backup.js',
            'projects/category-editor/js/history.js',
            'projects/category-editor/js/data-io.js',
            'projects/category-editor/js/category-editor.js',
            'shared/js/animation/',
            'shared/js/locales/',
            'shared/js/animation_base.js',
            'shared/js/animation_registry.js',
            'shared/js/animation_worker.js',
            'shared/js/animations.js',
            'shared/js/db.js',
            'shared/js/idb_storage.js',
            'shared/js/logic.js',
            'shared/js/messages.js',
            'shared/js/session_sync.js',
        ],
    },
    js.configs.recommended,
    {
        plugins: {
            prettier: eslintPluginPrettier,
        },
    },
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.jest,
                ...globals.node,
                chrome: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'prettier/prettier': 'error',
        },
    },
    {
        files: ['**/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
        },
    },
    eslintConfigPrettier,
];
