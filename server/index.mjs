import { demoOnlyMode } from './demoMode.mjs'
import {durableAI,withAIQuota} from './aiQuota.mjs'
import { containsPersonalData, privateAIAllowed } from './aiPrivacy.mjs'
import { geminiConfig } from './geminiConfig.mjs'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { analyzeResume, ApiError, configuredIntegrations, createGmailDraft, draftMaterials, syncTracker } from './integrations.mjs'
import { authMode, authRequest, requireAccount, workspaceRequest } from './auth.mjs'
import { demoRequest } from './demo.mjs'
import { libraryRequest } from './library.mjs'
import { assistantRequest, claimAssistantUsage, clearAssistantUploads } from './assistant.mjs'
import { learningInput, runLearning } from './learning.mjs'

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
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.webmanifest': 'application/manifest+json',
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

async function parseBody(request, limit = maxBodyBytes) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw new ApiError(415, 'Send the request as application/json.')
  }
  if (Number(request.headers['content-length']) > limit) throw new ApiError(413, 'This request is too large.')
  if (request.body !== undefined) {
    const parsed = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ApiError(400, 'Send a valid JSON object.')
    if (Buffer.byteLength(JSON.stringify(parsed)) > limit) throw new ApiError(413, 'This request is too large.')
    return parsed
  }
  let size = 0
  const chunks = []
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > limit) throw new ApiError(413, 'This request is too large.')
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
  const file = resolve(dist, '.' + (path === '/' || /^\/(?:signup|login|forgot-password|reset-password|auth\/callback|onboarding|dashboard)$/.test(path) ? '/index.html' : path))
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

