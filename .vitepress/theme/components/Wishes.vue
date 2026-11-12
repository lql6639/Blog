<!-- 心情树洞：全屏画布 + 可拖拽便签 -->
<template>
  <div class="wishes-page">
    <!-- 画布 -->
    <div ref="boardRef" class="board" :class="{ 'is-mobile': isMobile }">
      <div
        v-for="(item, index) in filtered"
        :key="item.id"
        class="wish-card"
        :id="'wish-' + item.id"
        :data-color="item.color"
        :class="{
          dragging: draggingId === item.id,
          'just-added': item.id === addedId
        }"
        :style="cardStyle(item, index)"
        @mousedown="onCardDown(item)"
      >
        <div class="card-head" @mousedown="startDrag($event, item)">
          <span class="dots">
            <i class="dot red" />
            <i class="dot yellow" />
            <i class="dot green" />
          </span>
          <span class="card-tag">{{ typeText[item.type] }}</span>
        </div>
        <div class="card-body">{{ item.content }}</div>
        <div class="card-foot">
          <span class="nick">{{ item.nickname || '匿名' }}</span>
          <span class="date">{{ item.date }}</span>
        </div>
      </div>

      <div v-if="!filtered.length" class="empty">
        <i class="iconfont icon-search-empty" />
        <p>这里还空着，说点什么吧...</p>
      </div>
    </div>

    <!-- 顶部筛选 -->
    <div class="top-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="top-tab"
        :class="{ active: filter === tab.value }"
        @click="setFilter(tab.value)"
      >
        {{ tab.text }}
      </button>
    </div>

    <!-- 底部输入栏 -->
    <div class="input-bar">
      <input
        v-model="form.nickname"
        class="input-nick"
        :class="{ over: form.nickname.length > NICK_LEN }"
        type="text"
        placeholder="昵称"
      />
      <input
        v-model="form.content"
        class="input-content"
        :class="{ over: form.content.length > MAX_LEN }"
        type="text"
        :placeholder="form.type === 'wish' ? '写下你的心愿...' : '想说什么就说什么...'"
        @keydown.enter.prevent="submit"
      />
      <div class="bar-colors">
        <span
          v-for="c in COLORS"
          :key="c.value"
          class="bar-color"
          :class="{ active: form.color === c.value }"
          :style="{ background: c.bg }"
          @click="form.color = c.value"
        />
      </div>
      <button class="bar-type" @click="toggleType">
        {{ typeText[form.type] }}
      </button>
      <span class="char-counter" :class="{ over: form.content.length > MAX_LEN }">
        {{ form.content.length }}/{{ MAX_LEN }}
      </span>
      <button class="bar-btn" :disabled="sending" @click="submit">
        {{ sending ? '发布中' : '发布' }}
      </button>
    </div>

    <!-- 提示 -->
    <div class="toast" :class="{ show: toastShow }">{{ toastText }}</div>
  </div>
</template>

<script setup>
import { COLORS, MAX_LEN, NICK_LEN, tabs, typeText, useWishes } from '@/utils/wishes.mjs'

// 数据、布局、拖拽逻辑都在 utils/wishes.mjs，组件这边负责挂载时序与事件监听
const {
  boardRef,
  filter,
  setFilter,
  filtered,
  isMobile,
  draggingId,
  addedId,
  sending,
  toastShow,
  toastText,
  form,
  cardStyle,
  load,
  submit,
  toggleType,
  checkMobile,
  measureCards,
  relayout,
  settleAll,
  onCardDown,
  startDrag,
  stopDrag
} = useWishes()

// 窗口尺寸变化：等尺寸稳定下来再重排，不然拖边缘时会一直重撒便签
let resizeTimer = 0
const onResize = () => {
  checkMobile()
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    measureCards()
    relayout(true)
    requestAnimationFrame(() => settleAll())
  }, 180)
}

onMounted(() => {
  load()
  checkMobile()
  // 等页面布局稳定、拿到真实画布尺寸后再排布
  nextTick(() => {
    requestAnimationFrame(() => {
      checkMobile()
      measureCards()
      relayout(true)
      // 撒完再量一次真实四边，把出界的收回来
      requestAnimationFrame(() => settleAll())
    })
  })
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.clearTimeout(resizeTimer)
  window.removeEventListener('resize', onResize)
  // 拖拽时挂在 window 上的 mousemove/mouseup 也要一起摘掉
  stopDrag()
})
</script>

