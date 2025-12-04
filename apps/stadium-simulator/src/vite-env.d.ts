/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLAUDE_API_KEY: string;
  readonly VITE_ANTHROPIC_API_URL: string;
  readonly VITE_DEPLOY_TARGET?: 'itch' | 'vercel' | 'github';
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
