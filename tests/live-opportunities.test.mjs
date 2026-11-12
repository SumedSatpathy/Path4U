import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mapGreenhouse,mapHackalendar,mapSmartRecruiters,normalizeOpportunityURL,getOpportunityCatalog} from '../server/feed.mjs'
import {publicCacheKey,withAIQuota,reserveModelCall} from '../server/aiQuota.mjs'

test('live opportunity normalization keeps unknown facts unknown and rejects unsafe or closed records',()=>{
 const now='2026-11-12T08:00:00Z'
 const jobs=mapGreenhouse('approved','Employer',{jobs:[{id:42,internal_job_id:8,title:'Software Intern',absolute_url:'https://boards.greenhouse.io/approved/jobs/42?utm_source=test&gh_jid=42',content:'<p>Python&nbsp;and React</p>'},{id:43,internal_job_id:null,title:'Prospect',absolute_url:'https://boards.greenhouse.io/approved/jobs/43'},{id:44,title:'Bad source',absolute_url:'javascript:alert(1)'}]},now)
 assert.equal(jobs.length,1);assert.equal(jobs[0].status,'Verified Open');assert.equal(jobs[0].category,'Internship');assert.equal(jobs[0].deadline,'');assert.equal(jobs[0].format,'Not stated');assert.deepEqual(jobs[0].skills,['Python','React']);assert.equal(jobs[0].summary,'Python and React');assert.equal(jobs[0].durationMonths,-1)
 assert.equal(normalizeOpportunityURL('http://example.com'),'');assert.equal(normalizeOpportunityURL('https://user:secret@example.com'),'')
 const events=mapHackalendar({data:[{id:'event-1',name:'Public Hackathon',registrationUrl:'https://organizer.example/event',startAt:'2026-12-01',description:'Actual event',status:'published'},{id:'old',name:'Past',registrationUrl:'https://organizer.example/past',startAt:'2026-01-01',endAt:'2026-01-02'}]},now)
 assert.equal(events.length,1);assert.equal(events[0].status,'Status Unverified');assert.equal(events[0].verified,false);assert.equal(events[0].deadline,'');assert.equal(events[0].fees,undefined);assert.equal(events[0].organization,'Organizer not stated')
 assert.deepEqual(mapSmartRecruiters({active:false,applyUrl:'https://jobs.smartrecruiters.com/Grab/1'},now),[])
})
test('a failed provider cannot replace real feed results with fixtures and successful sources are cached',async t=>{
 let calls=0
 t.mock.method(globalThis,'fetch',async url=>{
  calls++;const u=new URL(url)
  if(u.hostname==='api.smartrecruiters.com')return Response.json({content:[],totalFound:0})
  if(u.hostname==='hackalendar.com')return Response.json({data:[],meta:{hasMore:false}})
  if(u.pathname.includes('/unavailable'))return new Response('unavailable',{status:503})
  if(u.pathname.endsWith('/jobs'))return Response.json({jobs:[{id:1,internal_job_id:1,title:'Real feed result',absolute_url:'https://boards.greenhouse.io/testboard/jobs/1'}]})
  return Response.json({name:'Employer'})
 })
 const env={OPENPATH_GREENHOUSE_BOARDS:'testboard,unavailable'}
 const first=await getOpportunityCatalog(env);assert.equal(first.opportunities.length,1);assert.ok(first.providers.find(x=>x.name==='greenhouse:unavailable').error)
 const before=calls;const next=await getOpportunityCatalog({OPENPATH_GREENHOUSE_BOARDS:'testboard'});assert.equal(next.opportunities[0].id,'greenhouse:testboard:1');assert.equal(calls,before)
 const current=Date.now()
 t.mock.method(Date,'now',()=>current+7*3600000)
 t.mock.method(globalThis,'fetch',async()=>new Response('unavailable',{status:503}))
 const outage=await getOpportunityCatalog({OPENPATH_GREENHOUSE_BOARDS:'testboard'})
 assert.equal(outage.opportunities[0].id,'greenhouse:testboard:1');assert.equal(outage.opportunities[0].cached,true)
 t.mock.method(Date,'now',()=>current+48*3600000)
 const old=await getOpportunityCatalog({OPENPATH_GREENHOUSE_BOARDS:'testboard'})
 assert.equal(old.opportunities[0].status,'Status Unverified');assert.equal(old.opportunities[0].verified,false)
})
test('public AI caching excludes private contexts and durable reservation handles duplicate and limit states',async t=>{
 assert.ok(publicCacheKey({message:'Explain Python loops.'}));assert.equal(publicCacheKey({message:'Hello',history:[{question:'my name',answer:'Private'}]}),null);assert.equal(publicCacheKey({message:'Hello',goal:'Private goal'}),null);assert.equal(publicCacheKey({message:'Review my resume'}),null)
 let state='limited',runs=0
 t.mock.method(globalThis,'fetch',async()=>Response.json({state}))
 const env={SUPABASE_URL:'https://synthetic.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic',PATH4U_DATA_BACKEND:'supabase'}
 const args={subject:'account:synthetic',requestId:'11111111-2222-4333-8444-555555555555',input:{message:'Explain Java interfaces'}}
 await assert.rejects(withAIQuota(env,args,()=>{runs++}),{status:429});assert.equal(runs,0)
 state='duplicate';await assert.rejects(withAIQuota(env,args,()=>{runs++}),{status:409});assert.equal(runs,0)
 state='reserved';const result=await withAIQuota(env,args,async()=>{runs++;return {answer:'Actual provider output'}});assert.equal(result.answer,'Actual provider output');assert.equal(runs,1)
})
test('Gemini call budgets count actual attempts with atomic compare-and-swap and preserve provider limits',async t=>{
 let count=0
 t.mock.method(globalThis,'fetch',async(_url,init)=>{
  if(init.method==='GET')return Response.json([])
  count++;return Response.json([{used:1}])
 })
 const env={SUPABASE_URL:'https://synthetic.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic',PATH4U_DATA_BACKEND:'supabase'}
 await reserveModelCall(env,'A short synthetic prompt');assert.equal(count,3)
 t.mock.method(globalThis,'fetch',async()=>Response.json([{used:400}]))
 await assert.rejects(reserveModelCall(env,'Another prompt'),{status:429})
})

