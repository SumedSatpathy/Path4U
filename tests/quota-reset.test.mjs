import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHmac} from 'node:crypto'
import {durableDemoRequest} from '../server/durableDemo.mjs'
import {reserveModelCall,withAIQuota} from '../server/aiQuota.mjs'
import {utcQuotaWindow,mergeDemoBalance,providerQuotaWindow} from '../shared/aiQuota.mjs'
import {quotaFixture} from './fixtures/quota-store.mjs'
const origin='https://preview.example.test',ip='203.0.113.4'
const roadmap={goal:'Cybersecurity',level:'Beginner',hours:5,durationWeeks:12,skills:'',budget:'Free',preferences:''}
function guest(f,cookie='',address=ip){
 return {async call(action,payload={}){
  return durableDemoRequest(action,{requestId:randomUUID(),...payload},{headers:{cookie,'x-vercel-forwarded-for':address}},{setHeader:(k,v)=>{cookie=v.split(';')[0]}},f.env,origin,true)
 },get cookie(){return cookie}}
}
test('all three generators exhaust the same four interactions, then recover at exactly UTC midnight without changing cookies',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-13T23:59:00Z')})
 const f=quotaFixture(t),g=guest(f)
 const s=await g.call('session');assert.equal(s.credits,4);assert.equal(s.quota.resetAt,'2026-11-14T00:00:00.000Z')
 for(const action of ['roadmap','roadmap','mindMap','assistant']){
  const r=await g.call(action,action==='roadmap'?roadmap:action==='mindMap'?{topic:'Cybersecurity'}:{message:'Explain TLS certificate trust'})
  assert.equal(r.result.source ?? r.result.artifact,action==='assistant'?'text':'gemini')
 }
 assert.equal((await g.call('session')).credits,0)
 const calls=f.calls.length,cookie=g.cookie
 for(const action of ['roadmap','mindMap','assistant'])await assert.rejects(g.call(action,action==='roadmap'?roadmap:action==='mindMap'?{topic:'Cybersecurity'}:{message:'Explain access controls'}),e=>e.code==='session_daily_limit' && e.resetAt==='2026-11-14T00:00:00.000Z')
 assert.equal(f.calls.length,calls)
 t.mock.timers.setTime(Date.parse('2026-11-14T00:00:00Z'))
 assert.equal((await g.call('session')).credits,4);assert.equal(g.cookie,cookie)
 for(const action of ['roadmap','roadmap','mindMap'])assert.ok((await g.call(action,action==='roadmap'?roadmap:{topic:'Cybersecurity'})).result)
 assert.equal(f.calls.length,calls+3);assert.equal((await g.call('session')).credits,1)
})
test('same Wi-Fi judges have independent balances, changed networks retain identity, and only excessive minting is throttled briefly',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-13T10:00:00Z')})
 const f=quotaFixture(t),judges=[]
 for(let i=0;i<120;i++){const g=guest(f);assert.equal((await g.call('session')).credits,4);judges.push(g)}
 assert.equal(new Set(judges.map(g=>g.cookie)).size,120)
 await assert.rejects(guest(f).call('session'),e=>e.code==='session_creation_rate' && e.retryAfter===600)
 await judges[0].call('mindMap',{topic:'Cybersecurity'})
 assert.equal((await judges[0].call('session')).credits,3)
 assert.equal((await judges[1].call('session')).credits,4)
 assert.equal((await guest(f,judges[0].cookie,'198.51.100.20').call('session')).credits,3)
 assert.ok(![...f.counters.keys()].some(key=>/^guest:(sessions|network):/.test(key)))
 t.mock.timers.setTime(Date.now()+600000);assert.equal((await guest(f).call('session')).credits,4)
 const expired=guest(f,judges[0].cookie);t.mock.timers.setTime(Date.now()+86400000)
 await assert.rejects(expired.call('mindMap',{topic:'Security'}),{status:401})
})
test('global minute/day limits remain atomic across sessions and app day changes do not reset Pacific provider budget',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-13T23:59:00Z')})
 const f=quotaFixture(t),judges=[]
 for(let i=0;i<5;i++){const g=guest(f);await g.call('session');judges.push(g)}
 await Promise.all(judges.slice(0,4).map(g=>g.call('mindMap',{topic:'Security'})))
 const count=f.calls.length
 await assert.rejects(judges[4].call('mindMap',{topic:'Security'}),e=>e.code==='app_minute_limit' && e.retryAfter===60)
 assert.equal(f.calls.length,count)
 t.mock.timers.setTime(Date.now()+60000)
 await judges[4].call('mindMap',{topic:'Security'})
 f.counters.set('global:2026-11-14',80)
 await assert.rejects(judges[0].call('mindMap',{topic:'Security'}),{code:'app_daily_limit'})
 f.counters.set('model:day:2026-11-13',400)
 await assert.rejects(reserveModelCall(f.env,'short'),{code:'provider_daily_budget'})
 t.mock.timers.setTime(Date.parse('2026-11-14T08:00:00Z'))
 await reserveModelCall(f.env,'short');assert.equal(f.counters.get('model:day:2026-11-14'),1)
})
test('provider errors, input budgets, malformed maps and storage outages fail closed; replays do not charge twice',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-13T12:00:00Z')})
 const f=quotaFixture(t),g=guest(f);await g.call('session')
 const requestId=randomUUID(),r=await g.call('mindMap',{topic:'Security',requestId})
 const repeat=await g.call('mindMap',{topic:'Security',requestId});assert.deepEqual(repeat.result,r.result);assert.equal(repeat.credits,3);assert.equal(f.calls.length,1)
 await assert.rejects(g.call('mindMap',{topic:'Other',requestId}),{status:409})
 f.providerStatus(429);await assert.rejects(g.call('mindMap',{topic:'Security'}),{code:'gemini_provider_limit',retryAfter:20})
 assert.equal((await g.call('session')).credits,2)
 f.providerStatus(200);f.invalidMap(true);await assert.rejects(g.call('mindMap',{topic:'Security'}),{status:502})
 f.storageDown(true);const calls=f.calls.length;await assert.rejects(g.call('mindMap',{topic:'Security'}),{status:503});assert.equal(f.calls.length,calls)
 f.storageDown(false);f.counters.set('model:input:2026-11-13T12:00',200000);await assert.rejects(reserveModelCall(f.env,'text'),{code:'provider_input_budget'})
 f.counters.set('model:minute:2026-11-13T12:00',10);await assert.rejects(reserveModelCall(f.env,'text'),{code:'provider_minute_budget'})
})
test('legacy cookie upgrade preserves consumed allowance and client balances accept new days without stale response rollback',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-13T23:59:59Z')})
 const f=quotaFixture(t),id=randomUUID(),bucket=createHmac('sha256','synthetic').update(ip).digest('hex'),signature=createHmac('sha256','synthetic').update(id+':'+bucket).digest('base64url')
 f.counters.set('subject:2026-11-13:guest:'+id,4)
 const g=guest(f,'path4u_live='+id+'.'+signature)
 const old=await g.call('session');assert.equal(old.credits,0);assert.match(g.cookie,/path4u_live=v2\./)
 t.mock.timers.setTime(Date.now()+1000);const fresh=await g.call('session')
 assert.equal(mergeDemoBalance(old,fresh).credits,4);assert.equal(mergeDemoBalance(fresh,old).credits,4)
 const other=await guest(f).call('session');assert.equal(mergeDemoBalance({...fresh,credits:0},other).credits,4)
 assert.equal(utcQuotaWindow(Date.parse('2026-12-31T23:59:59Z')).resetAt,'2027-01-01T00:00:00.000Z')
})

