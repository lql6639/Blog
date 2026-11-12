// Cloudflare Workers 入口。
//
// 站点是 VitePress 产出的纯静态文件，全部挂在 assets 绑定（env.ASSETS）上；
// 唯一需要服务端能力的是 /api/status（代理 Better Stack，避免 Token 落到浏览器）。
// 之前用 Cloudflare **Pages** 部署时，functions/api/status.ts 会被自动映射成
// GET /api/status；改成 Workers 静态资源模式后这层约定失效，接口直接 404，
// 页面底部的状态徽标就一直是错误态。所以在 Worker 里补上这条分流。
//
// 分流顺序：pathname 前缀优先于静态资源。
// 好处是 /api/* 永远不会落到静态资源去"碰运气"，未实现的接口能明确返回 JSON 404，
// 前端可以直接区分"接口不存在"和"静态页面不存在"。
import { onRequestGet as handleStatus } from '../functions/api/status'

interface Env {
  // assets 绑定的名称由 wrangler.jsonc 的 assets.binding 决定，默认 ASSETS
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  BETTER_STACK_API_TOKEN?: string
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/status') {
        if (request.method !== 'GET') {
          return json({ error: 'Method Not Allowed' }, 405, { Allow: 'GET' })
        }
        // 复用 Pages Functions 里已有的实现（context 只用到 request 与 env）
        return handleStatus({ request, env })
      }

      // /api/ 下没有对应实现：明确返回 JSON，而不是静态资源的 404 页面
      return json({ error: 'Not Found', path: pathname }, 404)
    }

    return env.ASSETS.fetch(request)
  }
}
