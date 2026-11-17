/**
 * 同步页面标题到 Twikoo 的 counter 表。
 *
 * Twikoo 只在首次记录某个 url 时写入标题，之后改了文章标题、管理面板里还是旧标题。
 * 这里在页面加载时顺手校正一次；同一浏览器、同一标题只发一次请求（localStorage 记着）。
 */

const API_BASE = 'https://server.lovlin.cn'
const STORAGE_PREFIX = 'kz:counter-title:'

const isLocalHost = () => {
  if (typeof window === 'undefined') return true
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(window.location.hostname)
}

/**
 * @param {string} title - 页面完整标题，形如「文章标题 | koizora」
 */
export const syncCounterTitle = async (title) => {
  if (typeof window === 'undefined' || isLocalHost()) return

  const url = window.location.pathname
  const text = String(title || '').trim()
  if (!url || !text) return

  const key = STORAGE_PREFIX + url
  try {
    if (window.localStorage.getItem(key) === text) return
  } catch {
    // 隐私模式下 localStorage 可能不可用，照常请求
  }

  try {
    const res = await fetch(`${API_BASE}/v1/counter/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title: text })
    })
    if (!res.ok) return
    try {
      window.localStorage.setItem(key, text)
    } catch {
      // 忽略
    }
  } catch (error) {
    console.warn('同步页面标题失败：', error)
  }
}
