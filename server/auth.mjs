import {redisDataRequest} from './redisData.mjs'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { AGE_POLICY_VERSION, birthdayCutoff, ageEligibility, passwordAcceptable } from '../shared/age.mjs'
import { ApiError } from './integrations.mjs'

const ACCESS = 'op_access'
const REFRESH = 'op_refresh'
const RECOVERY = 'op_recovery'
const PKCE = 'op_pkce'
function startPKCE(response,origin,recovery=false){
  const verifier=randomBytes(48).toString('base64url')
  response.setHeader('Set-Cookie',cookie(PKCE,(recovery?'recovery.':'email.')+verifier,3600,origin))
  return {code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'s256'}
}
const empty = { saved: [], plans: {}, resolution: null, noticeRead: true, applications: {} }
const attempts = new Map()
const hash = value => createHash('sha256').update(value).digest('hex')

export function authMode(env) {
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY) return 'live'
  if (env.VERCEL || env.SUPABASE_URL || env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY) return 'unavailable'
  return 'demo'
}

function emailValue(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Enter a valid email address.')
  return email
}

function cleanText(value, maximum) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : ''
}

function locationValue(value) {
  if (!value || typeof value !== 'object') return undefined
  const location = Object.fromEntries(['country', 'region', 'city'].map(key => [key, cleanText(value[key], 80)]))
  return Object.values(location).every(Boolean) ? location : undefined
}

function needPassword(input) {
  if (!passwordAcceptable(input.password)) throw new ApiError(400, 'Use at least 12 characters and at most 72 UTF-8 bytes.')
  if (input.password !== input.confirmation) throw new ApiError(400, 'The passwords don’t match.')
}

function requireAge(value) {
  const age = ageEligibility(value)
  if (age === 'underage') throw new ApiError(400, 'Path4U is currently available to users aged 15 and above.')
  if (age !== 'eligible') throw new ApiError(400, 'Enter a valid date of birth.')
  if (value > birthdayCutoff(new Date(), 18)) throw new ApiError(403, 'Registration for ages 15–17 is pending a guardian consent process.')
}

function throttle(request) {
  const now = Date.now()
  const address = (request.headers['x-vercel-forwarded-for'] ?? request.socket?.remoteAddress ?? '').split(',')[0]
  const key = hash(address)
  for (const [id, record] of attempts) if (record.until <= now) attempts.delete(id)
  const record = attempts.get(key) ?? { count: 0, until: now + 300_000 }
  if (++record.count > 25) throw new ApiError(429, 'Too many attempts. Wait a few minutes and try again.')
  if (attempts.size < 5000 || attempts.has(key)) attempts.set(key, record)
}

