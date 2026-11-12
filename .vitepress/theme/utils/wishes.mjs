import { computed, nextTick, reactive, ref } from 'vue'
import seedWishes from '../assets/wishesData.mjs'

// ===== 对外常量（模板直接用） =====
export const MAX_LEN = 50
export const NICK_LEN = 10
export const STORE_KEY = 'blog:wishes'

export const typeText = { wish: '心愿', treehole: '树洞' }

export const COLORS = [
  { value: 'green', bg: '#c8e6c9' },
  { value: 'orange', bg: '#ffe0b2' },
  { value: 'yellow', bg: '#fff9c4' },
  { value: 'pink', bg: '#ffcdd2' },
  { value: 'blue', bg: '#bbdefb' },
  { value: 'purple', bg: '#e1bee7' }
]

export const tabs = [
  { text: '全部', value: 'all' },
  { text: '心愿', value: 'wish' },
  { text: '树洞', value: 'treehole' }
]

// 首次进入的示例数据：内容放在 assets/wishesData.mjs（不带 id），
// 这里按顺序补上运行时的 key（布局、错位都以 id 为索引）
const SEED = seedWishes.map((item, index) => ({
  id: `seed-${index + 1}`,
  ...item
}))

// 洗牌：数据文件里第一条固定是「小胡同学」，而手机端是流式列表、
// 顺序就是显示顺序，刷新几次都看到它排第一。每次进入打乱一次，
// 保证第一张（以及后面每张）都是随机的。
const shuffle = (list) => {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ===== 画布边界 =====
// 边距尽量小，让便签能用满整块画布：clampPos 负责操作过程中的预判，
// settleAll 再用真实包围盒兜底，两道关都过不了才算出界
const CARD_W = 230
const EDGE_X = 12 // 左右只留一点点，不然可用区域被压得太窄
const EDGE_TOP = 54 // 只让开顶部筛选（筛选底部约在 board 内 44px）
const EDGE_BOTTOM = 78 // 只让开底部输入栏
const LIFT_PAD = 6 // 拖拽时卡片是 scale(1.06)，留一点余量免得贴边被裁

const DRAG_THRESHOLD = 5

/**
 * 心情树洞：状态、布局、拖拽、发布等逻辑
 *
 * 只管数据和算法，不碰生命周期：
 * 挂载时的初始化时序、窗口 resize 监听、卸载清理都写在 Wishes.vue 里，
 * 由组件调用这里暴露的 load / checkMobile / measureCards / relayout / settleAll / stopDrag。
 *
 */
export const useWishes = () => {
  const boardRef = ref(null)
  const items = ref([])
  const layout = ref({})
  // 每张卡的"原位"：点击时的错位都相对它算，连点也不会越飘越远
  const anchors = ref({})
  const filter = ref('all')
  const isMobile = ref(false)
  const draggingId = ref(null)
  const addedId = ref(null)
  const sending = ref(false)
  const toastShow = ref(false)
  const toastText = ref('')

  const form = reactive({
    nickname: '',
    content: '',
    color: 'green',
    type: 'wish'
  })

  const filtered = computed(() => {
    if (filter.value === 'all') return items.value
    return items.value.filter((i) => i.type === filter.value)
  })

  // 模板里不要直接 `filter = x` 赋值（解构出来的 ref 在模板赋值时不保证 .value 被正确写入）
  const setFilter = (value) => {
    filter.value = value
  }

  const cardStyle = (item, index) => {
    if (isMobile.value) return {}
    const pos = layout.value[item.id]
    if (!pos) return { opacity: 0 }
    return {
      left: pos.left + 'px',
      top: pos.top + 'px',
      transform: `rotate(${pos.rotate}deg)`
    }
  }

  // 卡片高度随内容变化（120~175），按实际渲染高度算边界，底部不会空一大块
  const cardHeight = ref(175)
  const measureCards = () => {
    const el = boardRef.value
    if (!el) return
    let maxH = 0
    el.querySelectorAll('.wish-card').forEach((c) => {
      maxH = Math.max(maxH, c.offsetHeight)
    })
    if (maxH > 0) cardHeight.value = maxH
  }

  // 旋转会让卡片的视觉包围盒变大，按角度把这块补进边界里，
  // 否则 rotate 一加，边上的便签就"飘"出画布了
  const bounds = (rotate = 0) => {
    const el = boardRef.value
    if (!el) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    const w = el.clientWidth
    const h = el.clientHeight
    const cardH = cardHeight.value
    const rad = (Math.abs(rotate) * Math.PI) / 180
    const boxW = CARD_W * Math.cos(rad) + cardH * Math.sin(rad)
    const boxH = CARD_W * Math.sin(rad) + cardH * Math.cos(rad)
    const ex = Math.max(0, (boxW - CARD_W) / 2) + LIFT_PAD
    const ey = Math.max(0, (boxH - cardH) / 2) + LIFT_PAD
    return {
      minX: EDGE_X + ex,
      maxX: Math.max(EDGE_X + ex, w - CARD_W - EDGE_X - ex),
      minY: EDGE_TOP + ey,
      maxY: Math.max(EDGE_TOP + ey, h - cardH - EDGE_BOTTOM - ey)
    }
  }

  const clampPos = (left, top, rotate = 0) => {
    const b = bounds(rotate)
    return {
      left: Math.round(Math.min(Math.max(left, b.minX), b.maxX)),
      top: Math.round(Math.min(Math.max(top, b.minY), b.maxY))
    }
  }

  // 落位后兜底：按"目标位置 + 每张卡实高 + 旋转角"算出四条边，
  // 哪条出去了就把整张推回来（不能读 getBoundingClientRect，卡片还在
  // left/top 的 0.5s 过渡里，量到的是飞行中的中间值，会越推越远）
  const settleAll = () => {
    const el = boardRef.value
    if (!el || isMobile.value) return
    const w = el.clientWidth
    const h = el.clientHeight
    const next = { ...layout.value }
    let changed = false

    el.querySelectorAll('.wish-card').forEach((card) => {
      const id = card.id.slice('wish-'.length)
      const pos = next[id]
      if (!pos) return

      const cw = card.offsetWidth || CARD_W
      const ch = card.offsetHeight || cardHeight.value
      const rad = (Math.abs(pos.rotate) * Math.PI) / 180
      const boxW = cw * Math.cos(rad) + ch * Math.sin(rad)
      const boxH = cw * Math.sin(rad) + ch * Math.cos(rad)

      // 旋转以中心为原点，所以包围盒四边按中心往外摊
      const cx = pos.left + cw / 2
      const cy = pos.top + ch / 2
      const left = cx - boxW / 2
      const right = cx + boxW / 2
      const top = cy - boxH / 2
      const bottom = cy + boxH / 2

      let dx = 0
      let dy = 0
      if (left < EDGE_X) dx = EDGE_X - left
      else if (right > w - EDGE_X) dx = w - EDGE_X - right
      if (top < EDGE_TOP) dy = EDGE_TOP - top
      else if (bottom > h - EDGE_BOTTOM) dy = h - EDGE_BOTTOM - bottom

      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
        next[id] = {
          ...pos,
          left: Math.round(pos.left + dx),
          top: Math.round(pos.top + dy)
        }
        changed = true
      }
    })

    if (changed) layout.value = next
  }

  // 桌面端：把画布切成网格，每格内随机撒开——既有散落感，又不会全挤在一处
  // force = true 时忽略已有位置重新排布（初次挂载、窗口尺寸变化）
  const relayout = (force = false) => {
    if (!boardRef.value || isMobile.value) return
    const w = boardRef.value.clientWidth
    const h = boardRef.value.clientHeight
    if (w < 320) return

    const total = items.value.length
    const cols = Math.max(1, Math.min(total, Math.floor((w - EDGE_X * 2) / (CARD_W + 26))))
    const rows = Math.max(1, Math.ceil(total / cols))
    const cellW = (w - EDGE_X * 2) / cols
    const cellH = Math.max(150, (h - EDGE_TOP - EDGE_BOTTOM) / rows)

    const next = {}

    items.value.forEach((item, i) => {
      const old = force ? null : layout.value[item.id]
      if (old) {
        // 画布变小（窗口缩放）时旧位置可能已经在外面，顺手收回来
        const p = clampPos(old.left, old.top, old.rotate)
        next[item.id] = { ...old, ...p }
        return
      }

      const col = i % cols
      const row = Math.floor(i / cols)
      const maxX = Math.max(0, cellW - CARD_W)
      const maxY = Math.max(0, cellH - cardHeight.value)
      const rotate = +(Math.random() * 5 - 2.5).toFixed(2)
      const pos = clampPos(
        EDGE_X + col * cellW + Math.random() * maxX,
        EDGE_TOP + row * cellH + Math.random() * maxY,
        rotate
      )

      next[item.id] = { ...pos, rotate }
    })

    layout.value = next
    anchors.value = { ...next }
  }

  const checkMobile = () => {
    const mobile = window.innerWidth < 768
    if (mobile !== isMobile.value) {
      isMobile.value = mobile
      if (!mobile) {
        measureCards()
        relayout()
        // 从流式栅格切回绝对定位要等渲染完，才量得到真实四边
        requestAnimationFrame(() => requestAnimationFrame(() => settleAll()))
      }
    }
  }

  const load = () => {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      const data = raw ? JSON.parse(raw) : null
      items.value = shuffle(Array.isArray(data) && data.length ? data : SEED.map((i) => ({ ...i })))
    } catch {
      items.value = shuffle(SEED.map((i) => ({ ...i })))
    }
  }

  const save = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(items.value))
    } catch {
      /* 忽略存储失败 */
    }
  }

  const toast = (msg) => {
    toastText.value = msg
    toastShow.value = true
    window.clearTimeout(toast._t)
    toast._t = window.setTimeout(() => (toastShow.value = false), 2200)
  }

  // 新卡单独找空位，已有卡片位置不动
  const placeCard = (item) => {
    if (!boardRef.value || isMobile.value) return

    const occupied = Object.values(layout.value)
    const limit = bounds(0)

    const maxLeft = Math.max(0, limit.maxX - limit.minX)
    const maxTop = Math.max(0, limit.maxY - limit.minY)
    let best = null

    for (let t = 0; t < 80; t++) {
      const rotate = +(Math.random() * 5 - 2.5).toFixed(2)
      const pos = clampPos(
        limit.minX + Math.random() * maxLeft,
        limit.minY + Math.random() * maxTop,
        rotate
      )
      const cand = { ...pos, rotate }
      best = cand
      const clash = occupied.some(
        (p) =>
          Math.abs(p.left - cand.left) < CARD_W - 8 &&
          Math.abs(p.top - cand.top) < cardHeight.value - 12
      )
      if (!clash) break
    }

    layout.value = { ...layout.value, [item.id]: best }
    anchors.value = { ...anchors.value, [item.id]: { ...best } }
  }

  const newId = () => `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

  const submit = () => {
    const content = form.content.trim()
    const nickname = form.nickname.trim()
    if (!content) return toast('还没写内容呢')
    // 用未 trim 的长度判断，才能和输入框红边、右下角计数器保持同一口径
    if (form.content.length > MAX_LEN)
      return toast(`内容最多 ${MAX_LEN} 个字，现在 ${form.content.length} 个`)
    if (form.nickname.length > NICK_LEN)
      return toast(`昵称最多 ${NICK_LEN} 个字，现在 ${form.nickname.length} 个`)

    sending.value = true
    const now = new Date()
    const item = {
      id: newId(),
      content,
      nickname: nickname || '匿名',
      color: form.color,
      type: form.type,
      date: `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`
    }

    items.value = [item, ...items.value]
    addedId.value = item.id
    save()
    placeCard(item)
    // 等新卡真正渲染出来，量过高度再校边界，然后才播抬起动画
    nextTick(() => {
      requestAnimationFrame(() => {
        measureCards()
        settleAll()
        raise(item)
      })
    })

    form.content = ''
    sending.value = false
    toast('已经贴上去啦')

    window.setTimeout(() => (addedId.value = null), 900)
  }

  const toggleType = () => {
    form.type = form.type === 'wish' ? 'treehole' : 'wish'
  }

  // 抬起层级：越点越靠上，保证被点的那张始终在最前
  let raiseZ = 20
  const raise = (item) => {
    const el = document.getElementById('wish-' + item.id)
    if (!el) return
    el.style.zIndex = String(++raiseZ)
    // 拿起来一点再落回：没有这个，点击在视觉上几乎没有反馈
    el.classList.add('is-lifted')
    window.clearTimeout(el._liftTimer)
    el._liftTimer = window.setTimeout(() => el.classList.remove('is-lifted'), 700)
  }

  const rand = (a, b) => a + Math.random() * (b - a)
  const sign = () => (Math.random() < 0.5 ? -1 : 1)

  // 点击：只拨动被点的这一张，别的一概不动
  const jostle = (item) => {
    if (isMobile.value) return
    const base = anchors.value[item.id]
    if (!base) return

    const rotate = +(base.rotate + sign() * rand(2.2, 4)).toFixed(2)
    const pos = clampPos(base.left + sign() * rand(6, 16), base.top + sign() * rand(5, 13), rotate)

    layout.value = { ...layout.value, [item.id]: { ...pos, rotate } }
  }

  const onCardDown = (item) => {
    raise(item)
    jostle(item)
  }

  // 拖拽（仅桌面）
  let dragState = null
  let pendingDrag = null

  const startDrag = (e, item) => {
    if (isMobile.value) return
    if (!layout.value[item.id]) return
    e.preventDefault()
    // 按下时卡片可能刚被 jostle 拨了一下，所以这里只记指针位置；
    // 等真的超过阈值要拖动时再取当前位置当起点，避免"抢跑"跳动
    pendingDrag = { id: item.id, x: e.clientX, y: e.clientY }
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', endDrag)
  }

  const onDragMove = (e) => {
    if (!pendingDrag) return

    // 没超过阈值就当点击，避免"点一下漂 1px"
    if (!dragState) {
      const dx = e.clientX - pendingDrag.x
      const dy = e.clientY - pendingDrag.y
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return

      const cur = layout.value[pendingDrag.id]
      if (!cur) return
      dragState = {
        id: pendingDrag.id,
        startX: e.clientX,
        startY: e.clientY,
        left: cur.left,
        top: cur.top,
        rotate: cur.rotate
      }
      draggingId.value = pendingDrag.id
      return
    }

    // 拖到边上就停住，卡片不会被拖出画布
    const pos = clampPos(
      dragState.left + (e.clientX - dragState.startX),
      dragState.top + (e.clientY - dragState.startY),
      dragState.rotate
    )
    layout.value = {
      ...layout.value,
      [dragState.id]: { ...pos, rotate: dragState.rotate }
    }
  }

  const endDrag = () => {
    if (dragState) {
      const id = dragState.id
      // 松手时先把抬起放大的状态撤掉，免得量到 1.06 倍的包围盒
      const card = document.getElementById('wish-' + id)
      if (card) card.classList.remove('is-lifted')

      const pos = layout.value[id]
      if (pos) {
        const settled = { ...pos, ...clampPos(pos.left, pos.top, pos.rotate) }
        layout.value = { ...layout.value, [id]: settled }
        anchors.value = { ...anchors.value, [id]: { ...settled } }
      }
      // 再用真实四边校一次（旋转后的包围盒 clampPos 只是估算）
      requestAnimationFrame(() => settleAll())
    }
    dragState = null
    pendingDrag = null
    draggingId.value = null
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', endDrag)
  }

  // 供组件卸载时收尾：拖拽期间挂在 window 上的监听要一起摘掉，
  // 否则组件销毁后鼠标一动还会去改已经不存在的布局
  const stopDrag = () => {
    dragState = null
    pendingDrag = null
    draggingId.value = null
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', endDrag)
  }

  return {
    boardRef,
    items,
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
    // 数据
    load,
    submit,
    toggleType,
    // 布局
    checkMobile,
    measureCards,
    relayout,
    settleAll,
    // 交互
    onCardDown,
    startDrag,
    stopDrag
  }
}
