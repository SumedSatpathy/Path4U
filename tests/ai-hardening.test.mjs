import {test} from 'node:test'
import assert from 'node:assert/strict'
import {reviewResume} from '../shared/resume.mjs'
import {geminiConfig} from '../server/geminiConfig.mjs'
import {generate,requestJson,analyzeResume,draftMaterials} from '../server/integrations.mjs'
import {containsPersonalData,privateAIAllowed} from '../server/aiPrivacy.mjs'
import {parseLearningRequest} from '../shared/intent.mjs'
import {research} from '../server/research.mjs'
const strong=`Jamie Lee
jamie@example.test
Education
BSc Computer Science, Example University
Projects
Built an accessible React dashboard with TypeScript.
Designed HTML and CSS components for a student society.
Implemented Git workflows and accessibility checks.
Skills
React, JavaScript, TypeScript, HTML, CSS, Git, accessibility
Summary
Student building practical web applications.`
const weak='Jamie Lee\nI want a technology role.\nI am enthusiastic and ready to learn.'
test('strong student resume earns evidence-based points without professional employment',()=>{
 const result=reviewResume(strong,'Frontend Developer')
 assert.ok(result.score>=8)
 assert.deepEqual(result.rubric.map(item=>item.weight),[15,25,25,20,15])
 assert.equal(result.rubric[2].score,10)
 assert.ok(result.rubric.every(item=>item.evidence.every(quote=>strong.includes(quote))))
 assert.equal(result.missingInfo.length,0)
 assert.equal(result.rubric[2].score>reviewResume(strong,'Frontend Developer','','Experienced professional').rubric[2].score,true)
})
test('weak student resume receives lower score and concrete missing information',()=>{
 const result=reviewResume(weak,'Frontend Developer')
 assert.ok(result.score<reviewResume(strong,'Frontend Developer').score)
 assert.ok(result.missingInfo.includes('A valid contact email'))
 assert.ok(result.missingInfo.includes('Projects or experience'))
})
test('missing sections and invalid contact details reduce only observable criteria',()=>{
 const missing=reviewResume('Jamie Lee\njamie@example.test\nReact, HTML, CSS','Frontend Developer')
 assert.ok(missing.missingInfo.includes('An Education section'))
 const invalid=reviewResume(strong.replace('jamie@example.test','jamie@invalid'),'Frontend Developer')
 assert.ok(invalid.missingInfo.includes('A valid contact email'))
 assert.ok(invalid.rubric[0].score<reviewResume(strong,'Frontend Developer').rubric[0].score)
})
test('job alignment considers the provided description and scoring repeats exactly',()=>{
 const aligned=reviewResume(strong,'Frontend Developer','React TypeScript HTML CSS accessibility')
 const unrelated=reviewResume(strong,'Frontend Developer','Terraform Kubernetes incident SIEM Azure')
 assert.ok(aligned.rubric[3].score>unrelated.rubric[3].score)
 assert.deepEqual(aligned,reviewResume(strong,'Frontend Developer','React TypeScript HTML CSS accessibility'))
 assert.equal(reviewResume('','Frontend Developer').score,0)
 assert.ok(aligned.edits.every(edit=>!edit.after.includes('increased revenue')))
})
test('model config requires no redundant model setting and fails closed on costs and private data',async t=>{
 const env={GEMINI_API_KEY:'mock'}
 assert.equal(geminiConfig(env).model,'gemini-3.1-flash-lite')
 assert.equal(geminiConfig(env).configured,true)
 assert.equal(geminiConfig({...env,GEMINI_SEARCH_ENABLED:'true'}).search,false)
 assert.equal(geminiConfig({...env,GEMINI_SEARCH_ENABLED:'true',GEMINI_SEARCH_BILLING_APPROVED:'true'}).search,true)
 assert.equal(privateAIAllowed(env,true),false)
 assert.equal(privateAIAllowed({...env,GEMINI_PRIVATE_DATA_APPROVED:'true',GEMINI_DATA_PROCESSING_REFERENCE:'reviewed-policy'},false),false)
 assert.equal(containsPersonalData({skills:'person@example.test'}),true)
 assert.equal(containsPersonalData('Explain networking'),false)
 const mock=t.mock.method(globalThis,'fetch',()=>{throw Error('Should not call upstream')})
 await assert.rejects(analyzeResume({resume:strong,privateDataConsent:true},env),{status:403})
 await assert.rejects(draftMaterials({name:'Jamie',privateDataConsent:true},env),{status:403})
 const result=await research('Find upcoming hackathons',env)
 assert.equal(result.state,'unavailable')
 assert.equal(mock.mock.callCount(),0)
})
test('provider errors distinguish invalid key, model access, quota and malformed or truncated responses',async t=>{
 const env={GEMINI_API_KEY:'mock'}
 let response=new Response('',{status:429})
 const mock=t.mock.method(globalThis,'fetch',async()=>response)
 await assert.rejects(generate(env,'Prompt',{},{}),{status:429})
 response=Response.json({error:{details:[{reason:'API_KEY_INVALID'}]}},{status:400})
 await assert.rejects(generate(env,'Prompt',{},{}),{status:503})
 response=new Response('',{status:404})
 await assert.rejects(generate(env,'Prompt',{},{}),{status:503})
 response=Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"answer":"partial"}'}]}}]})
 await assert.rejects(generate(env,'Prompt',{},{}),{status:502})
 response=Response.json({candidates:[{content:{parts:[{thought:true,text:'hidden'},{text:'{"answer":"A response"}'}]}}]})
 assert.equal((await generate(env,'Prompt',{},{})).answer,'A response')
 mock.mock.restore()
 t.mock.method(globalThis,'fetch',async()=>{throw new DOMException('Timed out','TimeoutError')})
 await assert.rejects(requestJson('https://example.test',{},'Gemini',1),{status:504})
})
test('the exact requested roadmap topics and duration are preserved',()=>{
 assert.equal(parseLearningRequest('Build a beginner AI engineering roadmap.').goal,'AI engineering')
 assert.equal(parseLearningRequest('Create a study plan for learning Python.').goal,'Python')
 assert.equal(parseLearningRequest('Create a 6-month cybersecurity roadmap.').durationWeeks,26)
})

