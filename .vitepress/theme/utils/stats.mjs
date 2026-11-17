/**
 * 站点统计（自建）：数据来自 api-server 的 /v1/stats，D1 存储。
 * 不再依赖不蒜子等第三方统计服务。
 */

const API_BASE = 'https://server.lovlin.cn'

// 同一路径 1 秒内重复上报视为重复（路由抖动 / HMR / 双次触发）
let lastPath = ''
let lastAt = 0

// 本地开发不上报，避免污染线上数据
const isLocalHost = () => {
  if (typeof window === 'undefined') return true
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(window.location.hostname)
}

/**
 * 上报一次访问（PV +1）
 * @param {string} [path] - 页面路径，缺省取当前 location.pathname
 */
export const reportVisit = async (path) => {
  if (typeof window === 'undefined' || isLocalHost()) return
  const target = path || window.location.pathname
  const now = Date.now()
  if (target === lastPath && now - lastAt < 1000) return
  lastPath = target
  lastAt = now

  try {
    await fetch(`${API_BASE}/v1/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: target }),
      keepalive: true
    })
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
    return json.data
  } catch (error) {
    console.warn('获取站点统计失败：', error)
    return null
  }
}