test('Pacific provider reset follows daylight saving independently of the UTC app reset',()=>{
 assert.equal(providerQuotaWindow(Date.parse('2026-11-14T00:00:00Z')).resetAt,'2026-11-14T08:00:00.000Z')
 assert.equal(providerQuotaWindow(Date.parse('2026-07-14T00:00:00Z')).resetAt,'2026-07-14T07:00:00.000Z')
 assert.equal(providerQuotaWindow(Date.parse('2026-03-08T08:00:00Z')).resetAt,'2026-03-09T07:00:00.000Z')
 assert.equal(providerQuotaWindow(Date.parse('2026-11-01T07:00:00Z')).resetAt,'2026-11-02T08:00:00.000Z')
})

test('an exhausted global app day renews at UTC midnight, while a valid future-dated cookie is still rejected',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-13T23:59:59Z')})
 const f=quotaFixture(t),g=guest(f);await g.call('session')
 f.counters.set('global:2026-11-13',80)
 await assert.rejects(g.call('mindMap',{topic:'Security'}),{code:'app_daily_limit'});assert.equal(f.calls.length,0)
 t.mock.timers.setTime(Date.parse('2026-11-14T00:00:00Z'))
 await g.call('mindMap',{topic:'Security'});assert.equal(f.calls.length,1)
 const id=randomUUID(),issued=Math.floor(Date.now()/1000)+60,signature=createHmac('sha256','synthetic').update('guest-v2:'+id+':'+issued).digest('base64url')
 await assert.rejects(guest(f,'path4u_live=v2.'+id+'.'+issued+'.'+signature).call('mindMap',{topic:'Security'}),{status:401})
})
