// 本项目没有直接安装 vite（由 VitePress 内置）
// 这里手写最小可用的 ImportMeta 声明，供 .vue/.ts 里的 import.meta.env 使用。
interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly SSR: boolean
  readonly MODE: string
  readonly BASE_URL: string
  readonly VITE_WEATHER_KEY: string
  readonly [key: string]: unknown
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
