import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

/**
 * 站内图片查看器。
 *
 * 随机图接口每次请求都会 302 到不同文件，直接拿图片地址当查看器图片会变成另一张，
 * 而最终图片没有 CORS 头、JS 也读不到真实地址；所以这里把已经渲染好的那个 <img>
 * 原样搬进查看器，保证看到的就是点开的那张。
 *
 * @returns {{
 *   viewer: { list: string[], index: number, moved: boolean },
 *   stageRef: import('vue').Ref<HTMLElement|null>,
 *   openViewer: (list: string[], card: Element|null, index: number) => void,
 *   closeViewer: () => void,
 *   stepViewer: (delta: number) => void,
 *   onViewerClick: (e: MouseEvent) => void
 * }}
 */
export const useImageViewer = () => {
  const viewer = reactive({ list: [], index: 0, moved: false })
  const stageRef = ref(null)

  // 这些是原始 DOM 引用，不能放进 reactive，否则会被代理
  let viewerCard = null
  let movedEl = null
  let movedMark = null

  // 拖动时从旁边补进来的那张（上一张 / 下一张）
  let neighborEl = null
  let neighborMark = null
  let neighborDir = 0
  const NEIGHBOR_GAP = 24
  // 到第一张/最后一张时还允许拖动多少，只给个"到头了"的手感
  const EDGE_LIMIT = 60

  const restoreNeighbor = () => {
    if (neighborEl && neighborMark && neighborMark.parentNode) {
      neighborMark.parentNode.replaceChild(neighborEl, neighborMark)
      neighborEl.classList.remove('v-img', 'v-neighbor')
      neighborEl.style.transform = ''
      neighborEl.style.transition = ''
    }
    neighborEl = null
    neighborMark = null
    neighborDir = 0
  }

  // 把相邻那张的缩略图也搬进来，拖动时才不会露出一大片空白
  const mountNeighbor = (dir) => {
    restoreNeighbor()
    if (!viewerCard) return
    const idx = viewer.index + dir
    if (idx < 0 || idx >= viewer.list.length) return

    // 按 tile 取而不是按 img 取：当前图的 img 已经被搬走，直接查 img 会错位
    const tile = [...viewerCard.querySelectorAll('.tile')][idx]
    const el = tile?.querySelector('img')
    // 超出九宫格（+N 那几张）没有缩略图可搬，就不显示相邻图
    if (!el) return

    el.style.transition = ''
    el.style.transform = ''
    neighborEl = el
    neighborDir = dir
    neighborMark = document.createComment('tile-img-neighbor')
    el.parentNode.insertBefore(neighborMark, el)
    el.classList.add('v-img', 'v-neighbor')
    nextTick(() => stageRef.value?.appendChild(el))
  }

  // 把搬走的缩略图放回原位
  const restoreTileImg = () => {
    restoreNeighbor()
    if (movedEl && movedMark && movedMark.parentNode) {
      movedMark.parentNode.replaceChild(movedEl, movedMark)
      movedEl.classList.remove('v-img')
    }
    movedEl = null
    movedMark = null
    viewer.moved = false
  }

  // 搬当前索引对应的缩略图进查看器
  const mountCurrentImage = () => {
    restoreTileImg()
    // 同样按 tile 取，避免当前图被搬走后 img 列表错位
    const tile = viewerCard ? [...viewerCard.querySelectorAll('.tile')][viewer.index] : null
    const el = tile?.querySelector('img')
    // 超出九宫格可见范围（+N 的那几张）时没有缩略图可搬，退回按地址加载
    if (!el) return

    // 上一张拖动留下的位移要清掉，否则新图会歪在一边
    el.style.transition = ''
    el.style.transform = ''

    movedEl = el
    movedMark = document.createComment('tile-img')
    el.parentNode.insertBefore(movedMark, el)
    el.classList.add('v-img')
    viewer.moved = true
    nextTick(() => {
      stageRef.value?.appendChild(el)
      measureCurWidth()
    })
  }

  const closeViewer = () => {
    restoreTileImg()
    viewer.list = []
    viewer.index = 0
    viewerCard = null
    document.body.style.overflow = ''
  }

  // 手势翻页：移动端触摸、PC 端按住拖拽，都用 pointer 事件统一处理
  const drag = { active: false, startX: 0, startY: 0, dx: 0, moved: false }
  let suppressClick = false

  // 除了翻页按钮，点查看器里任何位置都关闭（含图片本身、底部计数、四周空白）
  const onViewerClick = (e) => {
    if (e.target.closest('.v-btn')) return
    // 刚滑完一次不算点击，否则滑完就关了
    if (suppressClick) {
      suppressClick = false
      return
    }
    closeViewer()
  }

  // 当前图（排除拖动时借来的相邻图，它排在后面）
  const currentStageImg = () =>
    stageRef.value?.querySelector('img.v-img:not(.v-neighbor)') ||
    stageRef.value?.querySelector('img') ||
    null

  // 当前图的渲染宽度：拖动中复用，别每帧都量
  let curWidth = 0
  const measureCurWidth = () => {
    const cur = currentStageImg()
    curWidth = cur ? cur.getBoundingClientRect().width : 0
  }

  const onPointerDown = (e) => {
    if (!viewer.list.length) return
    if (e.target.closest('.v-btn')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.active = true
    drag.startX = e.clientX
    drag.startY = e.clientY
    drag.dx = 0
    drag.moved = false
    suppressClick = false
    // 保证手指/鼠标移出元素后仍能收到 move / up
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // 某些浏览器在非活跃指针上会抛错，忽略即可
      }
    }
  }

  const applyDragVisual = (dx) => {
    const cur = currentStageImg()
    if (!cur) return
    cur.style.transition = 'none'

    // 往左划是看下一张，往右划是看上一张
    const dir = dx < 0 ? 1 : -1
    const target = viewer.index + dir

    // 已经是第一张/最后一张：只给一点点位移意思一下，别把空白拉出来
    if (target < 0 || target >= viewer.list.length) {
      restoreNeighbor()
      const eased = Math.max(-EDGE_LIMIT, Math.min(EDGE_LIMIT, dx * 0.28))
      cur.style.transform = `translateX(${eased}px)`
      return
    }

    cur.style.transform = `translateX(${dx}px)`

    if (dir !== neighborDir) mountNeighbor(dir)
    if (!neighborEl) return

    // 相邻那张贴着当前图左右两侧一起走，中间就不会留一大片空白。
    // 宽度用缓存值：每帧读 getBoundingClientRect 会强制同步布局，划起来会卡
    const base = dir < 0 ? -(curWidth + NEIGHBOR_GAP) : curWidth + NEIGHBOR_GAP
    neighborEl.style.transition = 'none'
    neighborEl.style.transform = `translate(-50%, -50%) translateX(${base + dx}px)`
  }

  // 拖动中用 rAF 合帧，一帧只写一次样式
  let rafId = 0
  const scheduleVisual = () => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      if (drag.active) applyDragVisual(drag.dx)
    })
  }

  const onPointerMove = (e) => {
    if (!drag.active) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved) {
      // 水平位移够大、且明显大于竖向，才算滑动，避免斜着划误触
      if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return
      drag.moved = true
    }
    drag.dx = dx
    scheduleVisual()
  }

  const endPointerDrag = () => {
    if (!drag.active) return
    drag.active = false
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    const img = currentStageImg()
    if (img) {
      img.style.transition = ''
      img.style.transform = ''
    }
    // 先收掉借来的相邻图，再决定翻不翻页
    restoreNeighbor()
    if (drag.moved) {
      // 拦掉这次滑动后紧跟的 click，不然松手就把查看器关了
      suppressClick = true
      if (Math.abs(drag.dx) > 50) stepViewer(drag.dx < 0 ? 1 : -1)
    }
    drag.dx = 0
    drag.moved = false
  }

  const openViewer = (list, card, index) => {
    viewerCard = card
    viewer.list = list
    viewer.index = index
    document.body.style.overflow = 'hidden'
    mountCurrentImage()
  }

  // 到头就停在这张，不关闭
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

  return {
    viewer,
    stageRef,
    openViewer,
    closeViewer,
    stepViewer,
    onViewerClick,
    onPointerDown,
    onPointerMove,
    endPointerDrag
  }
}
