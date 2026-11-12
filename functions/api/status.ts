// 站点状态接口
//
// 两条数据路径，优先直连 UptimeRobot，未配置或失败时回落到自建状态页：
//
//   1) UptimeRobot 官方 API —— 需要 env.UPTIMEROBOT_API_KEY（只读 key 足够）。
//      最稳，不依赖状态页那边的鉴权约定。
//   2) status.lovlin.cn（imsyy/site-status）的汇总接口 —— 不需要任何密钥，
//      但它校验来源，服务端调用得带上它自己的 Referer/Origin，属于"蹭"它的约定。
//
// 前端只认 { status, label, updatedAt } 三个字段，两条路径的输出完全一致。

type StatusType = 'operational' | 'degraded' | 'partial' | 'major' | 'maintenance'

const STATUS_MAP: Record<StatusType, { status: string; label: string }> = {
  operational: { status: 'operational', label: '服务正常' },
  degraded: { status: 'degraded', label: '性能下降' },
  partial: { status: 'partial', label: '部分问题' },
  major: { status: 'major', label: '重大事故' },
  maintenance: { status: 'maintenance', label: '正在检修' }
}

const UPTIMEROBOT_ENDPOINT = 'https://api.uptimerobot.com/v2/getMonitors'
const STATUS_PAGE_ENDPOINT = 'https://status.lovlin.cn/api/getMonitors'
const STATUS_PAGE_ORIGIN = 'https://status.lovlin.cn'

// 状态页在 Vercel 上，机房出口 IP 容易被它的防火墙判成机器人直接拒掉，
// 带个普通浏览器 UA 更稳（Worker 发出的请求默认 UA 是 Cloudflare-Workers）
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const errText = (error: unknown) => (error instanceof Error ? error.message : String(error))

const responseHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 's-maxage=60, stale-while-revalidate=30'
}

interface MonitorSummary {
  count?: number
  ok?: number
  error?: number
  unknown?: number
}

interface StatusPagePayload {
  code?: number
  message?: string
  data?: { status?: MonitorSummary }
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

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: responseHeaders })

// 汇总结果转成徽标文案：
//   error === 0       → 全部正常
//   error 超过一半     → 重大事故
//   其余（有异常但不到一半）→ 部分问题
const summarize = ({ count = 0, error = 0 }: MonitorSummary): { status: string; label: string } => {
  if (count === 0) return { status: 'unknown', label: '无监控项' }
  if (error === 0) return STATUS_MAP.operational
  if (error > count / 2) return STATUS_MAP.major
  return STATUS_MAP.partial
}

// ===== 路径一：UptimeRobot 官方 API =====
// v2 每页最多 50 条，用 offset 翻页，最多翻 4 页（200 个监控）足够覆盖个人站点
const fromUptimeRobot = async (apiKey: string): Promise<MonitorSummary> => {
  const monitors: UptimeRobotMonitor[] = []

  for (let page = 0; page < 4; page++) {
    const body = new URLSearchParams({
      api_key: apiKey,
      format: 'json',
      offset: String(monitors.length),
      limit: '50',
      // 只要能判断上下线，历史日志/响应时间都不需要，避免响应过大
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
    // UptimeRobot 出错时仍然返回 HTTP 200，只能看 stat 字段
    if (payload.stat !== 'ok' || !Array.isArray(payload.monitors)) {
      throw new Error(`uptimerobot: ${payload.error?.message || 'unknown error'}`)
    }

    monitors.push(...payload.monitors)

    const total = payload.pagination?.total ?? monitors.length
    if (monitors.length >= total || payload.monitors.length === 0) break
  }

  const count = monitors.length
  const error = monitors.filter((m) => m.status === 8 || m.status === 9).length
  return { count, ok: count - error, error, unknown: 0 }
}

// ===== 路径二：自建状态页（无需密钥）=====
const fromStatusPage = async (): Promise<MonitorSummary> => {
  const response = await fetch(STATUS_PAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      Origin: STATUS_PAGE_ORIGIN,
      Referer: `${STATUS_PAGE_ORIGIN}/`,
      'Content-Type': 'application/json',
      'User-Agent': BROWSER_UA,
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(6000)
  })

  if (!response.ok) throw new Error(`status page http ${response.status}`)

  const payload = (await response.json()) as StatusPagePayload
  if (payload.code !== 200 || !payload.data?.status) {
    throw new Error(`status page: ${payload.message || 'no status'}`)
  }

  return payload.data.status
}

export async function onRequestGet(context: any) {
  const apiKey: string | undefined = context?.env?.UPTIMEROBOT_API_KEY
  // 两条路都失败时把原因带回去，线上排查不用翻日志
  const reasons: string[] = []

  // 配了 key 就直连；直连失败再退回状态页，不让徽标直接掉成错误态
  if (apiKey) {
    try {
      const info = summarize(await fromUptimeRobot(apiKey))
      return json({ ...info, updatedAt: new Date().toISOString() })
    } catch (error) {
      console.error('UptimeRobot failed, falling back to status page:', error)
      reasons.push(`uptimerobot: ${errText(error)}`)
    }
  }

  try {
    const info = summarize(await fromStatusPage())
    return json({ ...info, updatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Fetch status failed:', error)
    reasons.push(`status-page: ${errText(error)}`)
    return json({
      status: 'error',
      label: '无法获取状态',
      updatedAt: null,
      // 只有排查时才需要，前端不读这个字段
      detail: reasons.join(' | ')
    })
  }
}
