import {test} from 'node:test'
import assert from 'node:assert/strict'
import {redisDataRequest} from '../server/redisData.mjs'
import {createOpenPathServer} from '../server/index.mjs'
const owner='bbbbbbbb-2222-4444-8888-012345678901'
const env={SUPABASE_URL:'https://identity.test',SUPABASE_ANON_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic',PATH4U_DATA_BACKEND:'redis',UPSTASH_REDIS_REST_URL:'https://synthetic.upstash.io',UPSTASH_REDIS_REST_TOKEN:'synthetic'}
test('replacement data verifies identity, email, eligibility and record owner before Redis access',async t=>{
 let verified=true,eligible=true,storeCalls=0
 t.mock.method(globalThis,'fetch',async url=>{
  if(String(url).includes('identity.test'))return Response.json({id:owner,email_confirmed_at:verified?'2026-11-11':null,app_metadata:{age_requirement_met:eligible}})
  storeCalls++;return Response.json({result:null})
 })
 const query='/rest/v1/openpath_profiles?user_id=eq.'+owner
 assert.deepEqual((await redisDataRequest(env,query,{token:'synthetic'})).data,[])
 assert.equal(storeCalls,1)
 await assert.rejects(redisDataRequest(env,'/rest/v1/openpath_profiles?user_id=eq.other',{token:'synthetic'}),{status:403})
 verified=false;await assert.rejects(redisDataRequest(env,query,{token:'synthetic'}),{status:403})
 verified=true;eligible=false;await assert.rejects(redisDataRequest(env,query,{token:'synthetic'}),{status:403})
 assert.equal(storeCalls,1)
})
test('replacement signup keeps provider verification and server age gate without SQL signup tickets',async t=>{
 const calls=[];const native=globalThis.fetch
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(!String(url).includes('identity.test'))return native(url,options)
  calls.push({path:new URL(url).pathname,body:options.body?JSON.parse(options.body):null})
  if(String(url).endsWith('/settings'))return Response.json({mailer_autoconfirm:false})
  if(new URL(url).pathname.endsWith('/signup'))return Response.json({user:{id:owner,email:'synthetic@example.test',identities:[{id:owner}],app_metadata:{provider:'email'}}})
  if(String(url).includes('/admin/users/'))return Response.json({id:owner})
  throw Error('Unexpected identity API')
 })
 const app=createOpenPathServer({env});const origin=await new Promise(resolve=>app.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+app.address().port)));t.after(()=>app.close())
 const signup=dob=>fetch(origin+'/api/auth/signup',{method:'POST',headers:{Origin:origin,'content-type':'application/json'},body:JSON.stringify({email:'synthetic@example.test',name:'Synthetic Candidate',password:'SyntheticOnly-Long-123',confirmation:'SyntheticOnly-Long-123',dob,terms:true,location:{country:'Malaysia',region:'Kuala Lumpur',city:'Kuala Lumpur'}})})
 const rejected=await signup('2015-01-01');assert.equal(rejected.status,400);assert.equal(calls.length,0)
 const accepted=await signup('2000-01-01');assert.equal(accepted.status,200);assert.equal((await accepted.json()).accepted,true)
 assert.ok(calls.every(call=>!call.path.startsWith('/rest/v1/')))
 const flag=calls.find(call=>call.path.includes('/admin/users/'));assert.equal(flag.body.app_metadata.age_requirement_met,true)
 assert.equal(calls.find(call=>call.path.endsWith('/signup')).body.data.openpath_age_ticket,undefined)
})
