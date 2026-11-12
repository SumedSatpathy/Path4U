import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { request } from 'node:http'
import { createOpenPathServer } from '../server/index.mjs'

test('demo charges successful work once and prevents guest provider actions', async t => {
  const server = createOpenPathServer({ env: {} })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const origin = 'http://127.0.0.1:' + server.address().port
  let cookie = ''
  const call = (route, input, requestOrigin = origin) => fetch(origin + '/api/' + route, {
    method: 'POST', headers: { Origin: requestOrigin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  assert.equal((await call('demo/session', {}, 'https://foreign.example')).status, 403)
  assert.equal((await call('demo/assistant', { message: 'Build a roadmap', requestId: randomUUID() })).status, 401)
  const session = await call('demo/session', {})
  assert.equal(session.status, 200)
  assert.deepEqual(await session.json(), { credits: 20 })
  assert.match(session.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/)
  cookie = session.headers.get('set-cookie').split(';')[0]

  const requestId = randomUUID()
  const plan = { requestId, goal: 'AI Engineer', level: 'Beginner', hours: 6, skills: 'Python', budget: 'Free only' }
  assert.equal((await call('demo/roadmap', { ...plan, hours: 0 })).status, 400)
  const [first, retry] = await Promise.all([call('demo/roadmap', plan), call('demo/roadmap', plan)])
  for (const response of [first, retry]) {
    assert.equal(response.status, 200)
    const payload = await response.json()
    assert.equal(payload.credits, 17)
    assert.equal(payload.result.source, 'guided')
    assert.ok(payload.result.milestones.some(milestone => milestone.resource === 'google-ml'))
  }
  assert.equal((await call('demo/roadmap', { ...plan, goal: 'Cloud Engineer' })).status, 409)
  assert.equal((await call('learning/assistant', { message: 'Plan', useGemini: true })).status, 401)
  assert.equal((await call('gmail-draft', {})).status, 403)
  const answers = await Promise.all(Array.from({ length: 18 }, () => call('demo/assistant', { message: 'Build a roadmap for React', requestId: randomUUID() })))
  assert.equal(answers.filter(response => response.status === 200).length, 17)
  assert.equal(answers.filter(response => response.status === 402).length, 1)
  assert.deepEqual(await (await call('demo/session', {})).json(), { credits: 0 })
})

test('the hosted public demo accepts only its Vercel hosts and never enables account or provider operations', async t => {
  const publicHost = 'path4u.example.vercel.app'
  const server = createOpenPathServer({ hosted: true, env: { VERCEL: '1', PATH4U_PUBLIC_DEMO: '1', VERCEL_PROJECT_PRODUCTION_URL: publicHost } })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const base = 'http://127.0.0.1:' + server.address().port
  const call = (path, input, { host = publicHost, origin = 'https://' + publicHost } = {}) => new Promise((resolve, reject) => {
    const req = request(base + path, {
      method: input ? 'POST' : 'GET',
      headers: { Host: host, Origin: origin, 'Content-Type': 'application/json' },
    }, async response => {
      try {
        const chunks = await Array.fromAsync(response)
        resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers }))
      } catch (error) { reject(error) }
    })
    req.on('error', reject)
    req.end(input ? JSON.stringify(input) : undefined)
  })
  const auth = await call('/api/auth/session')
  assert.deepEqual(await auth.json(), { mode: 'unavailable', user: null })
  const session = await call('/api/index?route=demo%2Fsession', {})
  assert.deepEqual(await session.json(), { credits: null })
  assert.equal(session.headers.has('set-cookie'), false)
  const result = await call('/api/demo/roadmap', { goal: 'Web developer', level: 'Beginner', skills: '', hours: 3, budget: '', useGemini: true })
  assert.equal(result.status, 200)
  assert.equal((await result.json()).result.source, 'guided')
  assert.equal((await call('/api/demo/session', {}, { origin: 'https://foreign.example' })).status, 403)
  assert.equal((await call('/api/demo/session', {}, { host: 'foreign.example' })).status, 503)
  assert.equal((await call('/api/learning/roadmap', {})).status, 401)
  assert.equal((await call('/api/auth/signup', {})).status, 503)
})
