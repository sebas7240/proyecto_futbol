/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production';
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface TurnstileOptions {
  sitekey: string;
  action?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  language?: string;
  size?: 'normal' | 'compact' | 'flexible';
  theme?: 'light' | 'dark' | 'auto';
  callback?: (token: string) => void;
  'error-callback'?: (code?: string) => void;
  'expired-callback'?: () => void;
  'unsupported-callback'?: () => void;
  'response-field'?: boolean;
  'refresh-expired'?: 'auto' | 'manual' | 'never';
}

interface Window {
  turnstile?: {
    render(container: HTMLElement, options: TurnstileOptions): string;
    reset(widgetId: string): void;
    remove(widgetId: string): void;
  };
}

declare module 'hls.js/dist/hls.light.mjs' {
  export { default } from 'hls.js';
}
