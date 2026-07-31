import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    build: {
        // 本番ビルドではソースマップを無効化し、ファイルサイズを削減します。
        sourcemap: false,
        // コード圧縮にTerserを使用し、オプションを設定します。
        minify: 'terser',
        terserOptions: {
            compress: {
                // 本番ビルドからconsole.logステートメントを削除します。
                drop_console: true,
                drop_debugger: true,
            },
        },
        // 出力ディレクトリ
        outDir: 'dist',
        // 入力ファイルを指定
        rollupOptions: {
            input: {
                app: path.resolve(__dirname, 'projects/app/app.html'),
                background: path.resolve(__dirname, 'projects/app/js/background.js'),
            },
        },
    },
});
