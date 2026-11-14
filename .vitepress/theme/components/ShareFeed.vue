<template>
  <div class="share-feed">
    <!-- 动态列表 -->
    <div v-if="paged.length" class="share-list">
      <article v-for="item in paged" :key="item.id" class="share-card s-card">
        <!-- 左：头像 -->
        <div class="avatar">
          <img :src="author.cover" :alt="author.name" loading="lazy" />
        </div>

        <!-- 右：昵称 / 正文 / 图片 / 时间，吃满剩余宽度 -->
        <div class="body">
          <header class="head">
            <span class="identity">
              <span class="name">{{ author.name }}</span>
              <span v-if="item.device" class="device">来自于 {{ item.device }}</span>
            </span>
          </header>

          <!-- 正文：铺满整行 -->
          <div v-if="item.paragraphs.length" class="text">
            <p v-for="(para, i) in item.paragraphs" :key="i">{{ para }}</p>
          </div>

          <!-- 图片：三列方格，最多 6 张，多的显示 +N -->
          <div
            v-if="item.images.length"
            class="gallery"
            :class="`gallery--${layoutOf(item.images.length)}`"
          >
            <button
              v-for="(img, i) in item.images.slice(0, MAX_TILES)"
              :key="img + i"
              type="button"
              class="tile"
              @click="openViewer(item.images, $event.currentTarget.closest('.share-card'), i)"
            >
              <img :src="img" :alt="`${author.name} 分享的图片 ${i + 1}`" loading="lazy" />
              <span v-if="i === MAX_TILES - 1 && item.images.length > MAX_TILES" class="more">
                +{{ item.images.length - MAX_TILES }}
              </span>
            </button>
          </div>

          <footer class="foot">
            <time :datetime="item.iso" :title="item.fullText">{{ item.timeText }}</time>
            <span v-if="item.location" class="location">
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
                />
              </svg>
              {{ item.location }}
            </span>
          </footer>
        </div>
      </article>
    </div>

    <!-- 空态 -->
    <div v-else class="share-empty s-card">
      <i class="iconfont icon-search-empty" />
      <p>还没有日常分享</p>
    </div>

    <!-- 加载更多 -->
    <button v-if="hasMore" class="share-more" @click="visible += PAGE_SIZE">加载更多</button>

    <!-- 图片查看器（站内打开，不跳页） -->
    <Teleport to="body">
      <div v-if="viewer.list.length" class="share-viewer" @click.self="closeViewer">
        <button type="button" class="v-btn v-close" title="关闭" @click="closeViewer">
          <i class="iconfont icon-close" />
        </button>

        <button
          v-if="viewer.index > 0"
          type="button"
          class="v-btn v-prev"
          title="上一张"
          @click.stop="stepViewer(-1)"
        >
          <i class="iconfont icon-left" />
        </button>

        <div ref="stageRef" class="v-stage">
          <img
            v-if="!viewer.moved"
            class="v-img"
            :src="viewer.list[viewer.index]"
            :alt="`图片 ${viewer.index + 1}`"
          />
        </div>

        <button
          v-if="viewer.index < viewer.list.length - 1"
          type="button"
          class="v-btn v-next"
          title="下一张"
          @click.stop="stepViewer(1)"
        >
          <i class="iconfont icon-right" />
        </button>

        <div class="v-count">{{ viewer.index + 1 }} / {{ viewer.list.length }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import dayjs from 'dayjs'
import { useData } from 'vitepress'
import shareData from '@/assets/shareData.mjs'

const PAGE_SIZE = 8
// 九宫格最多显示 6 张，超出部分用 +N 角标
const MAX_TILES = 6

const { theme } = useData()
const author = computed(() => theme.value.siteMeta.author)

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

const entries = shareData
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
      // 每张图带独立种子，避免同一条里的重复地址被浏览器合并
      images: (item.images || []).map((src, i) => withImageSeed(src, seed + i)),
      location: item.location || '',
      device: item.device || ''
    }
  })
  .sort((a, b) => b.ts - a.ts)

