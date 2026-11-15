let mainCursor

const lerp = (a, b, n) => {
  if (Math.round(a) === b) {
    return b
  }
  return (1 - n) * a + n * b
}

const cursorInit = () => {
  // 确保只在客户端初始化光标
  if (typeof window !== 'undefined') {
    mainCursor = new Cursor()
    return mainCursor
  }
  return null // 在非浏览器环境下返回 null
}

class Cursor {
  constructor() {
    this.pos = {
      curr: null,
      prev: null
    }
    this.currentThemeType = 'auto'

    // 所有 DOM 操作和事件绑定都在 create/init 中处理，这些方法会包含环境检查
    this.create()
    this.init()
    this.render()
  }

  move(left, top) {
    if (this.cursor) {
      // 确保 this.cursor 存在
      this.cursor.style['left'] = `${left}px`
      this.cursor.style['top'] = `${top}px`
    }
  }

  create() {
    // 确保只在客户端创建 DOM 元素
    if (typeof document === 'undefined') return

    if (!this.cursor) {
      this.cursor = document.createElement('div')
      this.cursor.id = 'cursor'
      this.cursor.classList.add('xs-hidden')
      this.cursor.classList.add('hidden')
      document.body.append(this.cursor)
    }

    const isMobile = /Mobi|Android/i.test(navigator.userAgent)

    if (isMobile) {
      this.cursor.classList.add('hidden')
      if (this.scr) {
        this.scr.remove()
      }
      document.body.style.cursor = 'auto'
      return
    }

    // 不再全量遍历 DOM + getComputedStyle（会触发强制重排，是页面卡顿主因）。
    // 是否显示 pointer 光标改为在 mousemove 时用事件委托按需判断（见 init）。
    if (!this.scr) {
      document.body.appendChild((this.scr = document.createElement('style')))
    }
  }

  updateCursorStyle(themeType) {
    if (typeof window === 'undefined' || !this.scr) return // 确保在客户端且 style 标签已创建

    let cursorColor
    if (themeType === 'auto') {
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
      cursorColor = prefersDarkMode ? 'white' : 'black'
    } else {
      cursorColor = themeType === 'dark' ? 'white' : 'black'
    }
    this.scr.innerHTML = `* {cursor: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' width='10px' height='10px'><circle cx='4' cy='4' r='4' fill='${cursorColor}' /></svg>") 4 4, auto !important}`
  }

  setThemeType(newThemeType) {
    this.currentThemeType = newThemeType
    if (
      typeof window !== 'undefined' &&
      this.cursor &&
      !/Mobi|Android/i.test(navigator.userAgent)
    ) {
      this.updateCursorStyle(newThemeType)
    }
  }

  refresh() {
    if (typeof document === 'undefined') return // 确保在客户端

    // 移动端在 init() 里会提前 return，this.scr 可能尚未创建；
    // 桌面端则必须先置空，否则 create() 里的 `if (!this.scr)` 为假，
    // 被 remove() 掉的 <style> 不会重新挂回，自定义光标样式永久失效。
    this.scr?.remove()
    this.scr = null
    this.cursor?.classList.remove('active')
    this.pos = {
      curr: null,
      prev: null
    }

    this.create()
    this.init()
    this.render()
  }

  init() {
    if (typeof document === 'undefined') return // 确保在客户端

    const isMobile = /Mobi|Android/i.test(navigator.userAgent)
    if (isMobile) {
      return
    }

    document.onmousemove = (e) => {
      this.pos.curr == null && this.move(e.clientX - 8, e.clientY - 8)
      this.pos.curr = {
        x: e.clientX - 8,
        y: e.clientY - 8
      }
      // 事件委托：仅判断当前 hover 的元素是否 pointer 光标（零全量遍历/重排）
      this.toggleCursorForTarget(e.target)
      this.cursor.classList.remove('hidden')
      this.render()
    }
    document.onmouseenter = () => this.cursor.classList.remove('hidden')
    document.onmouseleave = () => this.cursor.classList.add('hidden')
    document.onmousedown = () => this.cursor.classList.add('active')
    document.onmouseup = () => this.cursor.classList.remove('active')
  }

  // 按需判断 hover 元素是否可点击：是则隐藏自定义光标、还原系统 pointer；
  // 否则显示自定义光标。仅对单个元素取 getComputedStyle，开销可忽略。
  toggleCursorForTarget(target) {
    if (!this.cursor || !(target instanceof Element)) return
    let cursorStyle = 'default'
    try {
      cursorStyle = window.getComputedStyle(target).cursor
    } catch {
      /* 忽略 */
    }
    const isPointer = cursorStyle === 'pointer'
    this.cursor.style.display = isPointer ? 'none' : 'block'
  }

  render() {
    if (typeof document === 'undefined') return // 确保在客户端

    const isMobile = /Mobi|Android/i.test(navigator.userAgent)
    if (isMobile) {
      return
    }

    // 尚未有鼠标位置（constructor 首次调用 / 移动端），不做插值
    if (!this.pos.curr) return

    if (this.pos.prev) {
      this.pos.prev.x = lerp(this.pos.prev.x, this.pos.curr.x, 0.35)
      this.pos.prev.y = lerp(this.pos.prev.y, this.pos.curr.y, 0.35)
      this.move(this.pos.prev.x, this.pos.prev.y)
    } else {
      this.pos.prev = this.pos.curr
    }
    // 用坐标差值判断是否还需继续插值，避免 lodash isEqual 的深比较开销
    const dx = this.pos.curr.x - this.pos.prev.x
    const dy = this.pos.curr.y - this.pos.prev.y
    if (dx * dx + dy * dy > 0.05) {
      requestAnimationFrame(() => this.render())
    }
  }
}

export default cursorInit
