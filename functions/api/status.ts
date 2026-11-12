// 站点状态接口
//
// 数据来自 UptimeRobot 官方 API（只读 key 即可），需要 env.UPTIMEROBOT_API_KEY。
//
// 曾经想过"没配 key 就读自建状态页 status.lovlin.cn"作为兜底，但实测不可行：
// 状态页和本站同属 lovlin.cn 这个 zone，Worker 去 fetch 自己 zone 下的域名会被
// Cloudflare 拦掉，返回 `error code: 1053`（同域子请求不允许），本地 dev 能通、
// 线上必挂。所以这里只保留一条路径，没配 key 就老实报「未配置状态」。

type StatusType = 'operational' | 'degraded' | 'partial' | 'major' | 'maintenance'

const STATUS_MAP: Record<StatusType, { status: string; label: string }> = {
  operational: { status: 'operational', label: '服务正常' },
  degraded: { status: 'degraded', label: '性能下降' },
  partial: { status: 'partial', label: '部分问题' },
  major: { status: 'major', label: '重大事故' },
  maintenance: { status: 'maintenance', label: '正在检修' }
}

const UPTIMEROBOT_ENDPOINT = 'https://api.uptimerobot.com/v2/getMonitors'

// Worker 发出的请求默认 UA 是 Cloudflare-Workers，带上浏览器 UA 更不容易被挡
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const responseHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 's-maxage=60, stale-while-revalidate=30'
}

// v2 每页最多 50 条，用 offset 翻页
const PAGE_SIZE = 50
const MAX_PAGES = 4

interface MonitorSummary {
  count: number
  ok: number
  error: number
}

interface UptimeRobotMonitor {
  // 0 暂停 / 1 尚未检查 / 2 正常 / 8 疑似故障 / 9 故障
  status?: number
}

interface UptimeRobotPayload {
  stat?: string
  error?: { type?: string; message?: string }
  pagination?: { total?: number }
  monitors?: UptimeRobotMonitor[]
}

const errText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: responseHeaders })

// 汇总结果转成徽标文案：
//   error === 0       → 全部正常
//   error 超过一半     → 重大事故
//   其余（有异常但不到一半）→ 部分问题
const summarize = ({ count, error }: MonitorSummary): { status: string; label: string } => {
  if (count === 0) return { status: 'unknown', label: '无监控项' }
  if (error === 0) return STATUS_MAP.operational
  if (error > count / 2) return STATUS_MAP.major
  return STATUS_MAP.partial
}

const fetchMonitors = async (apiKey: string): Promise<MonitorSummary> => {
  const monitors: UptimeRobotMonitor[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = new URLSearchParams({
      api_key: apiKey,
      format: 'json',
      offset: String(monitors.length),
      limit: String(PAGE_SIZE),
      // 只需要判断上下线，历史日志/响应时间都不要，避免响应过大
      logs: '0',
      response_times: '0',
      all_time_uptime_ratio: '0'
    })

    const response = await fetch(UPTIMEROBOT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': BROWSER_UA,
        Accept: 'application/json'
      },
      body,
      signal: AbortSignal.timeout(6000)
    })

    if (!response.ok) throw new Error(`uptimerobot http ${response.status}`)

    const payload = (await response.json()) as UptimeRobotPayload
    // UptimeRobot 出错时也返回 HTTP 200，只能看 stat 字段
    if (payload.stat !== 'ok' || !Array.isArray(payload.monitors)) {
      throw new Error(`uptimerobot: ${payload.error?.message || 'unknown error'}`)
    }

    monitors.push(...payload.monitors)

    const total = payload.pagination?.total ?? monitors.length
    if (monitors.length >= total || payload.monitors.length === 0) break
  }

  const count = monitors.length
  const error = monitors.filter((m) => m.status === 8 || m.status === 9).length
  return { count, ok: count - error, error }
}

export async function onRequestGet(context: any) {
  const apiKey: string | undefined = context?.env?.UPTIMEROBOT_API_KEY
  const updatedAt = new Date().toISOString()

  if (!apiKey) {
    return json({ status: 'unknown', label: '未配置状态', updatedAt: null })
  }

  try {
    const info = summarize(await fetchMonitors(apiKey))
    return json({ ...info, updatedAt })
  } catch (error) {
    console.error('Fetch UptimeRobot status failed:', error)
    return json({
      status: 'error',
      label: '无法获取状态',
      updatedAt: null,
      // 前端不读这个字段，留给人工排查
      detail: errText(error)
    })
  }
}