const visible = ref(PAGE_SIZE)
const paged = computed(() => entries.slice(0, visible.value))
const hasMore = computed(() => entries.length > paged.value.length)

const layoutOf = (n) => (n === 1 ? 'single' : n === 2 ? 'duo' : 'grid')

// ---------- 图片查看器 ----------
const viewer = reactive({ list: [], index: 0, moved: false })
const stageRef = ref(null)
let viewerCard = null
let movedEl = null
let movedMark = null

// 随机图接口每次请求都会 302 到不同文件，直接拿地址当查看器图片就会变成另一张。
// 这里把已经渲染好的那个 <img> 原样搬进查看器，保证看到的就是点开的那张
const restoreTileImg = () => {
  if (movedEl && movedMark && movedMark.parentNode) {
    movedMark.parentNode.replaceChild(movedEl, movedMark)
    movedEl.classList.remove('v-img')
  }
  movedEl = null
  movedMark = null
  viewer.moved = false
}

const mountCurrentImage = () => {
  restoreTileImg()
  const tiles = viewerCard ? [...viewerCard.querySelectorAll('.tile img')] : []
  const el = tiles[viewer.index]
  // 超出九宫格可见范围（+N 的那几张）时没有缩略图可搬，退回按地址加载
  if (!el) return

  movedEl = el
  movedMark = document.createComment('tile-img')
  el.parentNode.insertBefore(movedMark, el)
  el.classList.add('v-img')
  viewer.moved = true
  nextTick(() => stageRef.value?.appendChild(el))
}

const openViewer = (list, card, index) => {
  viewerCard = card
  viewer.list = list
  viewer.index = index
  document.body.style.overflow = 'hidden'
  mountCurrentImage()
}

const closeViewer = () => {
  restoreTileImg()
  viewer.list = []
  viewer.index = 0
  viewerCard = null
  document.body.style.overflow = ''
}

const stepViewer = (delta) => {
  const next = viewer.index + delta
  if (next < 0 || next >= viewer.list.length) return
  viewer.index = next
  mountCurrentImage()
}

