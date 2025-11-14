import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(() => {
  const isVercel = Boolean(process.env.VERCEL);

  return {
    base: isVercel ? '/' : '/stadium-simulator/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks: {
            phaser: ['phaser'],
          },
        },
      },
    },
    publicDir: 'public',
    server: {
      port: 3000,
      open: true,
    },
  };
});
