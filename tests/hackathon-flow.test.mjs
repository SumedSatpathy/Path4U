import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createOpenPathServer } from '../server/index.mjs'
import {parseLearningRequest} from '../shared/intent.mjs'
import { roadmapFixture } from './fixtures/roadmap.mjs'

const listen = server => new Promise(resolve => server.listen(0,'127.0.0.1',() => resolve('http://127.0.0.1:' + server.address().port)))
const prompts = [
  'Create a 6-month cybersecurity roadmap.',
  'Build a 6-month AI engineering roadmap with 10 study hours per week.',
  'Recommend paid Coursera and Udemy cybersecurity courses.',
  'Find free Python courses.',
  'Explain computer networking.',
  'Help me prepare for a hackathon.',
  'Hello, what can Path4U help me with?',
  'Build a beginner AI engineering roadmap.',
  'Create a study plan for learning Python.',
  'Find relevant upcoming hackathons.',
]

test('all eight requested prompts plus time-budget and preparation variants traverse the actual API with mocked Gemini and Supabase; quota and errors fail closed', async t => {
  let quota = true
  let failure = ''
  let claims = 0
  const inputs = []
  const user = {id:'11111111-2222-4444-a333-555555555555',email:'test@example.test',email_confirmed_at:'2026-11-11',app_metadata:{age_requirement_met:true},user_metadata:{full_name:'Test'}}
  const upstream = createServer((req,res) => {
    req.resume()
    const path = new URL(req.url,'http://mock.test').pathname
    const send = data => { res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(data)) }
    if (path === '/auth/v1/user') return send(user)
    if (path === '/rest/v1/openpath_profiles') return send([{preferences:{}}])
    if (path.endsWith('openpath_claim_assistant_usage')) { claims++;return send(quota) }
    send([])
  })
  const originalFetch = globalThis.fetch
  t.mock.method(globalThis,'fetch',async (url,options) => {
    if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) return originalFetch(url,options)
    if (failure === 'quota') return new Response('',{status:429})
    const body = JSON.parse(options.body)
    const raw = body.contents[0].parts[0].text
    const input = raw.startsWith('{') ? JSON.parse(raw) : raw
    inputs.push(input)
    if (body.tools?.[0]?.google_search) return Response.json({candidates:[{content:{parts:[{text:'Provider course page retrieved.'}]},groundingMetadata:{groundingChunks:[{web:{title:'Google Cybersecurity',uri:'https://www.coursera.org/professional-certificates/google-cybersecurity/'}}],groundingSupports:[{segment:{text:'Provider course page retrieved.'},groundingChunkIndices:[0]}],searchEntryPoint:{renderedContent:'<a href="https://www.google.com/search?q=cybersecurity">Search</a>'}}}]})
    if (body.tools) return Response.json({candidates:[{content:{parts:[{text:'No tool is needed.'}]}}]})
    const output = body.generationConfig.responseSchema.properties.milestones ? roadmapFixture(input) : {answer:failure === 'empty' ? '' : 'Contextual fixture answer for: ' + input.message,artifact:'text',title:'Guidance',proposal:''}
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]})
  })
  const server = createOpenPathServer({env:{SUPABASE_URL:await listen(upstream),SUPABASE_ANON_KEY:'mock',SUPABASE_SERVICE_ROLE_KEY:'mock',GEMINI_API_KEY:'mock',GEMINI_MODEL:'mock',GEMINI_SEARCH_ENABLED:'true',GEMINI_SEARCH_BILLING_APPROVED:'true'}})
  const origin = await listen(server)
  t.after(() => {server.close();upstream.close()})
  const call = (route,payload,cookie='op_access=mock') => fetch(origin + '/api/' + route,{method:'POST',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json'},body:JSON.stringify(payload)})
  assert.equal((await call('assistant',{message:prompts[0]},'')).status,401)
  const results = []
  for (const message of prompts) {
    const response = await call('assistant',{message,history:[{question:'I study IT.',answer:'What is your goal?'}]})
    assert.equal(response.status,200)
    const result = await response.json()
    assert.ok(result.answer.trim());results.push(result)
  }
  assert.equal(results[0].roadmap.goal,'cybersecurity')
  assert.equal(results[1].roadmap.goal,'AI engineering');assert.equal(results[1].roadmap.durationWeeks,26);assert.equal(results[1].roadmap.hours,10)
  assert.deepEqual(results[2].resources.map(item => item.provider),['Coursera','Udemy'])
  assert.ok(results[2].sources.length);assert.ok(results[2].suggestions)
  assert.ok(results[3].resources.every(item => !item.cost || /Free/.test(item.cost)))
  assert.equal(results[7].roadmap.goal,'AI engineering')
  assert.equal(results[8].roadmap.goal,'Python')
  assert.equal(results[9].tools[0].name,'search_opportunities')
  for (const message of prompts.filter(message=>parseLearningRequest(message).intent==='guidance')) {
    const input = inputs.find(item => item.message === message && item.history)
    assert.equal(input.history[0].question,'I study IT.')
    assert.ok(results[prompts.indexOf(message)].answer.includes(message))
  }
  const beforeDuplicates=claims
  const requestId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  const replies=await Promise.all([call('assistant',{message:'Explain DNS',requestId}),call('assistant',{message:'Explain DNS',requestId})])
  assert.ok(replies.every(reply=>reply.status===200))
  assert.equal(claims,beforeDuplicates+1)
  assert.equal((await call('assistant',{message:'Explain DHCP',requestId})).status,409)
  const beforePrivate=claims
  assert.equal((await call('assistant',{message:'My email is real@example.test'})).status,403)
  assert.equal((await call('assistant',{message:'Review my resume',attachment:{mime:'text/plain',data:btoa('private')}})).status,403)
  assert.equal((await call('learning/roadmap',{goal:'Python',level:'Beginner',hours:5,skills:'me@example.test',budget:'',useGemini:true})).status,403)
  assert.equal(claims,beforePrivate)
  quota = false
  assert.equal((await call('assistant',{message:'Hello'})).status,429)
  assert.equal((await call('learning/roadmap',{goal:'AI',level:'Beginner',hours:10,durationWeeks:26,skills:'',budget:'',useGemini:true})).status,429)
  assert.equal((await call('analyze',{resume:'A valid resume text.'})).status,403)
  assert.equal((await call('draft',{})).status,403)
  quota = true;failure = 'empty'
  assert.equal((await call('assistant',{message:'Explain subnetting'})).status,502)
  failure = 'quota'
  assert.equal((await call('assistant',{message:'Explain subnetting'})).status,429)
  assert.ok(claims >= 10)
})