<style lang="scss" scoped>
.wishes-page {
  position: relative;
  height: calc(100vh - 60px);
  // 导航 .main-header 本身就在文档流里占了 60px，这里再加 margin 会多出一条空白带，
  // 而且画布底部会掉到视口外面，边界判断跟着错
  margin-top: 0;
  overflow: hidden;
}

/* ===== 画布 ===== */
.board {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 130px;

  &.is-mobile {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 84px 16px 150px;
  }
}

/* ===== 便签卡片 ===== */
.wish-card {
  position: absolute;
  width: 230px;
  border-radius: 14px;
  background: var(--main-card-background);
  border: 1px solid var(--main-card-border);
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  cursor: default;
  scale: 1;
  transition:
    left 0.5s cubic-bezier(0.34, 1.35, 0.64, 1),
    top 0.5s cubic-bezier(0.34, 1.35, 0.64, 1),
    transform 0.5s cubic-bezier(0.34, 1.35, 0.64, 1),
    scale 0.34s cubic-bezier(0.34, 1.35, 0.64, 1),
    box-shadow 0.3s ease,
    opacity 0.4s ease;
  animation: card-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) backwards;

  &:hover {
    box-shadow:
      0 14px 40px rgba(0, 0, 0, 0.16),
      0 4px 12px rgba(0, 0, 0, 0.08);
  }

  &.is-lifted {
    scale: 1.06;
  }

  &.dragging {
    cursor: grabbing;
    transition: none;
    box-shadow:
      0 22px 50px rgba(0, 0, 0, 0.25),
      0 6px 16px rgba(0, 0, 0, 0.12);
    z-index: 999 !important;
  }

  &.just-added {
    animation: card-pop 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }

  // 卡片配色（只影响标签）
  &[data-color='green'] {
    --tag-bg: rgba(76, 175, 80, 0.18);
    --tag-color: #2e7d32;
    --tag-dot: #43a047;
  }
  &[data-color='yellow'] {
    --tag-bg: rgba(255, 193, 7, 0.22);
    --tag-color: #f57f17;
    --tag-dot: #f9a825;
  }
  &[data-color='purple'] {
    --tag-bg: rgba(156, 39, 176, 0.15);
    --tag-color: #7b1fa2;
    --tag-dot: #9c27b0;
  }
  &[data-color='pink'] {
    --tag-bg: rgba(233, 30, 99, 0.15);
    --tag-color: #c2185b;
    --tag-dot: #e91e63;
  }
  &[data-color='blue'] {
    --tag-bg: rgba(33, 150, 243, 0.18);
    --tag-color: #1565c0;
    --tag-dot: #1e88e5;
  }
  &[data-color='orange'] {
    --tag-bg: rgba(255, 152, 0, 0.2);
    --tag-color: #e65100;
    --tag-dot: #f57c00;
  }
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  cursor: grab;
  user-select: none;

  .dots {
    display: flex;
    gap: 5px;

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: block;

      &.red {
        background: #ff5f57;
      }
      &.yellow {
        background: #febc2e;
      }
      &.green {
        background: #28c840;
      }
    }
  }

  .card-tag {
    font-size: 11px;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 6px;
    font-weight: 600;
    letter-spacing: 0.02em;
    background: var(--tag-bg, rgba(0, 0, 0, 0.06));
    color: var(--tag-color, var(--main-font-second-color));
  }
}

