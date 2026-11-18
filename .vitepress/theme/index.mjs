import { h } from 'vue'
import { createPinia } from 'pinia'
import { routeChange } from '@/utils/initTools.mjs'
import { reportVisit } from '@/utils/stats.mjs'
import { initPet } from '@/utils/pet.mjs'
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
import LazyLoader from '@/components/LazyLoader.vue'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

// 根组件
import App from '@/App.vue'
// 全局样式
import '@/style/main.scss'

// pinia
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// 手动注册 Service Worker，并在新版本接管后自动刷新一次，
// 解决"部署后旧 SW 静默接管、页面不刷新、需手动强刷"。
// 仅在浏览器环境执行（SSR 无 navigator）。
function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  // 首次安装时 SW 也会 clientsClaim 接管页面，那一次不该刷新，用这个标记区分
  let hadController = !!navigator.serviceWorker.controller
  let reloaded = false

  // controllerchange 才是"新 SW 真正接管"的时刻。不用猜 installing / waiting 的时序，
  // 也不会因为 register() 返回太晚而错过 updatefound 事件。
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // 浏览器自带的更新检查有节流，刚部署完就打开页面可能压根不查，主动查一次
        registration.update().catch(() => {})

        // 页面长期挂着时，切回标签页再查一次
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {})
          }
        })
      })
      .catch(() => {
        // 注册失败（隐私模式禁用 SW 等）不影响页面本身
      })
  })
}

// 部署后旧的 chunk 文件会被删掉，但浏览器里可能还跑着上一版的 JS，
// 这时动态 import 会 404（控制台表现为 net::ERR_ABORTED 503）。
// 清掉缓存并强制刷新一次，比让用户卡在坏页面上强。
// 用 sessionStorage 打标，避免反复刷新；一个会话最多自动救一次。
function handlePreloadError() {
  // SSR 阶段没有 window，enhanceApp 在服务端也会跑一遍
  if (typeof window === 'undefined') return
  window.addEventListener('vite:preloadError', async (event) => {
    event.preventDefault()
    try {
      if (sessionStorage.getItem('kz:preload-reloaded')) return
      sessionStorage.setItem('kz:preload-reloaded', '1')
    } catch {
      // 隐私模式下 sessionStorage 可能不可用，仍然继续刷新
    }
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    } catch {
      // 没有 Cache API 就直接刷新
    }
    window.location.reload()
  })
}

// Theme
const Theme = {
  // extends: Theme,
  Layout: () => {
    return h(App)
  },
  enhanceApp({ app, router, siteData }) {
    // 挂载
    app.use(pinia)
    app.component('LazyLoader', LazyLoader)
    // 插件
    enhanceAppWithTabs(app)
    // 部署后旧 chunk 失效时自动清缓存刷新，先挂监听再注册 SW
    handlePreloadError()
    // 注册 SW 并监听更新（自动 reload，保证打开即最新）
    registerServiceWorker()
    // 右下角看板娘（懒加载，失败不影响页面）
    initPet()
    // 站点统计：首屏上报一次，之后由路由钩子负责（内部有 1 秒去重）
    reportVisit()
    // 初次加载已有服务端渲染的页面，跳过路由动画，避免 hydration 时重新遮住首屏。
    let isInitialRoute = true
    router.onBeforeRouteChange = (to) => {
      if (isInitialRoute) return
      routeChange('before', to)
    }
    router.onAfterRouteChanged = (to) => {
      // 路由切换上报一次访问。统一用 location.pathname（cleanUrls 下不带 .html），
      // 不要另外按 relativePath 拼后缀，否则页面级 PV 会与站点 PV 对不上号。
      reportVisit()
      if (isInitialRoute) {
        isInitialRoute = false
        return
      }
      routeChange('after', to)
    }
  }
}

export default Theme
