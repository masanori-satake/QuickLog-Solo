import js from '@eslint/js';
import globals from 'globals';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
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
            'shared/js/i18n.js',
            'shared/js/idb_storage.js',
            'shared/js/logic.js',
            'shared/js/messages.js',
            'shared/js/schema.js',
            'shared/js/session_sync.js',
            'shared/js/utils.js',
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
