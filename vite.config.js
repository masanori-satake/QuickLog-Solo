import { defineConfig } from 'vite';

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
  },
});