.card-body {
  padding: 2px 14px 10px;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--main-font-color);
  word-break: break-word;
  white-space: pre-wrap;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid var(--main-card-border);
  font-size: 11px;
  color: var(--main-font-second-color);

  .nick {
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* 移动端卡片回归普通流 */
.board.is-mobile .wish-card {
  position: relative;
  width: 100%;
  flex: 0 0 auto; // 防止被 flex 容器压扁
  animation: card-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

/* ===== 顶部筛选 ===== */
.top-tabs {
  position: fixed;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  z-index: 10;

  .top-tab {
    padding: 6px 16px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--main-font-second-color);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.24s ease;

    &:hover {
      color: var(--main-font-color);
      background: var(--main-color-bg);
    }

    &.active {
      color: var(--main-color);
      background: var(--main-color-bg);
      font-weight: 600;
    }
  }
}

/* ===== 底部输入栏 ===== */
.input-bar {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 9px;
  width: calc(100% - 48px);
  max-width: 700px;
  padding: 10px 16px;
  border-radius: 18px;
  background: var(--main-mask-second-background);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--main-card-border);
  box-shadow: 0 8px 30px var(--main-border-shadow);
  z-index: 30;
  transition: box-shadow 0.3s ease;

  &:focus-within {
    box-shadow: 0 12px 38px rgba(0, 0, 0, 0.14);
  }

  input {
    font-family: inherit;
    font-size: 13.5px;
    padding: 9px 13px;
    border-radius: 11px;
    border: 1px solid var(--main-card-border);
    outline: none;
    background: var(--main-card-background);
    color: var(--main-font-color);
    min-width: 0;
    transition: border-color 0.2s ease;

    &::placeholder {
      color: var(--main-font-second-color);
      opacity: 0.7;
    }

    &:focus {
      border-color: var(--main-color);
    }

    // 超字数不拦输入，只用红边提示；真正阻止发生在点发布时
    &.over,
    &.over:focus {
      border-color: var(--main-error-color);
    }
  }

  .input-nick {
    width: 78px;
    flex-shrink: 0;
  }

  .input-content {
    flex: 1;
  }
}

.bar-colors {
  display: flex;
  gap: 5px;
  flex-shrink: 0;

  .bar-color {
    width: 17px;
    height: 17px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid transparent;
    opacity: 0.6;
    transition: all 0.2s ease;

    &:hover,
    &.active {
      opacity: 1;
      border-color: var(--main-font-color);
      transform: scale(1.12);
    }
  }
}

.bar-type {
  flex-shrink: 0;
  padding: 6px 11px;
  border-radius: 9px;
  border: 1px solid var(--main-card-border);
  background: var(--main-card-second-background);
  color: var(--main-font-second-color);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    color: var(--main-font-color);
  }
}

.char-counter {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--main-font-second-color);
  opacity: 0.7;
  white-space: nowrap;

  &.over {
    color: var(--main-error-color);
    opacity: 1;
    font-weight: 600;
  }
}

.bar-btn {
  flex-shrink: 0;
  padding: 9px 18px;
  border: none;
  border-radius: 11px;
  background: var(--main-color);
  color: #fff;
  font-size: 13.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.24s ease;
  box-shadow: 0 2px 8px var(--main-color-bg);

  &:hover {
    transform: translateY(-1px);
    opacity: 0.92;
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
}

/* ===== 空态 ===== */
.empty {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--main-font-second-color);
  opacity: 0.6;

  .iconfont {
    font-size: 34px;
    margin-bottom: 10px;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
}

/* ===== Toast ===== */
.toast {
  position: fixed;
  left: 50%;
  bottom: 104px;
  transform: translateX(-50%) translateY(10px);
  padding: 8px 20px;
  border-radius: 12px;
  background: rgba(44, 44, 44, 0.9);
  backdrop-filter: blur(10px);
  color: #fff;
  font-size: 13px;
  z-index: 40;
  opacity: 0;
  pointer-events: none;
  transition: all 0.32s ease;

  &.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* ===== 动画 ===== */
@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
  }
}

@keyframes card-pop {
  0% {
    opacity: 0;
    scale: 0.86;
  }
  60% {
    scale: 1.04;
  }
  100% {
    opacity: 1;
    scale: 1;
  }
}

/* ===== 移动端 ===== */
@media (max-width: 767px) {
  /* 标题去掉后画布顶部不需要留那么多：筛选底部约在 96px，
     画布从 60px 起，留 56px 让第一张便签落在筛选下方 20px 左右 */
  .board.is-mobile {
    padding-top: 56px;
  }

  .top-tabs {
    top: 68px;
    // 标题已移除，移动端也只有筛选，保持与桌面一致的居中
    left: 50%;
    right: auto;
    transform: translateX(-50%);
  }

  .input-bar {
    flex-wrap: wrap;
    gap: 7px;
    width: calc(100% - 24px);
    bottom: 14px;
    padding: 9px 12px;

    .input-nick {
      width: 58px;
    }

    .bar-colors {
      order: 10;
      width: 100%;
      justify-content: center;
      padding-top: 3px;
    }
  }

  // 窄屏优先保证输入框宽度，字数提示让位
  .char-counter {
    display: none;
  }
}
</style>
