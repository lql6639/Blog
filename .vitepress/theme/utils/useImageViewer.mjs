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

  // 把搬走的缩略图放回原位
  const restoreTileImg = () => {
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

  const closeViewer = () => {
    restoreTileImg()
    viewer.list = []
    viewer.index = 0
    viewerCard = null
    document.body.style.overflow = ''
  }

  // 除了图片和翻页按钮，点查看器里任何位置都关闭（含底部计数、四周空白）
  const onViewerClick = (e) => {
    if (e.target.closest('.v-img, .v-btn')) return
    closeViewer()
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

  return { viewer, stageRef, openViewer, closeViewer, stepViewer, onViewerClick }
}
