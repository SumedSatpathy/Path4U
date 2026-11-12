import { test } from 'node:test'
import assert from 'node:assert/strict'
import { careerToolReply, executeCareerTool } from '../server/careerTools.mjs'

test('career tools enforce grounded resume facts and return actual course matches', async () => {
  const context = { message: 'Build a resume for a developer.', history: [] }
  const draft = await executeCareerTool('build_resume', { role: 'Developer', name: 'Invented', email: 'invented@example.test', experience: 'Ran a company' }, context, {}, {})
  assert.equal(draft.state, 'needs_input')
  const courses = await executeCareerTool('find_courses', { query: 'Python' }, context, {}, {})
  assert.equal(courses.resources.length, 2)
  assert.equal(courses.resources[0].url, 'https://docs.python.org/3/tutorial/')
  const reply = careerToolReply({ name: 'find_courses', output: courses })
  assert.match(reply.answer, /Python Tutorial/)
  await assert.rejects(executeCareerTool('send_email', {}, context, {}, {}), { status: 502 })
  const missing = careerToolReply({ name: 'build_resume', output: draft })
  assert.equal(missing.artifact, 'text')
  assert.doesNotMatch(missing.answer, /Ran a company/)
})

test('the Gemini router executes a structured course call and returns source links from its result', async t => {
  const { routeCareerRequest } = await import('../server/careerTools.mjs')
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body)
    assert.equal(request.tools[0].functionDeclarations.length, 5)
    return Response.json({ candidates: [{ content: { parts: [{ functionCall: { name: 'find_courses', args: { query: 'Python' } } }] } }] })
  })
  const tool = await routeCareerRequest({ message: 'Help with a resume and suggest what to learn.', history: [] }, { GEMINI_MODEL: 'mock', GEMINI_API_KEY: 'mock' }, {})
  assert.equal(tool.name, 'find_courses')
  assert.equal(tool.status, 'completed')
  assert.equal(tool.sources[0].url, 'https://docs.python.org/3/tutorial/')
})
