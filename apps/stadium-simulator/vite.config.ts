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
      host: true, // Listen on all addresses (0.0.0.0) for devcontainer access
      port: 3000,
      open: false, // Don't auto-open browser in devcontainer
      strictPort: false,
      cors: true, // Allow cross-origin requests in dev mode
    },
  };
});
