/**
 * 站点统计（自建）：数据来自 api-server 的 /v1/stats，D1 存储。
 * 不再依赖不蒜子等第三方统计服务。
 */

import { ref } from 'vue'

const API_BASE = 'https://server.lovlin.cn'

// 全站共享的统计值：上报成功后写入，组件直接读，避免"看到的是上一次的数字"
export const liveStats = ref(null)

// 当前页面的阅读量（跟随 location.pathname）
export const livePagePv = ref(null)
export const livePagePath = ref('')

// 本次访问已成功上报的路径：POST 返回的是"含本次访问"的最新值，
// 比先发出的 GET 更新，所以 GET 回来时不要覆盖它。
let reportedPath = ''

// 同一路径 1 秒内重复上报视为重复（路由抖动 / HMR / 双次触发）
let lastPath = ''
let lastAt = 0

// 本地开发不上报，避免污染线上数据
const isLocalHost = () => {
  if (typeof window === 'undefined') return true
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(window.location.hostname)
}

/**
 * 上报一次访问（PV +1），并把返回的最新统计写回共享状态。
 * @param {string} [path] - 页面路径，缺省取当前 location.pathname
 */
export const reportVisit = async (path) => {
  if (typeof window === 'undefined' || isLocalHost()) return
  const target = path || window.location.pathname
  const now = Date.now()
  if (target === lastPath && now - lastAt < 1000) return
  lastPath = target
  lastAt = now

  // 换页面时先清掉上一页的阅读量，避免串页显示
  if (target !== livePagePath.value) {
    livePagePath.value = target
    livePagePv.value = null
    reportedPath = ''
  }

  try {
    const res = await fetch(`${API_BASE}/v1/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: target }),
      keepalive: true
    })
    if (!res.ok) return
    const json = await res.json()
    // 爬虫被跳过时不覆盖真实数据
    if (json?.success && json?.data && !json.data.skipped) {
      liveStats.value = json.data
      if (typeof json.data.page_pv === 'number') {
        livePagePath.value = target
        livePagePv.value = json.data.page_pv
        reportedPath = target
      }
    }
  } catch (error) {
    // 统计失败不影响页面，静默处理
    console.warn('上报访问失败：', error)
  }
}

/**
 * 读取站点统计
 * @param {string} [path] - 可选，附带该页面 PV
 * @returns {Promise<{site_pv:number,site_uv:number,page_pv?:number}|null>}
 */
export const fetchStats = async (path) => {
  try {
    const query = path ? `?path=${encodeURIComponent(path)}` : ''
    const res = await fetch(`${API_BASE}/v1/stats${query}`, { cache: 'no-store' })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const json = await res.json()
    if (!json?.success || !json?.data) throw new Error('返回数据无效')
    // 已有更新的上报结果时不回退
    if (!liveStats.value) liveStats.value = json.data
    if (path && typeof json.data.page_pv === 'number') {
      // 该路径本次已上报过，GET 的值不带本次访问，别把数字改小
      if (reportedPath !== path) {
        livePagePath.value = path
        livePagePv.value = json.data.page_pv
      }
    }
    return json.data
  } catch (error) {
    console.warn('获取站点统计失败：', error)
    return null
  }
}
