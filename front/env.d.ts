/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string
  readonly VITE_API_URL?: string
  readonly VITE_API_MOCK?: string
  readonly VITE_MOCK_FAILURE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
