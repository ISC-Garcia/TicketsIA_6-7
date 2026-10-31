/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK_FAILURE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
