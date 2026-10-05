/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_THINGSBOARD_URL: string;
  readonly VITE_THINGSBOARD_DEVICE_ID: string;
  readonly VITE_THINGSBOARD_API_KEY: string;
  readonly VITE_THINGSBOARD_HISTORY_LIMIT: string;
  readonly VITE_THINGSBOARD_HISTORY_WINDOW_MS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
