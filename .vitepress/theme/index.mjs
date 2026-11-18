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

// 手动注册 Service Worker，并监听更新：新 SW 激活后自动 reload 一次，
// 解决"部署后旧 SW 静默接管、页面不刷新、需手动强刷"的问题。
// 仅在浏览器环境执行（SSR 无 navigator）。
function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
      // 首次注册（无旧 SW）无需处理
      if (!navigator.serviceWorker.controller) return

      // 监听新 SW 的更新过程
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          // 新 SW 激活并接管页面后，自动刷新拿最新内容
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            window.location.reload()
          }
        })
      })
    })
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
