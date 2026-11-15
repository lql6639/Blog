import { computed, ref } from 'vue'
import { useData } from 'vitepress'
import dayjs from 'dayjs'
import { themeConfig as defaultThemeConfig } from '@/assets/themeConfig.mjs'

// 分享数据 API 地址（api-server 的 share 模块，D1 存储）
const SHARE_API = 'https://server.lovlin.cn/v1/share'

// 九宫格最多显示 9 张，超出部分用 +N 角标
export const MAX_TILES = 9

const PAGE_SIZE = 8

// 稳定哈希：同一条动态每次渲染都得到同一组图片地址
const hashString = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// 远程图片追加稳定查询参数（与首页 PostList 的封面同思路）：
// 1) 同一条动态里的多张图地址互不相同，浏览器不会当成同一张图只请求一次
// 2) 每次渲染地址不变，避免刷图闪动与 SSR 水合不一致
// 3) 换了图片内容但地址没变时，把该条的 v 改大即可刷新
const withImageSeed = (url, seed) => {
  if (!/^https?:\/\//i.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}_share=${seed}`
}

/**
 * 按图片数量给出布局类名后缀：单图 / 双图 / 九宫格
 *
 * @param {number} n 图片数量
 * @returns {'single'|'duo'|'grid'}
 */
export const layoutOf = (n) => {
  if (n === 1) return 'single'
  return n === 2 ? 'duo' : 'grid'
}

/**
 * 把分享数据里的 images 字段统一成地址数组。
 *
 * - `images: 3`：按数量从主题配置的默认图池里取图（便于集中维护图源）
 * - `images: ['a.jpg', 'b.jpg']`：直接给地址，兼容旧写法
 *
 * @param {number|string[]} images 图片数量或地址数组
 * @param {number} seed 稳定种子
 * @param {string[]} pool 主题配置里的默认图池
 * @returns {string[]}
 */
const normalizeImages = (images, seed, pool) => {
  if (Array.isArray(images)) {
    return images.map((src, i) => withImageSeed(src, seed + i))
  }

  const count = Number(images) || 0
  if (count <= 0 || !pool.length) return []

  return Array.from({ length: count }, (_, i) => {
    const src = pool[(seed + i) % pool.length]
    return withImageSeed(src, seed + i)
  })
}

const buildEntries = (shareList, pool) =>
  (shareList || [])
    .map((item, index) => {
      const time = dayjs(item.date)
      const text = item.text || ''
      const seed = hashString(`${item.date}|${text}|${item.v || ''}`)
      return {
        id: `share-${time.format('YYYYMMDDHHmmss')}-${index}`,
        ts: time.valueOf(),
        iso: time.toISOString(),
        timeText:
          time.year() === dayjs().year()
            ? time.format('M月D日 HH:mm')
            : time.format('YYYY年M月D日 HH:mm'),
        fullText: time.format('YYYY-MM-DD HH:mm'),
        // 按换行切段，每段单独缩进
        paragraphs: text
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean),
        images: normalizeImages(item.images, seed, pool),
        location: item.location || '',
        device: item.device || ''
      }
    })
    .sort((a, b) => b.ts - a.ts)

/**
 * 日常分享列表：时间倒序 + 分页。
 *
 * 数据源改为 api-server 的 /v1/share 接口（D1 存储），
 * 图片地址取自主题配置 `cover.showCover.defaultCover`（可用根目录 themeConfig.mjs 覆盖），
 * share 数据里只写数量，改图源时只改一处。
 *
 * @param {number} [pageSize] 每次加载条数，默认 8
 * @returns {{
 *   entries: import('vue').ComputedRef<object[]>,
 *   paged: import('vue').ComputedRef<object[]>,
 *   hasMore: import('vue').ComputedRef<boolean>,
 *   loadMore: () => void
 * }}
 */
export const useShareFeed = (pageSize = PAGE_SIZE) => {
  const { theme } = useData()

  const pool = computed(
    () =>
      theme.value?.cover?.showCover?.defaultCover ??
      defaultThemeConfig.cover.showCover.defaultCover ??
      []
  )

  // 分享原始数据（从 /v1/share 接口拉取）
  const shareList = ref([])
  const loaded = ref(false)

  const entries = computed(() => buildEntries(shareList.value, pool.value))
  const visible = ref(pageSize)
  const paged = computed(() => entries.value.slice(0, visible.value))
  const hasMore = computed(() => entries.value.length > paged.value.length)

  const loadMore = () => {
    visible.value += pageSize
  }

  // 客户端挂载后从接口拉取分享数据
  const loadShareData = async () => {
    if (loaded.value) return shareList.value
    loaded.value = true
    try {
      const res = await fetch(SHARE_API)
      if (!res.ok) throw new Error(`加载分享失败：${res.status}`)
      const json = await res.json()
      shareList.value = Array.isArray(json?.data) ? json.data : []
    } catch (error) {
      console.error(error)
      shareList.value = []
    }
    return shareList.value
  }

  if (typeof window !== 'undefined') {
    loadShareData()
  }

  return { entries, paged, hasMore, loadMore }
}