test('stored opportunity search applies category, country, experience and topic filters without inventing dates',async t=>{
 const {executeCareerTool,routeCareerRequest}=await import('../server/careerTools.mjs')
 const rows=[
 {listing:{title:'Python beginner hackathon',organization:'Synthetic University',location:'Malaysia',category:'Hackathon',level:'Beginner',sourceUrl:'https://example.test/official'},deadline_at:null,verified_at:null},
 {listing:{title:'Python advanced hackathon',organization:'Synthetic University',location:'Malaysia',category:'Hackathon',level:'Advanced',sourceUrl:'https://example.test/advanced'},deadline_at:'2099-01-01T00:00:00Z'},
 {listing:{title:'Python beginner hackathon',organization:'Synthetic University',location:'Singapore',category:'Hackathon',level:'Beginner',sourceUrl:'https://example.test/other'},deadline_at:null},
 {listing:{title:'Python beginner hackathon',organization:'Synthetic University',location:'Malaysia',category:'Hackathon',level:'Beginner',sourceUrl:'https://example.test/past'},deadline_at:'2000-01-01T00:00:00Z'},
 ]
 t.mock.method(globalThis,'fetch',async url=>{assert.match(String(url),/\/rest\/v1\/openpath_opportunities/);return Response.json(rows)})
 const env={SUPABASE_URL:'https://synthetic.test',SUPABASE_ANON_KEY:'mock',GEMINI_API_KEY:'mock'}
 const result=await executeCareerTool('search_opportunities',{query:'Python',location:'Malaysia',category:'Hackathon',experience:'Beginner'},{message:'Find Python hackathons',history:[]},env,{token:'synthetic'})
 assert.equal(result.results.length,1)
 assert.equal(result.results[0].deadline,null)
 assert.equal(result.results[0].verifiedAt,null)
 assert.match(result.scope,/not evidence of open/)
 const routed=await routeCareerRequest({message:'Find beginner Python hackathons in Malaysia.',history:[]},env,{token:'synthetic'})
 assert.equal(routed.output.results.length,1)
 assert.match(routed.output.scope,/Live research is not enabled/)
})

test('Gemini retries one explicit upstream 503, while other failures retain their status',async t=>{
 let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;return calls===1?new Response('',{status:503}):Response.json({answer:'Recovered'})})
 assert.deepEqual(await requestJson('https://example.test',{},'Gemini'),{answer:'Recovered'})
 assert.equal(calls,2)
})
