/**
 * 极简 throttle，替代 lodash-es（避免为单个函数引入整个库）。
 * 语义对齐 lodash 的 throttle：
 * - options.leading（默认 true）：首次调用立即执行
 * - options.trailing（默认 true）：节流周期结束后再补一次尾随调用
 */
export const throttle = (fn, wait = 300, options = {}) => {
  const { leading = true, trailing = true } = options
  let last = 0
  let timer = null
  let lastArgs = null

  const invoke = (time, args) => {
    last = time
    fn.apply(this, args)
  }

  return function (...args) {
    const now = Date.now()
    const remaining = wait - (now - last)

    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (leading) {
        invoke(now, args)
      } else {
        last = now
      }
    } else if (trailing) {
      // 记录最新参数，等待尾随调用
      lastArgs = args
      if (!timer) {
        timer = setTimeout(() => {
          timer = null
          const t = Date.now()
          last = leading ? t : 0
          if (lastArgs) {
            const a = lastArgs
            lastArgs = null
            fn.apply(this, a)
          }
        }, remaining)
      }
    }
  }
}