export function createRequestHandler({ env = process.env, hosted = false } = {}) {
  return async (request, response) => {
    const started=Date.now()
    response.once('finish',()=>{
      if(env.PATH4U_AI_MONITORING!=='true') return
      const route=new URL(request.url,'https://local.invalid')
      const name=route.pathname==='/api/index'?'/api/'+(route.searchParams.get('route')||''):route.pathname
      const known=new Set(['/api/demo/session','/api/demo/assistant','/api/demo/roadmap','/api/assistant','/api/learning/roadmap','/api/learning/assistant','/api/analyze','/api/draft'])
      if(known.has(name)) console.info(JSON.stringify({event:'ai_request',route:name,status:response.statusCode,durationMs:Date.now()-started}))
    })
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('referrer-policy', 'no-referrer')
    try {
      const host = request.headers.host ?? ''
      if (!hosted && !loopbackHost.test(host)) throw new ApiError(403, 'Path4U accepts requests addressed to this local server.')
      const demoHost = hosted && env.PATH4U_PUBLIC_DEMO === '1' &&
        [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL].includes(host) ? host : ''
      const previewHost=hosted && env.VERCEL_ENV==='preview' && env.VERCEL_URL===host ? host : ''
      const extraOrigins = (env.OPENPATH_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(value => { try { const parsed = new URL(value); return parsed.protocol === 'https:' && parsed.origin === value } catch { return false } })
      const approvedAlias = hosted && extraOrigins.includes('https://' + host) ? 'https://' + host : ''
      const origin = hosted ? approvedAlias || (previewHost && 'https://'+previewHost) || env.OPENPATH_ORIGIN || (demoHost && 'https://' + demoHost) : 'http://' + host
      if (!origin || (hosted && new URL(origin).protocol !== 'https:')) throw new ApiError(503, 'Configure the public HTTPS origin.')
      const url = new URL(request.url, origin)
      const pathname = hosted && url.pathname === '/api/index' ? '/api/' + (url.searchParams.get('route') ?? '') : url.pathname
      if (!pathname.startsWith('/api/')) {
        await serveFile(pathname, request, response)
        return
      }
      const post = request.method === 'POST'
      if (post && request.headers.origin !== origin) throw new ApiError(403, 'Use the app from its configured origin.')
      if (pathname === '/api/app-config' && request.method === 'GET') {
        send(response, 200, { demoOnly: demoOnlyMode(env) })
        return
      }
      if (pathname.startsWith('/api/auth/')) {
        const action = pathname.slice('/api/auth/'.length)
        if (demoOnlyMode(env) && !['session', 'logout'].includes(action)) throw new ApiError(403, 'Account registration and sign-in are not available in this demo version.')
        if ((action === 'session' && request.method !== 'GET') || (action !== 'session' && !post)) throw new ApiError(405, 'Method not allowed.')
        send(response, 200, await authRequest(action, post ? await parseBody(request) : {}, request, response, env, origin))
        return
      }
      if (pathname.startsWith('/api/demo/')) {
        if (!post) throw new ApiError(405, 'Method not allowed.')
        send(response, 200, await demoRequest(pathname.slice('/api/demo/'.length), await parseBody(request), request, response, env, origin, hosted))
        return
      }
      if (pathname === '/api/library' && (post || request.method === 'GET')) {
        const input = post ? await parseBody(request, 110_000) : undefined
        send(response, 200, await libraryRequest(request, env, input?.kind ?? url.searchParams.get('kind'), input))
        return
      }
      if (post && pathname === '/api/assistant/clear-uploads') {
        send(response, 200, await clearAssistantUploads(request, env))
        return
      }
      if (post && pathname === '/api/assistant') {
        const account = await requireAccount(request, env)
        send(response, 200, await assistantRequest(await parseBody(request, 3_440_000), response, env, account))
        return
      }
      if (post && pathname.startsWith('/api/learning/')) {
        const account = await requireAccount(request, env)
        const action = pathname.slice('/api/learning/'.length)
        const input = await parseBody(request)
        const data = learningInput(action, input)
        if(input.useGemini === true && containsPersonalData(data)) throw new ApiError(403,'Use only non-sensitive learning goals. Personal resume details stay in local Resume Studio.')
        if(input.useGemini===true && durableAI(env)){
          send(response,200,await withAIQuota(env,{subject:'account:'+account.user.id,requestId:input.requestId,input:{action,...data},kind:action==='roadmap'?'roadmap':'chat'},()=>runLearning(action,data,env,true,AbortSignal.timeout(105000))))
        }else{
          if(input.useGemini===true)await claimAssistantUsage(env,account)
          send(response,200,await runLearning(action,data,env,input.useGemini===true,AbortSignal.timeout(105000)))
        }
        return
      }
      if (request.method === 'GET' && pathname === '/api/news') {
        const { getDeveloperNews } = await import('./news.mjs')
        try { send(response, 200, await getDeveloperNews()) }
        catch { throw new ApiError(502, 'The news source is unavailable.') }
        return
      }
      if (request.method === 'GET' && pathname === '/api/status') {
        const { approvedFeedConfigured } = await import('./feed.mjs')
        let person = null
        if (!demoOnlyMode(env) && authMode(env) === 'live') {
          try { person = await requireAccount(request, env) }
          catch (error) { if (![401, 403].includes(error.status)) throw error }
        }
        const providers = person ? configuredIntegrations(env) : { gemini: false, image: false, sheets: false, gmail: false }
        const ownsIntegrations = person?.user.id && person.user.id === env.OPENPATH_INTEGRATION_OWNER_ID
        send(response, 200, { demoOnly: demoOnlyMode(env), ...providers, temporaryStorageExpires: env.PATH4U_DATA_BACKEND==='redis'?env.PATH4U_TEMPORARY_STORAGE_EXPIRES:undefined, privateAI: person ? geminiConfig(env).privateAI : false, ...(!ownsIntegrations ? { gmail: false, sheets: false } : {}), feed: approvedFeedConfigured(env) })
        return
      }
      if (request.method === 'GET' && pathname === '/api/opportunities') {
        const { getOpportunityCatalog } = await import('./feed.mjs')
        send(response, 200, await getOpportunityCatalog(env))
        return
      }
      const mode = authMode(env)
      if (mode === 'unavailable') throw new ApiError(503, 'Configure the Path4U account service.')
      if (pathname === '/api/workspace') {
        if (mode !== 'live') throw new ApiError(503, 'No database workspace is configured.')
        if (!post && request.method !== 'GET') throw new ApiError(405, 'Method not allowed.')
        send(response, 200, await workspaceRequest(request, env, post ? await parseBody(request) : undefined))
        return
      }
      const handler = postRoutes.get(pathname)
      if (handler && post) {
        if (mode !== 'live') throw new ApiError(403, 'Connected services require an account.')
        const account = await requireAccount(request, env)
        const { user } = account
        if (['/api/tracker', '/api/gmail-draft'].includes(pathname) && user.id !== env.OPENPATH_INTEGRATION_OWNER_ID) {
          throw new ApiError(403, 'This integration is restricted to its connected account owner.')
        }
        const input = await parseBody(request)
        if (['/api/analyze', '/api/draft'].includes(pathname)) {
          if(!privateAIAllowed(env,input.privateDataConsent)) throw new ApiError(403,'Private Gemini processing is disabled; use the local tools.')
          if (!configuredIntegrations(env).gemini) throw new ApiError(503, 'Gemini is unavailable on this deployment.')
          await claimAssistantUsage(env, account)
        }
        send(response, 200, await handler(input, env))
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
      if (error instanceof ApiError) {
        const failedUrl = new URL(request.url, 'https://local.invalid')
        const failedPath = failedUrl.pathname === '/api/index' ? '/api/' + (failedUrl.searchParams.get('route') ?? '') : failedUrl.pathname
        const authRoute = /^\/api\/auth\/[a-z]+$/.test(failedPath)
        const code = /^[a-z_]{1,60}$/.test(error.code ?? '') ? error.code : undefined
        if (authRoute && env.PATH4U_AUTH_MONITORING === 'true') console.info(JSON.stringify({ event: 'auth_error', action: failedPath.split('/').at(-1), status: error.status, code: code ?? 'request_failed' }))
        if (error.status === 429) response.setHeader('Retry-After', error.retryAfter ?? 60)
        send(response, error.status, { error: error.message, ...(code ? { code } : {}), ...(error.status === 429 ? { retryAfter: error.retryAfter ?? 60 } : {}), ...(typeof error.resetAt==='string' && Number.isFinite(Date.parse(error.resetAt)) ? {resetAt:error.resetAt} : {}) }, request.method === 'HEAD')
      }
      else send(response, 500, { error: 'The server could not complete the request.' }, request.method === 'HEAD')
    }
  }
}

export function createOpenPathServer(options) {
  return createServer({ requestTimeout: 30_000, headersTimeout: 10_000 }, createRequestHandler(options))
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const port = Number(process.env.PORT ?? 4173)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be between 1 and 65535.')
  createOpenPathServer().listen(port, '127.0.0.1', () => {
    console.log('Path4U listening at http://127.0.0.1:' + port)
  })
}
