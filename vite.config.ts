import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'

type ApiHandler = (request: Request) => Promise<Response>

/**
 * 로컬 개발(npm run dev)에서 /api/chat 요청을 api/chat.ts 서버 함수로 연결한다.
 * Vercel 배포 시에는 Vercel이 api/ 폴더를 서버 함수로 직접 실행하므로 이 플러그인은 사용되지 않는다.
 */
function localApiPlugin(): Plugin {
  async function readBody(req: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks)
  }

  async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
    try {
      const mod = (await server.ssrLoadModule('/api/chat.ts')) as Record<string, unknown>
      const handler = mod[req.method ?? 'GET'] as ApiHandler | undefined
      if (typeof handler !== 'function') {
        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'Method Not Allowed' }))
        return
      }

      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(key, value)
        else if (Array.isArray(value)) headers.set(key, value.join(', '))
      }
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
      const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
        method: req.method,
        headers,
        body: hasBody ? new Uint8Array(await readBody(req)) : undefined,
      })

      const response = await handler(request)
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (error) {
      server.config.logger.error(`[api] ${String(error)}`)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Local API error' }))
    }
  }

  return {
    name: 'local-vercel-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (path !== '/api/chat') return next()
        void handle(server, req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env.local 등의 값을 서버 측 process.env에만 주입 (VITE_ 접두사가 없으므로 클라이언트 번들에는 포함되지 않음)
  const env = loadEnv(mode, process.cwd(), '')
  if (env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
  }

  return {
    plugins: [react(), localApiPlugin()],
  }
})
