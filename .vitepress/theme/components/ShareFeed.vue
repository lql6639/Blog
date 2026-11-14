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
    <button v-if="hasMore" class="share-more" @click="loadMore">加载更多</button>

    <!-- 图片查看器（站内打开，不跳页） -->
    <Teleport to="body">
      <div v-if="viewer.list.length" class="share-viewer" @click="onViewerClick">
        <!-- 翻页按钮常驻，到头不再隐藏；点到头只是停在这张，不会关闭 -->
        <button
          type="button"
          class="v-btn v-prev"
          :class="{ 'is-off': viewer.index === 0 }"
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
          type="button"
          class="v-btn v-next"
          :class="{ 'is-off': viewer.index >= viewer.list.length - 1 }"
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
import { useData } from "vitepress"
import { MAX_TILES, layoutOf, useShareFeed } from "@/utils/useShareFeed.mjs"
import { useImageViewer } from "@/utils/useImageViewer.mjs"

const { theme } = useData()
const author = computed(() => theme.value.siteMeta.author)

const { paged, hasMore, loadMore } = useShareFeed()
const { viewer, stageRef, openViewer, stepViewer, onViewerClick } = useImageViewer()
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

    /* 已经到头：按钮还在，只是置灰不可点 */
    &.is-off {
      opacity: 0.3;
      cursor: default;

      &:hover {
        background: rgba(255, 255, 255, 0.14);
      }
    }
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
