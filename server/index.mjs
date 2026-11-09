import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { analyzeResume, ApiError, configuredIntegrations, createGmailDraft, draftMaterials, syncTracker } from './integrations.mjs'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const maxBodyBytes = 100_000
const loopbackHost = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/i
const postRoutes = new Map([
  ['/api/analyze', analyzeResume],
  ['/api/draft', draftMaterials],
  ['/api/tracker', syncTracker],
  ['/api/gmail-draft', createGmailDraft],
])
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
}

function send(response, status, payload, head = false) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  response.end(head ? undefined : body)
}

async function parseBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw new ApiError(415, 'Send the request as application/json.')
  }
  if (Number(request.headers['content-length']) > maxBodyBytes) throw new ApiError(413, 'This request is too large.')
  let size = 0
  const chunks = []
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > maxBodyBytes) throw new ApiError(413, 'This request is too large.')
    chunks.push(chunk)
  }
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Expected an object')
    return input
  } catch {
    throw new ApiError(400, 'Send a valid JSON object.')
  }
}

async function serveFile(pathname, request, response) {
  const head = request.method === 'HEAD'
  if (request.method !== 'GET' && !head) {
    response.setHeader('allow', 'GET, HEAD')
    throw new ApiError(405, 'Method not allowed.')
  }
  let path
  try {
    path = decodeURIComponent(pathname)
  } catch {
    throw new ApiError(400, 'Invalid path.')
  }
  if (/[\x00\\]/.test(path) || path.includes(':')) throw new ApiError(400, 'Invalid path.')
  const file = resolve(dist, '.' + (path === '/' ? '/index.html' : path))
  if (!file.startsWith(dist + sep)) throw new ApiError(404, 'Page or asset not found.')
  let body
  try {
    body = await readFile(file)
  } catch (error) {
    if (error.code === 'ENOENT' && path === '/') throw new ApiError(503, 'Build the frontend with pnpm build before starting the server.')
    if (['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) throw new ApiError(404, 'Page or asset not found.')
    throw error
  }
  response.writeHead(200, {
    'content-type': contentTypes[extname(file)] ?? 'application/octet-stream',
    'content-length': body.byteLength,
    'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  response.end(head ? undefined : body)
}

export function createOpenPathServer({ env = process.env } = {}) {
  return createServer({ requestTimeout: 30_000, headersTimeout: 10_000 }, async (request, response) => {
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('referrer-policy', 'no-referrer')
    try {
      const host = request.headers.host ?? ''
      if (!loopbackHost.test(host)) throw new ApiError(403, 'OpenPath accepts requests addressed to this local server.')
      const origin = 'http://' + host
      const { pathname } = new URL(request.url, origin)
      if (!pathname.startsWith('/api/')) {
        await serveFile(pathname, request, response)
        return
      }
      if (request.method === 'GET' && pathname === '/api/status') {
        const { approvedFeedConfigured } = await import('./feed.mjs')
        send(response, 200, { ...configuredIntegrations(env), feed: approvedFeedConfigured(env) })
        return
      }
      if (request.method === 'GET' && pathname === '/api/opportunities') {
        const { getApprovedFeed } = await import('./feed.mjs')
        send(response, 200, { opportunities: await getApprovedFeed(env) })
        return
      }
      const handler = postRoutes.get(pathname)
      if (handler && request.method === 'POST') {
        if (request.headers.origin !== origin) throw new ApiError(403, 'Open this app on the local server to use integrations.')
        send(response, 200, await handler(await parseBody(request), env))
        return
      }
      if (handler || pathname === '/api/status' || pathname === '/api/opportunities') {
        response.setHeader('allow', handler ? 'POST' : 'GET')
        throw new ApiError(405, 'Method not allowed.')
      }
      throw new ApiError(404, 'API route not found.')
    } catch (error) {
      if (response.destroyed) return
      if (response.headersSent) {
        response.end()
        return
      }
      request.resume()
      if (error instanceof ApiError) send(response, error.status, { error: error.message }, request.method === 'HEAD')
      else send(response, 500, { error: 'The local server could not complete the request.' }, request.method === 'HEAD')
    }
  })
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const port = Number(process.env.PORT ?? 4173)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be between 1 and 65535.')
  createOpenPathServer().listen(port, '127.0.0.1', () => {
    console.log('OpenPath AI listening at http://127.0.0.1:' + port)
  })
}
