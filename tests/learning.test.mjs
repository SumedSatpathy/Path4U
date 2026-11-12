import { test } from 'node:test'
import assert from 'node:assert/strict'
import { learningInput, runLearning } from '../server/learning.mjs'
import { validateRoadmap } from '../server/roadmaps.mjs'
import { parseLearningRequest } from '../shared/intent.mjs'
import { groundingResult, research, researchedCourses } from '../server/research.mjs'
import { roadmapFixture } from './fixtures/roadmap.mjs'

test('roadmap goal, level and time survive natural language and multi-turn changes', () => {
  assert.equal(parseLearningRequest('Create a cybersecurity roadmap for a complete beginner.').goal, 'cybersecurity')
  const ai = parseLearningRequest('Build a 6-month AI engineering roadmap with 10 study hours per week.')
  assert.equal(ai.goal, 'AI engineering'); assert.equal(ai.durationWeeks,26); assert.equal(ai.hours,10)
  assert.equal(parseLearningRequest('Create a 3-month Python study plan.').goal,'Python')
  assert.equal(parseLearningRequest('Build a roadmap for React').goal,'React')
  const revised = parseLearningRequest('Make it 8 hours per week.', [{question:'Build a 6-month AI engineering roadmap with 10 study hours per week.'}])
  assert.equal(revised.goal,'AI engineering'); assert.equal(revised.hours,8); assert.equal(revised.durationWeeks,26)
})

test('personalized roadmap schema rejects invented resources and unrealistic hours', async t => {
  const input = learningInput('roadmap', { goal:'Web development',level:'Beginner',hours:4,skills:'HTML',budget:'Free',durationWeeks:12,preferences:'Hands-on' })
  const fixture = roadmapFixture(input)
  fixture.milestones[0].resourceIds = ['mdn']
  let output = fixture
  const mock = t.mock.method(globalThis,'fetch',async (url,options) => {
    assert.match(url,/^https:\/\/generativelanguage.googleapis.com\//)
    const payload = JSON.parse(options.body)
    assert.equal(JSON.parse(payload.contents[0].parts[0].text).preferences,'Hands-on')
    assert.ok(payload.generationConfig.responseSchema.properties.milestones)
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]})
  })
  const env = {GEMINI_API_KEY:'mock',GEMINI_MODEL:'mock'}
  const result = await runLearning('roadmap',input,env,true)
  assert.equal(result.goal,'Web development'); assert.equal(result.source,'gemini')
  assert.equal(result.milestones[0].lessons[0].done,false); assert.equal(result.milestones[0].resource,'mdn')
  assert.equal(result.research.state,'unavailable'); assert.equal(mock.mock.callCount(),1)
  output = structuredClone(fixture); output.milestones[0].resourceIds = ['https://invented.example/course']
  await assert.rejects(runLearning('roadmap',input,env,true),{status:502})
  const invalid = structuredClone(fixture); invalid.milestones[0].hours = 900
  assert.throws(() => validateRoadmap(invalid,input),{status:502})
  assert.throws(() => learningInput('roadmap',{...input,durationWeeks:0}),{status:400})
  await assert.rejects(runLearning('roadmap',input,{},true),/Gemini is unavailable/)
})

test('grounding uses only supported segments and real metadata links; unavailable research stays honest', async t => {
  const supported = 'Read the official course prerequisites.'
  const result = groundingResult({candidates:[{content:{parts:[{text:supported + ' UNSUPPORTED PRICE $5'}]},groundingMetadata:{groundingChunks:[{web:{title:'Official page',uri:'https://www.coursera.org/learn/example'}}],groundingSupports:[{segment:{text:supported},groundingChunkIndices:[0]}],searchEntryPoint:{renderedContent:'<div>Search suggestions</div>'}}}]})
  assert.equal(result.answer,supported); assert.doesNotMatch(result.answer,/PRICE/)
  assert.equal(result.sources.length,1); assert.match(result.suggestions,/Search/)
  const discovered = researchedCourses({sources:[...result.sources,{title:'Redirect',url:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/opaque'},{title:'Untrusted',url:'https://coursera.org.evil.example/learn/fake'}]},'Python')
  assert.equal(discovered.length,1)
  assert.equal(discovered[0].provider,'Coursera')
  assert.match(discovered[0].cost,/Check provider/)
  assert.throws(() => groundingResult({candidates:[{content:{parts:[{text:'No citations'}]}}]}),{status:502})
  t.mock.method(globalThis,'fetch',async () => new Response('',{status:429}))
  assert.equal((await research('Python', {GEMINI_API_KEY:'mock',GEMINI_MODEL:'mock',GEMINI_SEARCH_ENABLED:'true'})).state,'unavailable')
})
