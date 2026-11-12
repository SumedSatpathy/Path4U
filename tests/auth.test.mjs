import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { ageEligibility, birthdayCutoff, calendarDate, passwordAcceptable } from '../shared/age.mjs'
import { createOpenPathServer } from '../server/index.mjs'

test('Kuala Lumpur cutoff changes at local midnight and matches the full birthday', () => {
  const before = new Date('2026-11-09T15:59:59Z')
  const at = new Date('2026-11-09T16:00:00Z')
  assert.equal(calendarDate(at), '2026-11-10')
  assert.equal(birthdayCutoff(at), '2011-11-10')
  assert.equal(ageEligibility('2011-11-10', before), 'underage')
  assert.equal(ageEligibility('2011-11-10', at), 'eligible')
  assert.equal(ageEligibility('2011-11-11', at), 'underage')
  assert.equal(ageEligibility('2012-01-01', at), 'underage')
  assert.equal(ageEligibility('2007-06-22', at), 'eligible')
  for (const invalid of ['2007-02-29', '2028-11-10', '2008-04-31', '2008-00-04', '10/11/2008', null]) {
    assert.equal(ageEligibility(invalid, at), 'invalid')
  }
})

test('February 29 birthdays use March 1 in non-leap anniversary years', () => {
  assert.equal(ageEligibility('2008-02-29', new Date('2023-02-28T12:00:00Z')), 'underage')
  assert.equal(ageEligibility('2008-02-29', new Date('2023-03-01T12:00:00Z')), 'eligible')
  assert.equal(birthdayCutoff(new Date('2028-02-29T12:00:00Z')), '2013-02-28')
  assert.equal(passwordAcceptable('short'), false)
  assert.equal(passwordAcceptable('0123456789ab'), true)
  assert.equal(passwordAcceptable('💡'.repeat(19)), false)
})

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)))