const onKeydown = (e) => {
  if (!viewer.list.length) return
  if (e.key === 'Escape') closeViewer()
  else if (e.key === 'ArrowLeft') stepViewer(-1)
  else if (e.key === 'ArrowRight') stepViewer(1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  restoreTileImg()
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
.share-feed {
  margin-top: 1rem;
}

/* ---------- 卡片 ---------- */
.share-list {
  display: grid;
  gap: 14px;
}

.share-card {
  /* 左头像 + 右内容两栏，右侧吃满剩余宽度 */
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: default;
  padding: 1.1rem;

  &:hover {
    transform: none;
    border-color: var(--main-card-border);
    box-shadow: 0 8px 16px -4px var(--main-border-shadow);
  }

  .body {
    flex: 1;
    min-width: 0;
    /* 供 .gallery 用 cqw 计算格子边长：窄屏时三种布局一起收缩 */
    container-type: inline-size;
  }

  .head {
    display: flex;
    align-items: center;
    min-height: 42px;
    gap: 10px;
  }

  .avatar {
    flex: 0 0 42px;
    width: 42px;
    height: 42px;
    overflow: hidden;
    border-radius: 50%;

    img {
      width: 100%;
      height: 100%;
      margin: 0;
      object-fit: cover;
      border-radius: 50%;
    }
  }

  /* 昵称与设备标签按基线对齐，文字落在同一条线上 */
  .identity {
    display: inline-flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }

  .name {
    min-width: 0;
    color: var(--main-font-color);
    font-size: 20px;
    font-weight: 600;
  }

  /* 发布设备，跟在昵称右边 */
  .device {
    padding: 0 6px;
    color: var(--main-font-second-color);
    font-size: 11px;
  }

  /* 正文：按段渲染 */
  .share-feed & .text p {
    margin: 0 0 6px;
    color: var(--main-font-color);
    font-size: 14.5px;
    line-height: 1.85;
    text-align: left;
    word-break: break-word;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .text {
    margin-top: 10px;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    margin-top: 12px;
    color: var(--main-font-second-color);
    font-size: 12px;

    .location {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
  }
}

/* ---------- 图片 ---------- */
/* 所有布局（单图 / 双图 / 九宫格）共用同一个格子边长 --tile：
   桌面最多 170px，窄屏按三列等分收缩，保证三种布局永远一样大 */
.gallery {
  --tile-gap: 8px;
  --tile: min(170px, calc((100cqw - var(--tile-gap) * 2) / 3));

  display: grid;
  grid-template-columns: repeat(3, var(--tile));
  gap: var(--tile-gap);
  margin-top: 12px;

  .tile {
    position: relative;
    display: block;
    width: 100%;
    /* 固定方格比例：查看器把 img 搬走时格子不会塌陷 */
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    overflow: hidden;
    border-radius: 8px;
    background: var(--main-card-second-background);
    cursor: zoom-in;

    &:hover img {
      transform: scale(1.04);
    }

    .more {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.45);
      color: #fff;
      font-size: 17px;
      font-weight: 600;
      pointer-events: none;
    }
  }

  /* 双图：两列，格子与九宫格同尺寸 */
  &--duo {
    grid-template-columns: repeat(2, var(--tile));
  }

  /* 单图：同样一列一格，尺寸与多图一致，不再单独放大 */
  &--single {
    grid-template-columns: var(--tile);
  }
}

/* 比例直接写在 img 上（width:100% + aspect-ratio），避免依赖绝对定位；
   选择器权重高于 .markdown-main-style img，覆盖主题的默认样式 */
.share-feed .share-card .gallery .tile img {
  display: block;
  width: 100%;
  height: 100%;
  margin: 0;
  border-radius: inherit;
  object-fit: cover;
  transition: transform 0.35s ease;
}

/* ---------- 空态 / 加载更多 ---------- */
.share-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 3rem 1rem;
  cursor: default;
  color: var(--main-font-second-color);

  .iconfont {
    font-size: 26px;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
}

.share-more {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 42px;
  margin-top: 14px;
  border: 1px solid var(--main-card-border);
  border-radius: 10px;
  background: var(--main-card-background);
  color: var(--main-font-color);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.25s;

  &:hover {
    border-color: var(--main-color);
    color: var(--main-color);
  }
}

/* ---------- 图片查看器 ---------- */
.share-viewer {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.92);
  animation: share-viewer-fade 0.2s ease;

  /* 只是给搬进来的图片占位，不生成盒子，保证点空白处仍能触发关闭 */
  .v-stage {
    display: contents;
  }

  .v-img {
    max-width: 92vw;
    max-height: 88vh;
    margin: 0;
    border-radius: 8px;
    object-fit: contain;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }

  .v-btn {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.26);
    }
  }

  .v-close {
    top: 22px;
    right: 22px;
  }

  .v-prev {
    left: 22px;
  }

  .v-next {
    right: 22px;
  }

  .v-count {
    position: absolute;
    bottom: 22px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.85);
    font-size: 13px;
  }
}

@keyframes share-viewer-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ---------- 响应式 ---------- */
@media (max-width: 767px) {
  .share-card {
    padding: 0.9rem;
  }

  /* 手机端：空格收窄一点，尺寸由 --tile 的 cqw 计算自动等分 */
  .gallery {
    --tile-gap: 6px;
  }

  .share-viewer {
    .v-prev,
    .v-next {
      width: 36px;
      height: 36px;
      font-size: 16px;
    }

    .v-prev {
      left: 10px;
    }

    .v-next {
      right: 10px;
    }
  }
}
</style>
