<!-- 全局搜索（本地全文索引，不依赖 Algolia） -->

<template>
  <Modal
    :show="store.searchShow"
    title="全站搜索"
    titleIcon="search"
    :maxWidth="760"
    :maxHeight="74"
    @mask-click="closeSearch"
    @modal-close="closeSearch"
  >
    <div class="local-search">
      <!-- 搜索框 -->
      <div class="search-box">
        <i class="iconfont icon-search" />
        <input
          ref="inputRef"
          v-model="keyword"
          class="search-input"
          type="search"
          :placeholder="placeholder"
          autocomplete="off"
          spellcheck="false"
          @keydown="onKeydown"
        />
        <i
          v-if="keyword"
          class="iconfont icon-close clear"
          title="清空"
          @click="keyword = ''"
        />
      </div>

      <!-- 结果 -->
      <div class="search-result">
        <div
          v-for="(item, index) in results"
          :key="item.path"
          :class="[
            'search-item',
            's-card',
            'hover',
            { active: index === activeIndex }
          ]"
          @mouseenter="activeIndex = index"
          @click="jump(item)"
        >
          <div class="item-head">
            <span class="title" v-html="item.titleHtml" />
            <span class="date">{{ item.dateText }}</span>
          </div>
          <p v-if="item.snippet" class="snippet" v-html="item.snippet" />
          <div v-if="item.chips.length" class="chips">
            <span v-for="chip in item.chips" :key="chip" class="chip">
              # {{ chip }}
            </span>
          </div>
        </div>

        <div v-if="!results.length" class="no-result">
          <i class="iconfont icon-search" />
          <span class="text">
            {{
              loading
                ? '正在载入索引…'
                : keyword
                  ? '没有找到相关文章'
                  : '暂无文章'
            }}
          </span>
        </div>
      </div>

      <!-- 底栏：固定在面板最下方一行 -->
      <div class="search-footer">
        <span class="count">{{ footerText }}</span>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { mainStore } from '@/store'
import { usePostData } from '@/utils/usePostData.mjs'

// 空关键词时展示的最近文章数
const RECENT_COUNT = 8
// 结果上限
const MAX_RESULT = 30

const store = mainStore()
const router = useRouter()
const { site } = useData()
const { postData } = usePostData()

const keyword = ref('')
const activeIndex = ref(0)
const inputRef = ref(null)
const indexData = ref([]) // 全文索引（懒加载）
const loading = ref(false)
let indexPromise = null

const placeholder = '搜索标题、标签或正文…'

const footerText = computed(() =>
  keyword.value.trim() ? `找到 ${total.value} 篇` : '最近文章'
)