test('account endpoints enforce age, same-origin writes and verified account access', async t => {
  const calls = []
  let preferences = null
  let revoked = false
  let allowAge = true
  const verifiedUser = { id: 'test-person', email: 'adult@example.test', email_confirmed_at: '2026-11-10', app_metadata: {}, user_metadata: { full_name: 'Example Person' } }
  const tokens = () => ({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { ...verifiedUser, app_metadata: { age_requirement_met: allowAge } } })
  const mock = createServer(async (req, res) => {
    const body = await Array.fromAsync(req).then(parts => parts.length ? JSON.parse(Buffer.concat(parts).toString()) : null)
    const url = new URL(req.url, 'http://mock.test')
    calls.push({ url: url.pathname, body })
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
    if (url.pathname === '/auth/v1/settings') return send(200, { mailer_autoconfirm: false })
    if (url.pathname === '/auth/v1/signup') return send(200, { user: { id: 'registered' } })
    if (url.pathname === '/auth/v1/token') return send(revoked ? 401 : 200, revoked ? {} : tokens())
    if (url.pathname === '/auth/v1/verify') return send(body.token_hash === 'x'.repeat(32) ? 200 : 400, tokens())
    if (url.pathname === '/auth/v1/user') return send(revoked ? 401 : 200, req.method === 'PUT' ? { updated: true } : tokens().user)
    if (url.pathname === '/auth/v1/logout') { revoked = true; return send(200, {}) }
    if (url.pathname === '/rest/v1/openpath_profiles') {
      if (req.method === 'POST') preferences = body.preferences
      return send(200, preferences ? [{ preferences }] : [])
    }
    if (url.pathname === '/rest/v1/openpath_signup_tickets') return send(200, [])
    if (url.pathname === '/rest/v1/openpath_workspace') return send(200, req.method === 'POST' ? [{ state: body.state, revision: body.revision }] : [])
    if (url.pathname === '/rest/v1/openpath_opportunities') return send(200, [{ id: 'published-1', listing: { title: 'Stored opportunity', sourceUrl: 'https://example.test/' }, verified_at: new Date().toISOString(), deadline_at: '2026-12-04T10:00:00Z' }])
    if (url.pathname === '/auth/v1/recover' || url.pathname === '/auth/v1/resend') return send(200, {})
    send(404, {})
  })
  const supabase = await listen(mock)
  const server = createOpenPathServer({ env: { PATH4U_SIGNUP_MODE: 'legacy-ticket', SUPABASE_URL: supabase, SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service' } })
  const origin = await listen(server)
  t.after(() => { server.close(); mock.close() })
  const post = (path, body, { cookie = '', from = origin } = {}) => fetch(origin + path, {
    method: 'POST', headers: { Origin: from, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const signup = { name: 'Example Person', email: 'adult@example.test', password: 'one-long-password', confirmation: 'one-long-password', terms: true, location: { country: 'Malaysia', region: 'Kuala Lumpur', city: 'Kuala Lumpur' } }
  assert.equal((await post('/api/auth/signup', { ...signup, dob: calendarDate() })).status, 400)
  assert.equal((await post('/api/auth/signup', { ...signup, dob: '2000-04-31' })).status, 400)
  assert.equal((await post('/api/auth/signup', { ...signup, dob: birthdayCutoff() }, { from: 'https://bad.test' })).status, 403)
  assert.equal(calls.length, 0)
  assert.equal((await post('/api/auth/signup', { ...signup, dob: birthdayCutoff() })).status, 403)
  assert.equal(calls.length, 0)
  const adultBirthday = birthdayCutoff(new Date(), 18)
  assert.equal((await post('/api/auth/signup', { ...signup, dob: adultBirthday })).status, 200)
  assert.deepEqual(calls.find(call => call.url === '/auth/v1/signup').body.data.location, signup.location)
  assert.equal(calls.find(call => call.url === '/rest/v1/openpath_signup_tickets' && call.body).body.age_policy_version, 'my-15-v2')
  assert.equal(calls.some(call => JSON.stringify(call.body).includes(adultBirthday)), false)
  assert.equal((await fetch(origin + '/api/workspace')).status, 401)
  const login = await post('/api/auth/login', signup)
  assert.equal(login.status, 200)
  const set = login.headers.getSetCookie()
  assert.match(set[0], /HttpOnly; SameSite=Lax/)
  assert.equal((await login.json()).user.preferences, null)
  const cookie = set.filter(value => !value.includes('Max-Age=0')).map(value => value.split(';')[0]).join('; ')
  assert.equal((await (await fetch(origin + '/api/auth/session', {headers:{Cookie:cookie}})).json()).user.id, verifiedUser.id)
  const refreshed = await fetch(origin + '/api/auth/session', {headers:{Cookie:'op_refresh=refresh'}})
  assert.equal(refreshed.status,200)
  assert.match(refreshed.headers.getSetCookie()[0],/^op_access=access;/)
  const workspace = () => fetch(origin + '/api/workspace', { headers: { Cookie: cookie } })
  assert.equal((await workspace()).status, 403)
  allowAge = false
  assert.equal((await post('/api/auth/onboarding', {}, { cookie })).status, 403)
  allowAge = true
  const details = { organization: 'University', field: 'Software', stage: 'Student', interests: ['AI'], skills: ['Python'], goals: ['Find internships'] }
  assert.equal((await post('/api/auth/onboarding', details, { cookie })).status, 200)
  assert.equal((await workspace()).status, 200)
  assert.equal((await (await workspace()).json()).catalog[0].verified, true)
  const state = { saved: ['published-1'], plans: {}, applications: {}, profile: { name: 'Example Person' } }
  assert.equal((await post('/api/workspace', { state, revision: -1 }, { cookie })).status, 200)
  assert.equal((await post('/api/auth/forgot', { email: 'adult@example.test' })).status, 200)
  assert.equal((await post('/api/auth/reset', signup, { cookie })).status, 401)
  assert.equal((await post('/api/auth/verify', { token: 'b'.repeat(32), type: 'email' })).status, 400)
  const verified = await post('/api/auth/verify', { token: 'x'.repeat(32), type: 'email' })
  assert.equal(verified.status, 200)
  assert.match(verified.headers.getSetCookie()[0], /^op_access=access;/)
  const recovery = await post('/api/auth/verify', { token: 'x'.repeat(32), type: 'recovery' })
  const recoveryCookies = recovery.headers.getSetCookie().filter(value => !value.includes('Max-Age=0')).map(value => value.split(';')[0]).join('; ')
  assert.match(recoveryCookies, /^op_recovery=/)
  assert.equal((await fetch(origin + '/api/workspace', { headers: { Cookie: recoveryCookies } })).status, 401)
  assert.equal((await post('/api/auth/reset', signup, { cookie: recoveryCookies })).status, 200)
  assert.equal((await workspace()).status, 401)
  assert.equal((await post('/api/auth/logout', {}, { cookie })).status, 200)
})

test('native email PKCE exchanges require the HttpOnly verifier and never accept a caller-chosen recovery mode', async t=>{
 const {createHash}=await import('node:crypto')
 const calls=[]
 const person={id:'11111111-2222-4333-8444-555555555555',email:'qa@example.test',email_confirmed_at:new Date().toISOString(),identities:[{}],app_metadata:{age_requirement_met:true},user_metadata:{full_name:'Synthetic'}}
 const mock=createServer(async(req,res)=>{
  const body=await Array.fromAsync(req).then(parts=>parts.length?JSON.parse(Buffer.concat(parts).toString()):null)
  const url=new URL(req.url,'http://synthetic.test');calls.push({path:url.pathname,body})
  res.setHeader('content-type','application/json')
  const data=url.pathname.endsWith('/settings')?{mailer_autoconfirm:false}:url.pathname.endsWith('/signup')?person:url.pathname.endsWith('/token')?{user:person,access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600}:url.pathname.includes('/rest/')?[]:person
  res.end(JSON.stringify(data))
 })
 const upstream=await listen(mock),app=createOpenPathServer({env:{SUPABASE_URL:upstream,SUPABASE_ANON_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic'}}),origin=await listen(app)
 t.after(()=>{app.close();mock.close()})
 const post=(action,data,cookie='')=>fetch(origin+'/api/auth/'+action,{method:'POST',headers:{Origin:origin,'content-type':'application/json',Cookie:cookie},body:JSON.stringify(data)})
 const code='11111111-2222-4333-8444-555555555555'
 assert.equal((await post('exchange',{code})).status,400);assert.equal(calls.length,0)
 const signup=await post('signup',{name:'Synthetic',email:person.email,password:'SyntheticPassword-123',confirmation:'SyntheticPassword-123',terms:true,dob:'2000-01-01',location:{country:'Malaysia',region:'KL',city:'KL'}})
 assert.equal(signup.status,200)
 const pending=signup.headers.getSetCookie().find(x=>x.startsWith('op_pkce='));assert.match(pending,/HttpOnly; SameSite=Lax/)
 const verifier=pending.split(';')[0].split('email.')[1]
 const request=calls.find(x=>x.path.endsWith('/signup'))
 assert.equal(request.body.code_challenge,createHash('sha256').update(verifier).digest('base64url'));assert.equal(request.body.code_challenge_method,'s256');assert.equal(JSON.stringify(calls).includes('2000-01-01'),false)
 assert.equal(calls.some(x=>x.path.includes('openpath_signup_tickets')),false)
 assert.equal(calls.find(x=>x.path.includes('/admin/users/')).body.app_metadata.age_requirement_met,true)
 const exchanged=await post('exchange',{code,type:'recovery'},pending.split(';')[0]);assert.equal(exchanged.status,200);assert.equal((await exchanged.json()).recovery,undefined)
 assert.equal(calls.find(x=>x.path.endsWith('/token')).body.code_verifier,verifier)
 assert.ok(exchanged.headers.getSetCookie().some(x=>x.startsWith('op_pkce=;') && x.includes('Max-Age=0')))
})

test('authentication errors retain safe actionable codes, respect mail cooldowns and hide upstream details', async t => {
  let responseCode = 'invalid_credentials'
  let status = 400
  let mailCalls = 0
  const mock = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://mock.test')
    await Array.fromAsync(req)
    if (url.pathname === '/auth/v1/resend') mailCalls++
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ code: status, error_code: responseCode, msg: 'PRIVATE upstream details: secret and email must not be forwarded' }))
  })
  const upstream = await listen(mock)
  const app = createOpenPathServer({ env: { SUPABASE_URL: upstream, SUPABASE_ANON_KEY: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' } })
  const origin = await listen(app)
  t.after(() => { app.close(); mock.close() })
  const post = (action, input) => fetch(origin + '/api/auth/' + action, { method: 'POST', headers: { Origin: origin, 'content-type': 'application/json', 'x-vercel-forwarded-for': 'synthetic-auth-errors' }, body: JSON.stringify(input) })
  const data = { email: 'synthetic-codes@example.test', password: 'synthetic-password' }
  const invalid = await post('login', data)
  assert.equal(invalid.status, 400)
  assert.deepEqual(await invalid.json(), { error: 'Email or password is incorrect.', code: 'invalid_credentials' })
  responseCode = 'email_not_confirmed'
  const unverified = await post('login', data)
  assert.equal(unverified.status, 403)
  const unverifiedBody = await unverified.json()
  assert.equal(unverifiedBody.code, 'email_not_confirmed')
  assert.match(unverifiedBody.error, /verification email/)
  assert.equal(unverified.headers.getSetCookie().length, 0)
  responseCode = 'over_email_send_rate_limit'; status = 429
  const limited = await post('login', data)
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('retry-after'), '60')
  const limitedBody = await limited.json()
  assert.equal(limitedBody.retryAfter, 60)
  assert.equal(limitedBody.code, 'email_rate_limited')
  assert.match(limitedBody.error, /Email sending is temporarily limited/)
  responseCode = 'email_address_not_authorized'; status = 422
  const sender = await post('resend', data)
  assert.equal(sender.status, 503)
  assert.equal((await sender.json()).code, 'email_delivery_unavailable')
  const cooldown = await post('resend', data)
  assert.equal(cooldown.status, 429)
  assert.equal(mailCalls, 1)
  responseCode = 'user_not_found'; status = 404
  assert.deepEqual(await (await post('forgot', data)).json(), { accepted: true })
  responseCode = 'unexpected_failure'; status = 500
  const unavailable = await post('login', data)
  assert.equal(unavailable.status, 503)
  assert.equal((await unavailable.json()).code, 'auth_unavailable')
})