export async function supabase(env, resource, { method = 'GET', body, token, service = false, prefer } = {}) {
  if(env.PATH4U_DATA_BACKEND==='redis' && resource.startsWith('/rest/v1/')) return redisDataRequest(env,resource,{method,body,token,service})
  const key = service ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY
  let response
  try {
    response = await fetch(new URL(resource, env.SUPABASE_URL), {
      method,
      headers: { apikey: key, Authorization: 'Bearer ' + (token ?? key), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new ApiError(503, 'The account service is unavailable. Try again shortly.')
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  return { ok: response.ok, status: response.status, data }
}

export function requireResult(result, message) {
  if (!result.ok) {
    const status = result.status === 429 ? 429 : result.status >= 500 ? 503 : 400
    throw new ApiError(status, status === 429 ? 'Too many attempts. Try again shortly.' : message)
  }
  return result.data
}

// Only documented, actionable codes cross the API boundary. Never forward provider messages.
function authFailure(status, code, message) {
  return Object.assign(new ApiError(status, message), { code, ...(status === 429 ? { retryAfter: 60 } : {}) })
}

function providerAuthCode(data) {
  return typeof data?.error_code === 'string' ? data.error_code : typeof data?.code === 'string' ? data.code : undefined
}

function requireAuthResult(result, fallback) {
  if (result.ok) return result.data
  const code = providerAuthCode(result.data)
  if (code === 'over_email_send_rate_limit') throw authFailure(429, 'email_rate_limited', 'Email sending is temporarily limited. Try again later or contact support.')
  if (result.status === 429 || code === 'over_request_rate_limit') {
    throw authFailure(429, 'auth_rate_limited', 'Too many attempts. Wait a minute before trying again.')
  }
  if (code === 'email_not_confirmed') throw authFailure(403, code, 'Verify your email before signing in. You can request another verification email below.')
  if (code === 'invalid_credentials') throw authFailure(400, code, 'Email or password is incorrect.')
  if (['email_address_not_authorized', 'email_provider_disabled'].includes(code)) {
    throw authFailure(503, 'email_delivery_unavailable', 'Verification email could not be sent. Try again later or contact support.')
  }
  if (code === 'email_address_invalid') throw authFailure(400, 'auth_request_failed', 'Enter a valid email address.')
  if (result.status >= 500 || ['bad_jwt', 'unexpected_failure'].includes(code)) {
    throw authFailure(503, 'auth_unavailable', 'The account service is unavailable. Try again shortly.')
  }
  throw authFailure(400, 'auth_request_failed', fallback)
}

// Supabase additionally enforces project-wide email and authentication rate limits.
// This bounded per-instance cooldown also catches repeated clicks before provider requests.
const mailAttempts = new Map()
function mailCooldown(email, action) {
  const now = Date.now()
  for (const [key, until] of mailAttempts) if (until <= now) mailAttempts.delete(key)
  const key = hash(action + ':' + email)
  const until = mailAttempts.get(key)
  if (until > now) throw Object.assign(authFailure(429, 'auth_rate_limited', 'Wait one minute before requesting another email.'), { retryAfter: Math.ceil((until - now) / 1000) })
  if (mailAttempts.size >= 5000) throw authFailure(429, 'auth_rate_limited', 'Email requests are busy. Try again shortly.')
  mailAttempts.set(key, now + 60_000)
}

function readCookie(request, key) {
  return (request.headers.cookie ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(key + '='))?.slice(key.length + 1) ?? ''
}

function cookie(name, value, age, origin) {
  return name + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + age + (origin.startsWith('https:') ? '; Secure' : '')
}

function setSession(response, tokens, origin, recovery = false) {
  response.setHeader('Set-Cookie', [
    cookie(ACCESS, recovery ? '' : tokens.access_token, recovery ? 0 : Math.min(tokens.expires_in ?? 3600, 3600), origin),
    cookie(REFRESH, recovery ? '' : tokens.refresh_token, recovery ? 0 : 604800, origin),
    cookie(RECOVERY, recovery ? tokens.access_token : '', recovery ? 900 : 0, origin),
  ])
}

function clearSession(response, origin) {
  response.setHeader('Set-Cookie', [ACCESS, REFRESH, RECOVERY, PKCE].map(name => cookie(name, '', 0, origin)))
}

async function identity(request, env) {
  const token = readCookie(request, ACCESS)
  if (!token) return null
  const result = await supabase(env, '/auth/v1/user', { token })
  if (result.status >= 500) throw new ApiError(503, 'The account service is unavailable.')
  return result.ok && result.data?.email_confirmed_at ? { token, user: result.data } : null
}

function eligible(user) {
  return user.app_metadata?.age_requirement_met === true
}

const profilePath = id => '/rest/v1/openpath_profiles?user_id=eq.' + encodeURIComponent(id)

async function account(identity, env) {
  if (!identity) return { mode: 'live', user: null }
  const { token, user } = identity
  const age = eligible(user)
  const profile = age ? requireResult(await supabase(env, profilePath(user.id) + '&select=preferences', { token }), 'The profile could not be read.')?.[0] : null
  return {
    mode: 'live',
    user: { id: user.id, email: user.email, name: cleanText(user.user_metadata?.full_name, 100) || user.email.split('@')[0], eligible: age, location: locationValue(user.user_metadata?.location), preferences: profile?.preferences ?? null },
  }
}

export async function requireAccount(request, env, onboarded = true) {
  const person = await identity(request, env)
  if (!person) throw new ApiError(401, 'Sign in to continue.')
  if (onboarded && !(await account(person, env)).user?.preferences) throw new ApiError(403, 'Complete age eligibility and onboarding first.')
  return person
}

export async function authRequest(path, input, request, response, env, origin) {
  const mode = authMode(env)
  if (path === 'session' && mode !== 'live') return { mode, user: null }
  if (mode !== 'live') throw new ApiError(503, 'Account services need a configured Supabase project.')
  if (path === 'session') {
    const current = await identity(request, env)
    const recovery = readCookie(request, RECOVERY)
    if (!current && recovery) {
      const result = await supabase(env, '/auth/v1/user', { token: recovery })
      if (result.ok) return { mode: 'live', user: null, recovery: true }
    }
    if (current) return account(current, env)
    const refresh_token = readCookie(request, REFRESH)
    if (!refresh_token) return { mode: 'live', user: null }
    const refreshed = await supabase(env, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token } })
    if (refreshed.status >= 500) throw new ApiError(503, 'The account service is unavailable.')
    if (!refreshed.ok || !refreshed.data?.user?.email_confirmed_at) {
      clearSession(response, origin)
      return { mode: 'live', user: null }
    }
    setSession(response, refreshed.data, origin)
    return account({ token: refreshed.data.access_token, user: refreshed.data.user }, env)
  }
  if (['signup', 'login', 'forgot', 'resend', 'verify', 'exchange', 'reset'].includes(path)) throttle(request)
  switch (path) {
    case 'signup': {
      const full_name = cleanText(input.name, 100)
      if (!full_name || input.terms !== true) throw new ApiError(400, 'Enter your full name and accept the Terms and Privacy Policy.')
      const email = emailValue(input.email)
      needPassword(input)
      requireAge(input.dob)
      const location = locationValue(input.location)
      if (!location) throw new ApiError(400, 'Enter your country, state or region, and city.')
      const config = requireResult(await supabase(env, '/auth/v1/settings'), 'Account settings could not be verified.')
      if (config?.mailer_autoconfirm !== false) throw new ApiError(503, 'Email confirmation must be enabled before registration.')
      const ticket = randomUUID()
      // The audited project has no legacy ticket table/trigger. Default to server attestation.
      const serverAttested=env.PATH4U_SIGNUP_MODE!=='legacy-ticket'
      if(!serverAttested){
        await supabase(env, '/rest/v1/openpath_signup_tickets?expires_at=lt.' + encodeURIComponent(new Date().toISOString()), { method: 'DELETE', service: true })
        requireResult(await supabase(env, '/rest/v1/openpath_signup_tickets', { method: 'POST', service: true, body: { token_hash: hash(ticket), email_hash: hash(email), age_policy_version: AGE_POLICY_VERSION } }), 'Account registration is unavailable.')
      }
      const result = await supabase(env, '/auth/v1/signup?redirect_to='+encodeURIComponent(origin+'/auth/callback'), { method: 'POST', body: { email, password: input.password, ...startPKCE(response,origin), data: { full_name, location, ...(serverAttested?{}:{openpath_age_ticket: ticket}) } } })
      if(env.PATH4U_AUTH_MONITORING==='true')console.info(JSON.stringify({event:'auth_signup',status:result.status,code:/^[a-z0-9_]{1,60}$/i.test(providerAuthCode(result.data) || '')?providerAuthCode(result.data):undefined}))
      const newUser=result.data?.user ?? result.data
      if(serverAttested && result.ok && newUser?.id && newUser.email===email && newUser.identities?.length) {
        requireResult(await supabase(env,'/auth/v1/admin/users/'+encodeURIComponent(newUser.id),{method:'PUT',service:true,body:{app_metadata:{...newUser.app_metadata,age_requirement_met:true,age_attestation_at:new Date().toISOString(),age_policy_version:AGE_POLICY_VERSION}}}),'Age attestation could not be recorded.')
      }
      if (result.data?.access_token) throw new ApiError(503, 'Email verification must be enabled before registration.')
      if (!['user_already_exists', 'email_exists'].includes(providerAuthCode(result.data))) requireAuthResult(result, 'Registration could not be completed. Check your details and try again.')
      return { accepted: true }
    }
    case 'login': {
      const email = emailValue(input.email)
      if (typeof input.password !== 'string' || input.password.length > 200) throw new ApiError(400, 'Check your email and password.')
      const tokens = requireAuthResult(await supabase(env, '/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: input.password } }), 'Email or password is incorrect.')
      if (!tokens?.user?.email_confirmed_at) throw authFailure(403, 'email_not_confirmed', 'Verify your email before signing in. You can request another verification email below.')
      const state = await account({ token: tokens.access_token, user: tokens.user }, env)
      setSession(response, tokens, origin)
      return state
    }
    case 'forgot':
    case 'resend': {
      const email = emailValue(input.email)
      mailCooldown(email, path)
      const result = await supabase(env, (path === 'forgot' ? '/auth/v1/recover' : '/auth/v1/resend')+'?redirect_to='+encodeURIComponent(origin+'/auth/callback'), { method: 'POST', body: path === 'forgot' ? { email,...startPKCE(response,origin,true) } : { email, type: 'signup' } })
      // Return the same acceptance for absent/already verified accounts to avoid enumeration.
      if (!['user_not_found', 'email_not_found', 'email_exists', 'user_already_exists'].includes(providerAuthCode(result.data))) requireAuthResult(result, 'Email could not be sent. Try again shortly.')
      return { accepted: true }
    }
    case 'verify': {
      if (typeof input.token !== 'string' || !/^[a-z0-9_-]{24,160}$/i.test(input.token) || !['email', 'recovery'].includes(input.type)) throw new ApiError(400, 'Open a new verification or recovery link.')
      const tokens = requireResult(await supabase(env, '/auth/v1/verify', { method: 'POST', body: { type: input.type, token_hash: input.token } }), 'This link is invalid or expired. Request a new link.')
      if (!tokens?.access_token || !tokens?.user?.email_confirmed_at) throw new ApiError(403, 'The link did not establish a verified session.')
      const recovery = input.type === 'recovery'
      const state = recovery ? { mode: 'live', user: null, recovery: true } : await account({ token: tokens.access_token, user: tokens.user }, env)
      setSession(response, tokens, origin, recovery)
      return state
    }
    case 'exchange': {
      const pending=readCookie(request,PKCE)
      if(typeof input.code!=='string' || !/^[a-z0-9_-]{16,256}$/i.test(input.code) || !/^(email|recovery)\.[a-z0-9_-]{64}$/i.test(pending))throw new ApiError(400,'Open this link in the browser where you requested it. You can also sign in after confirming your email, or request a new reset link.')
      const recovery=pending.startsWith('recovery.')
      const tokens=requireResult(await supabase(env,'/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:input.code,code_verifier:pending.slice(pending.indexOf('.')+1)}}),'This link expired or was already used. Request a new link.')
      if(!tokens?.access_token || !tokens.user?.email_confirmed_at)throw new ApiError(403,'Email verification did not establish a session.')
      const state=recovery?{mode:'live',user:null,recovery:true}:await account({token:tokens.access_token,user:tokens.user},env)
      setSession(response,tokens,origin,recovery)
      response.setHeader('Set-Cookie',[...response.getHeader('Set-Cookie'),cookie(PKCE,'',0,origin)])
      return state
    }
    case 'reset': {
      needPassword(input)
      const token = readCookie(request, RECOVERY)
      if (!token) throw new ApiError(401, 'Open the link from your recovery email first.')
      requireResult(await supabase(env, '/auth/v1/user', { method: 'PUT', token, body: { password: input.password } }), 'The password could not be changed. Request a new recovery link if it expired.')
      const revoked = await supabase(env, '/auth/v1/logout?scope=global', { method: 'POST', token })
      clearSession(response, origin)
      if (!revoked.ok && revoked.status !== 401) throw new ApiError(503, 'Your password changed, but other sessions could not be revoked. Sign in and use Sign Out on your other devices.')
      return { mode: 'live', user: null }
    }
    case 'logout': {
      const person = await identity(request, env)
      const token = person?.token || readCookie(request, RECOVERY)
      if (token) {
        const result = await supabase(env, '/auth/v1/logout?scope=local', { method: 'POST', token })
        if (!result.ok && result.status !== 401) requireResult(result, 'Sign-out could not be completed. Try again.')
      } else if (readCookie(request, REFRESH)) {
        const refreshed = await supabase(env, '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: readCookie(request, REFRESH) } })
        if (refreshed.ok) requireResult(await supabase(env, '/auth/v1/logout?scope=local', { method: 'POST', token: refreshed.data.access_token }), 'Sign-out could not be completed.')
        if (refreshed.status >= 500 || refreshed.status === 429) requireResult(refreshed, 'Sign-out could not be completed.')
      }
      clearSession(response, origin)
      return { mode: 'live', user: null }
    }
    case 'attest': {
      const person = await requireAccount(request, env, false)
      if (eligible(person.user)) return account(person, env)
      requireAge(input.dob)
      const user = requireResult(await supabase(env, '/auth/v1/admin/users/' + encodeURIComponent(person.user.id), {
        method: 'PUT', service: true, body: { app_metadata: { age_requirement_met: true, age_attestation_at: new Date().toISOString(), age_policy_version: AGE_POLICY_VERSION } },
      }), 'Age eligibility could not be saved. Try again.')
      return account({ ...person, user }, env)
    }
    case 'onboarding': {
      const person = await requireAccount(request, env, false)
      if (!eligible(person.user)) throw new ApiError(403, 'Confirm age eligibility first.')
      const selected = value => Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string').map(item => cleanText(item, 70)).filter(Boolean))].slice(0, 24) : []
      const preferences = {
        organization: cleanText(input.organization, 120), field: cleanText(input.field, 120), stage: cleanText(input.stage, 30),
        interests: selected(input.interests), skills: selected(input.skills), goals: selected(input.goals), statuses: selected(input.statuses),
        location: locationValue(input.location) ?? locationValue(person.user.user_metadata?.location),
        level: cleanText(input.level, 30), workMode: cleanText(input.workMode, 30),
        relocate: input.relocate === true, weeklyHours: cleanText(input.weeklyHours, 50), budget: cleanText(input.budget, 70),
      }
      if (!preferences.organization || !preferences.field || !['Student', 'Graduate', 'Professional'].includes(preferences.stage) || !preferences.interests.length || !preferences.goals.length) throw new ApiError(400, 'Complete your background, interests, and goals.')
      requireResult(await supabase(env, '/rest/v1/openpath_profiles?on_conflict=user_id', { method: 'POST', token: person.token, body: { user_id: person.user.id, preferences }, prefer: 'resolution=merge-duplicates' }), 'Your preferences could not be saved.')
      return account(person, env)
    }
    default:
      throw new ApiError(404, 'Account action unavailable.')
  }
}

export async function workspaceRequest(request, env, input) {
  const { token, user } = await requireAccount(request, env)
  const query = '/rest/v1/openpath_workspace?user_id=eq.' + encodeURIComponent(user.id)
  if (input) {
    const revision = input.revision
    if (!Number.isSafeInteger(revision) || revision < -1 || !input.state || typeof input.state !== 'object' || Array.isArray(input.state)) throw new ApiError(400, 'Invalid workspace update.')
    const { saved, plans, applications, profile, theme, activity, roadmaps, mindMap } = input.state
    if (!Array.isArray(saved) || !plans || !applications || !profile) throw new ApiError(400, 'Invalid workspace state.')
    if (roadmaps !== undefined && (!Array.isArray(roadmaps) || roadmaps.length > 10 || JSON.stringify(roadmaps).length > 50_000)) throw new ApiError(400, 'Keep at most 10 roadmaps in this workspace.')
    if (mindMap !== undefined && (!Array.isArray(mindMap) || mindMap.length > 40 || JSON.stringify(mindMap).length > 8000)) throw new ApiError(400, 'Keep at most 40 nodes in this mind map.')
    const state = { ...empty, saved, plans, applications, profile, theme, roadmaps, mindMap, activity: Array.isArray(activity) ? activity.slice(0, 100) : [] }
    const next = { state, revision: revision + 1 }
    const result = await supabase(env, revision === -1 ? '/rest/v1/openpath_workspace' : query + '&revision=eq.' + revision, {
      method: revision === -1 ? 'POST' : 'PATCH', token, body: revision === -1 ? { user_id: user.id, ...next } : next, prefer: 'return=representation',
    })
    if (result.status === 409 || (result.ok && !result.data?.length)) throw new ApiError(409, 'This workspace changed in another tab. Reload before editing again.')
    requireResult(result, 'Workspace changes could not be saved.')
    return next
  }
  const [rows, listings] = await Promise.all([
    supabase(env, query + '&select=state,revision', { token }),
    supabase(env, '/rest/v1/openpath_opportunities?active=eq.true&select=id,listing,deadline_at,published_at,verified_at&order=published_at.desc', { token }),
  ])
  const saved = requireResult(rows, 'Your workspace could not be loaded.')?.[0]
  const catalog = requireResult(listings, 'Opportunities could not be loaded.').filter(row => row.listing && typeof row.listing.title === 'string')
    .map(row => ({ ...row.listing, id: row.id, sourceUrl: /^https:\/\//i.test(row.listing.sourceUrl ?? '') ? row.listing.sourceUrl : '', deadline: row.deadline_at ?? row.listing.deadline ?? '', published: row.published_at, verified: Boolean(row.verified_at && Date.now()-Date.parse(row.verified_at)<86400000), status:row.verified_at && Date.now()-Date.parse(row.verified_at)>=86400000?'Status Unverified':row.listing.status }))
  return { state: saved?.state ?? empty, revision: saved?.revision ?? -1, catalog }
}