test('durable guests on the same network receive separate signed sessions; forged cookies are rejected',async t=>{
 const {demoRequest}=await import('../server/demo.mjs')
 const calls=[]
 t.mock.method(globalThis,'fetch',async(url,init)=>{calls.push(new URL(url).pathname);return Response.json(init.method==='GET'?[]:[{used:1}])})
 const env={SUPABASE_URL:'https://synthetic.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic',PATH4U_DATA_BACKEND:'supabase',PATH4U_DEMO_BACKEND:'supabase',GEMINI_API_KEY:'synthetic'}
 const request={headers:{'x-vercel-forwarded-for':'203.0.113.1'}}
 let a,b
 const first=await demoRequest('session',{},request,{setHeader:(_k,v)=>{a=v}},env,'https://preview.example',true)
 const second=await demoRequest('session',{},request,{setHeader:(_k,v)=>{b=v}},env,'https://preview.example',true)
 assert.equal(first.credits,4);assert.equal(second.credits,4);assert.notEqual(a,b);assert.match(a,/HttpOnly; SameSite=Lax/)
 assert.ok(calls.every(x=>x.includes('path4u_ai_counters')))
 const forged=a.split(';')[0].replace(/\.[a-zA-Z0-9_-]{43}$/,'.'+'x'.repeat(43))
 await assert.rejects(demoRequest('assistant',{message:'Hello',requestId:'11111111-2222-4333-8444-555555555555'},{headers:{...request.headers,cookie:forged}},{},env,'https://preview.example',true),{status:401})
})

test('session mint abuse throttle uses a short window without creating a fake session',async t=>{
 const {demoRequest}=await import('../server/demo.mjs')
 const calls=[]
 t.mock.method(globalThis,'fetch',async(url)=>{calls.push(String(url));return Response.json([{used:120}])})
 const env={SUPABASE_URL:'https://synthetic.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic',PATH4U_DATA_BACKEND:'supabase',PATH4U_DEMO_BACKEND:'supabase',DEMO_ONLY_MODE:'true'}
 let wroteCookie=false
 await assert.rejects(demoRequest('session',{}, {headers:{'x-vercel-forwarded-for':'203.0.113.1'}}, {setHeader:()=>{wroteCookie=true}},env,'https://preview.example',true),error=>error.status===429 && error.code==='session_creation_rate' && error.retryAfter<=600 && !/sign in/i.test(error.message))
 assert.equal(wroteCookie,false)
 assert.equal(calls.length,1)
 assert.ok(calls[0].includes('path4u_ai_counters'))
})
