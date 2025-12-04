import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(() => {
  const deployTarget = process.env.VITE_DEPLOY_TARGET;
  const isVercel = Boolean(process.env.VERCEL);

  // Determine base path based on deployment target
  let base = '/stadium-simulator/'; // Default for GitHub Pages (also used if deployTarget === 'github')

  if (deployTarget === 'itch') {
    base = './'; // Relative paths for itch.io CDN
  } else if (deployTarget === 'vercel') {
    base = '/';
  } else if (isVercel) {
    base = '/'; // Backward compatibility: auto-detect Vercel
  }

  return {
    base,
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