// 懒加载全文索引；失败时静默回退到文章元数据
const loadIndex = () => {
  if (indexData.value.length) return Promise.resolve(indexData.value)
  if (indexPromise) return indexPromise
  loading.value = true
  const base = (site.value?.base || '/').replace(/\/$/, '')
  indexPromise = fetch(`${base}/data/searchIndex.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then((data) => {
      indexData.value = Array.isArray(data) ? data : []
      return indexData.value
    })
    .catch((error) => {
      console.warn('[search] 全文索引加载失败，回退为标题/标签搜索', error)
      return []
    })
    .finally(() => {
      loading.value = false
      indexPromise = null
    })
  return indexPromise
}

// 回退数据源：构建期注入的文章元数据（无正文）
const metaSource = computed(() =>
  postData.value.map((item) => ({
    path: item.regularPath,
    title: item.title,
    date: item.date || 0,
    tags: item.tags || [],
    categories: item.categories || [],
    description: item.description || '',
    text: ''
  }))
)

const source = computed(() =>
  indexData.value.length ? indexData.value : metaSource.value
)

// 关键词分词（空格分隔；中文整句视为一个词）
const tokens = computed(() =>
  keyword.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
)

const escapeHtml = (str) =>
  String(str ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char]
  )

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 先转义再包 <mark>，避免 v-html 注入
const highlight = (text) => {
  const safe = escapeHtml(text)
  if (!tokens.value.length) return safe
  const pattern = tokens.value
    .map((token) => escapeRegExp(escapeHtml(token)))
    .filter(Boolean)
    .join('|')
  if (!pattern) return safe
  return safe.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>')
}

// 截取命中位置附近的正文片段
const buildSnippet = (text) => {
  if (!text) return ''
  const lower = text.toLowerCase()
  let pos = -1
  for (const token of tokens.value) {
    const hit = lower.indexOf(token)
    if (hit !== -1 && (pos === -1 || hit < pos)) pos = hit
  }
  if (pos === -1) {
    return highlight(text.length > 110 ? `${text.slice(0, 110)}…` : text)
  }
  const start = Math.max(0, pos - 40)
  const end = Math.min(text.length, pos + 80)
  return `${start > 0 ? '…' : ''}${highlight(
    text.slice(start, end)
  )}${end < text.length ? '…' : ''}`
}

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

// 匹配 + 打分
const matched = computed(() => {
  const list = source.value
  const words = tokens.value

  if (!words.length) {
    return list.slice(0, RECENT_COUNT).map((post) => ({ post }))
  }

  const hits = []
  for (const post of list) {
    const title = String(post.title || '').toLowerCase()
    const tags = (post.tags || []).join(' ').toLowerCase()
    const categories = (post.categories || []).join(' ').toLowerCase()
    const description = String(post.description || '').toLowerCase()
    const text = String(post.text || '').toLowerCase()
    const haystack = `${title} ${tags} ${categories} ${description} ${text}`

    // 所有关键词都命中才算匹配
    if (!words.every((word) => haystack.includes(word))) continue

    let score = 0
    for (const word of words) {
      if (title.includes(word)) score += 6
      if (tags.includes(word) || categories.includes(word)) score += 4
      if (description.includes(word)) score += 3
      if (text.includes(word)) score += 1
    }
    hits.push({ post, score })
  }

  hits.sort(
    (a, b) => b.score - a.score || (b.post.date || 0) - (a.post.date || 0)
  )
  return hits.slice(0, MAX_RESULT)
})

const total = computed(() => matched.value.length)

const results = computed(() =>
  matched.value.map(({ post }) => ({
    path: post.path,
    titleHtml: highlight(post.title || '未命名文章'),
    snippet: tokens.value.length
      ? buildSnippet(post.text || post.description || '')
      : '',
    chips: [...(post.categories || []), ...(post.tags || [])].slice(0, 3),
    dateText: formatDate(post.date)
  }))
)

// 选中项复位
watch(keyword, () => {
  activeIndex.value = 0
})

const moveActive = (step) => {
  const count = results.value.length
  if (!count) return
  activeIndex.value = (activeIndex.value + step + count) % count
  nextTick(() => {
    document
      .querySelector('.local-search .search-item.active')
      ?.scrollIntoView({ block: 'nearest' })
  })
}

const onKeydown = (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActive(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActive(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const item = results.value[activeIndex.value]
    if (item) jump(item)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    closeSearch()
  }
}

const closeSearch = () => {
  if (store.searchShow) store.changeShowStatus('searchShow')
}

const jump = (item) => {
  if (!item?.path) return
  closeSearch()
  router.go(item.path)
}

// 打开时载入索引并聚焦
watch(
  () => store.searchShow,
  (show) => {
    if (!show) return
    activeIndex.value = 0
    loadIndex()
    nextTick(() => inputRef.value?.focus())
  }
)

// Cmd/Ctrl + K 快捷唤起
const onGlobalKeydown = (event) => {
  if (!(event.metaKey || event.ctrlKey)) return
  if (String(event.key).toLowerCase() !== 'k') return
  event.preventDefault()
  if (!store.searchShow) store.changeShowStatus('searchShow', false)
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<style lang="scss" scoped>
.local-search {
  display: flex;
  flex-direction: column;
  // 高度按内容自适应，最多到 62vh；结果多时只有列表区滚动，底栏始终留在最下方
  max-height: min(62vh, 520px);

  .search-box {
    display: flex;
    flex: none;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 0 1rem;
    height: 44px;
    border-radius: 8px;
    border: 1px solid var(--main-card-border);
    background-color: var(--main-card-second-background);
    transition:
      border-color 0.3s,
      box-shadow 0.3s;

    &:focus-within {
      border-color: var(--main-color);
      box-shadow: 0 8px 16px -4px var(--main-color-bg);
    }

    .iconfont {
      font-size: 18px;
      opacity: 0.6;
    }

    .search-input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: none;
      outline: none;
      background: transparent;
      font-size: 16px;
      color: var(--main-font-color);
      font-family: var(--main-font-family);

      &::placeholder {
        color: var(--main-color-gray);
      }

      &::-webkit-search-cancel-button {
        display: none;
      }
    }

    .clear {
      cursor: pointer;
      transition: color 0.3s;

      &:hover {
        color: var(--main-color);
      }
    }
  }

  .search-result {
    flex: 1 1 auto;
    min-height: 0;
    margin-top: 1rem;
    padding-bottom: 2px;
    overflow-y: auto;
    overscroll-behavior: contain;

    .search-item {
      margin-bottom: 10px;
      padding: 0.8rem 1rem;
      box-shadow: none;

      &.active {
        border-color: var(--main-color);
        box-shadow: 0 8px 16px -4px var(--main-color-bg);
      }

      .item-head {
        display: flex;
        flex-direction: row;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;

        .title {
          font-size: 16px;
          font-weight: bold;
          color: var(--main-font-color);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .date {
          flex-shrink: 0;
          font-size: 12px;
          color: var(--main-color-gray);
        }
      }

      .snippet {
        margin: 0.5rem 0 0;
        font-size: 13px;
        line-height: 1.7;
        color: var(--main-font-second-color);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .chips {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 0.6rem;

        .chip {
          font-size: 12px;
          color: var(--main-color-gray);
        }
      }

      &:last-child {
        margin-bottom: 0;
      }
    }

    .no-result {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 160px;
      color: var(--main-color-gray);

      .iconfont {
        font-size: 34px;
        opacity: 0.45;
      }

      .text {
        font-size: 15px;
      }
    }
  }

  // v-html 渲染的高亮片段不带 scopeId，需要用 :deep
  :deep(mark) {
    padding: 0 2px;
    border-radius: 3px;
    color: var(--main-color);
    background-color: var(--main-color-bg);
  }

  // 底栏：始终占一行，固定在面板最下方，不被列表内容挤压
  .search-footer {
    display: flex;
    flex: none;
    flex-direction: row;
    align-items: center;
    gap: 1rem;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--main-card-border);
    font-size: 12px;
    line-height: 1.4;
    color: var(--main-color-gray);
  }
}
</style>
