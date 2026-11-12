import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Document, Packer, Paragraph } from 'docx'
import { inspectAttachment } from '../server/assistant.mjs'
import { createOpenPathServer } from '../server/index.mjs'
import { applyResumeEdits, reviewResume } from '../shared/resume.mjs'
import { mailtoLink } from '../src/documents.ts'

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)))
const base64 = bytes => Buffer.from(bytes).toString('base64')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH4sAAAAASUVORK5CYII=', 'base64')

test('resume score is derived from weighted criteria and edits preserve the stated facts', () => {
  const resume = 'Experience\nWorked on a TypeScript website.\nBuilt a dashboard for 20 volunteers.\n\nSkills\nReact, HTML, CSS.'
  const result = reviewResume(resume, 'Frontend Developer', 'React TypeScript testing')
  const total = result.rubric.reduce((sum, item) => sum + item.score * item.weight / 100, 0)
  assert.equal(result.score, Math.round(total * 10) / 10)
  assert.equal(result.rubric.reduce((sum, item) => sum + item.weight, 0), 100)
  assert.ok(result.matched.includes('TypeScript'))
  assert.ok(result.edits[0].after.includes('Contributed to a TypeScript website.'))
  assert.equal(applyResumeEdits(resume, result.edits, []), resume)
  assert.match(applyResumeEdits(resume, result.edits, [result.edits[0].id]), /20 volunteers/)
  assert.equal(mailtoLink('jobs@example.com', 'Q&A + interview', 'First line\nSecond line'), 'mailto:jobs@example.com?subject=Q%26A%20%2B%20interview&body=First%20line%0D%0ASecond%20line')
  assert.throws(() => mailtoLink('jobs@example.com,bcc@example.com', 'Draft', 'Message'), /valid recipient/)
})

test('attachment checks recognize Word text and reject disguised or oversized input', async () => {
  const word = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph('Build a safe API & test it.')] }] }))
  const result = inspectAttachment({ mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: base64(word) })
  assert.equal(result.text, 'Build a safe API & test it.')
  assert.equal(inspectAttachment({ mime: 'image/png', data: base64(png) }).text, '')
  assert.throws(() => inspectAttachment({ mime: 'image/png', data: base64('not a PNG') }), { status: 415 })
  assert.throws(() => inspectAttachment({ mime: 'text/plain', data: 'A'.repeat(3_340_000) }), { status: 400 })
})

test('assistant requires an eligible session and cleans up a staged file after provider processing', async t => {
  const requests = []
  const user = { id: randomUUID(), email: 'candidate@example.test', email_confirmed_at: '2026-11-10', app_metadata: { age_requirement_met: true } }
  let allowUsage = true
  const upstream = createServer(async (req, res) => {
    const bytes = Buffer.concat(await Array.fromAsync(req))
    const url = new URL(req.url, 'http://mock.test')
    requests.push({ method: req.method, path: url.pathname, body: bytes })
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
    if (url.pathname === '/auth/v1/user') return send(200, user)
    if (url.pathname === '/rest/v1/openpath_profiles') return send(200, [{ preferences: {} }])
    if (url.pathname === '/rest/v1/rpc/openpath_claim_assistant_usage') return send(200, allowUsage)
    if (url.pathname.startsWith('/storage/v1/object/path4u-assistant')) return send(200, {})
    send(404, {})
  })
  const originalFetch = globalThis.fetch
  const geminiCalls = []
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    if (String(url).startsWith('https://generativelanguage.googleapis.com/')) {
      geminiCalls.push(JSON.parse(opts.body))
      if (String(url).includes('mock-image')) return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: base64(png) } }] } }] })
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: '## Review\n\nThe document covers SQL.', proposal: '', artifact: 'document', title: 'Review' }) }] } }] })
    }
    return originalFetch(url, opts)
  })
  const server = createOpenPathServer({ env: { SUPABASE_URL: await listen(upstream), SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service', GEMINI_PRIVATE_DATA_APPROVED:'true', GEMINI_DATA_PROCESSING_REFERENCE:'synthetic-test-only', GEMINI_API_KEY: 'test-gemini', GEMINI_MODEL: 'mock-text', GEMINI_IMAGE_MODEL: 'mock-image', GEMINI_IMAGE_BILLING_APPROVED:'true' } })
  const origin = await listen(server)
  t.after(() => { server.close(); upstream.close() })
  const call = (body, signedIn = true) => fetch(origin + '/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: signedIn ? 'op_access=test-access' : '' }, body: JSON.stringify(body) })
  assert.equal((await call({ message: 'Hello' }, false)).status, 401)
  const attachment = { mime: 'application/pdf', data: base64('%PDF-1.7 sample test attachment') }
  const response = await call({ message: 'Review this PDF', attachment, privateDataConsent:true })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).processed, true)
  const upload = requests.find(entry => entry.method === 'POST' && entry.path.startsWith('/storage/'))
  assert.ok(upload.path.startsWith('/storage/v1/object/path4u-assistant/' + user.id + '/'))
  assert.deepEqual(upload.body, Buffer.from(attachment.data, 'base64'))
  assert.ok(requests.some(entry => entry.method === 'DELETE' && JSON.parse(entry.body).prefixes[0].startsWith(user.id + '/')))
  assert.deepEqual(geminiCalls[0].contents[0].parts[1].inlineData, { mimeType: 'application/pdf', data: attachment.data })
  const image = await call({ action: 'image', message: 'Generate an illustration of a road.' })
  assert.equal(image.status, 200)
  assert.equal((await image.json()).image.data, base64(png))
  allowUsage = false
  assert.equal((await call({ message: 'Review again' })).status, 429)
  assert.equal(geminiCalls.length, 2)
})
