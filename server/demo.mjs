import {durableDemoRequest} from './durableDemo.mjs'
import {liveDemoRequest} from './liveDemo.mjs'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { ApiError } from './integrations.mjs'
import { learningInput, runLearning } from './learning.mjs'
import { demoCosts } from '../shared/learning.mjs'

const day = 86_400_000
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const localSessions = new Map()
const cookieKey = 'path4u_guest'

function cookie(request) {
  const value = (request.headers.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(cookieKey + '='))?.slice(cookieKey.length + 1)
  return uuid.test(value ?? '') ? value : null
}

async function database(env, name, args) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!env.SUPABASE_URL || !key) throw new ApiError(503, 'Demo credits are not configured on this deployment.')
  let result
  try {
    const response = await fetch(new URL('/rest/v1/rpc/path4u_demo_' + name, env.SUPABASE_URL), {
      method: 'POST', headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(8000),
    })
    if (response.ok) result = await response.json()
  } catch {
    throw new ApiError(503, 'The demo credit service could not be reached.')
  }
  if (!Number.isInteger(result)) throw new ApiError(503, 'The demo credit service is unavailable.')
  return result
}

function localSession(id, bucket) {
  const now = Date.now()
  for (const [key, entry] of localSessions) if (entry.expires <= now) localSessions.delete(key)
  const current = localSessions.get(id)
  if (current) return current.credits
  if (localSessions.size >= 1000 || [...localSessions.values()].filter(entry => entry.bucket === bucket).length >= 4) return -1
  localSessions.set(id, { bucket, credits: 20, requests: new Map(), expires: now + day })
  return 20
}

function localCharge(id, request, fingerprint, cost) {
  const current = localSessions.get(id)
  if (!current || current.expires <= Date.now()) return -3
  if (current.requests.has(request)) return current.requests.get(request) === fingerprint ? current.credits : -2
  if (current.credits < cost) return -1
  current.requests.set(request, fingerprint)
  current.credits -= cost
  return current.credits
}

export async function demoRequest(path, input, request, response, env, origin, hosted) {
  if(env.PATH4U_DATA_BACKEND==='supabase' && hosted && (env.PATH4U_PUBLIC_DEMO==='1' || env.PATH4U_DEMO_BACKEND==='supabase'))return durableDemoRequest(path,input,request,response,env,origin,hosted)
  if(env.PATH4U_DEMO_BACKEND==='redis' || (hosted && env.PATH4U_PUBLIC_DEMO==='1' && env.GEMINI_API_KEY)) return liveDemoRequest(path,input,request,response,env,origin,hosted)
  if (hosted && env.PATH4U_PUBLIC_DEMO === '1' && !env.SUPABASE_URL && !env.SUPABASE_SERVICE_ROLE_KEY) {
    if (path === 'session') return { credits: null }
    return { result: await runLearning(path, learningInput(path, input), env), credits: null }
  }
  const supplied = cookie(request)
  if (path === 'session') {
    const id = supplied ?? randomUUID()
    const address = ((hosted ? request.headers['x-vercel-forwarded-for'] : request.socket?.remoteAddress) ?? '').split(',')[0]
    const bucket = createHmac('sha256', env.SUPABASE_SERVICE_ROLE_KEY || 'loopback-demo').update(address).digest('hex')
    const credits = hosted ? await database(env, 'session', { p_session: id, p_bucket: bucket }) : localSession(id, bucket)
    if (credits < 0) throw new ApiError(429, 'The demo session limit was reached. Try again tomorrow.')
    if (!supplied) response.setHeader('Set-Cookie', cookieKey + '=' + id + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400' + (origin.startsWith('https:') ? '; Secure' : ''))
    return { credits }
  }
  if (!supplied) throw new ApiError(401, 'Start a demo session first.')
  if (!uuid.test(input.requestId ?? '')) throw new ApiError(400, 'This demo request needs a valid request ID.')
  const data = learningInput(path, input)
  const result = await runLearning(path, data, env)
  const fingerprint = createHash('sha256').update(JSON.stringify([path, data])).digest('hex')
  const cost = demoCosts[path]
  const credits = hosted
    ? await database(env, 'charge', { p_session: supplied, p_request: input.requestId, p_fingerprint: fingerprint, p_cost: cost })
    : localCharge(supplied, input.requestId, fingerprint, cost)
  if (credits === -3) throw new ApiError(401, 'Your demo session expired. Reload to start again.')
  if (credits === -2) throw new ApiError(409, 'This request ID was already used with different inputs.')
  if (credits < 0) throw new ApiError(402, 'You’re out of demo credits for this action. Browse for free or create an account.')
  return { result, credits }
}
