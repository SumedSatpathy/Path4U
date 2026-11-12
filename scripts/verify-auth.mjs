// Opt-in remote integration checks. Synthetic credentials never leave this process or appear in logs.
if(process.env.PATH4U_VERIFY_AUTH!=='1')process.exit(0)
if(process.env.VERCEL_ENV!=='preview')throw Error('AUTH_QA_REQUIRES_PREVIEW')
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {createOpenPathServer} from '../server/index.mjs'
const env={...process.env,PATH4U_DATA_BACKEND:'supabase',PATH4U_SIGNUP_MODE:'server-attested'}
const app=createOpenPathServer({env})
const origin=await new Promise(resolve=>app.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+app.address().port)))
const users=[],passed=[]
async function auth(path,method='GET',body,token){
 const response=await fetch(new URL('/auth/v1/'+path,env.SUPABASE_URL),{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+(token||env.SUPABASE_SERVICE_ROLE_KEY),'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000),redirect:'error'})
 return {response,data:await response.json().catch(()=>null)}
}
const post=(path,body,cookie='')=>fetch(origin+'/api/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json'},body:JSON.stringify(body)})
const get=(path,cookie='')=>fetch(origin+'/api/'+path,{headers:{Cookie:cookie}})
const cookies=response=>response.headers.getSetCookie().filter(x=>!x.includes('Max-Age=0')).map(x=>x.split(';')[0]).join('; ')
const check=(name,condition)=>{assert.ok(condition,name);passed.push(name)}
try{
 const settings=await auth('settings');check('email confirmation enabled',settings.data.mailer_autoconfirm===false)
 const blocked=await post('auth/signup',{name:'QA',email:'qa@example.test',dob:'2018-01-01',terms:true,password:'OnlySynthetic-Long-123',confirmation:'OnlySynthetic-Long-123',location:{country:'Malaysia',region:'KL',city:'KL'}});check('underage signup blocked',blocked.status===400)
 for(let n=0;n<2;n++){
  const email='path4u.qa.'+randomUUID()+'@example.test',password=randomBytes(24).toString('base64url')
  const created=await auth('admin/users','POST',{email,password,email_confirm:true,app_metadata:{age_requirement_met:true,age_policy_version:'my-18-v1'},user_metadata:{full_name:'Synthetic QA Candidate'}})
  assert.equal(created.response.status,200,'synthetic Auth create status')
  users.push({id:created.data.id,email,password,cookie:''})
  const login=await post('auth/login',{email,password});check('user '+n+' password login',login.ok);users[n].cookie=cookies(login);users[n].token=users[n].cookie.match(/op_access=([^;]+)/)?.[1]
  const state=await login.json();check('missing profile routes to onboarding '+n,state.user.preferences===null)
  const onboard=await post('auth/onboarding',{organization:'Synthetic QA University',field:'Software',stage:'Student',interests:['AI'],skills:['Python'],goals:['Find internships']},users[n].cookie);check('profile persists '+n,onboard.ok)
  const session=await get('auth/session',users[n].cookie);check('session survives request refresh '+n,(await session.json()).user?.preferences?.organization==='Synthetic QA University')
  const workspace=await get('workspace',users[n].cookie);check('protected workspace loads '+n,workspace.ok)
 }
 const a=users[0],b=users[1]
 const next={saved:['qa:synthetic-saved-record'],plans:{},applications:{},profile:{name:'QA Candidate',stage:'Student',location:'KL',months:6},roadmaps:[{id:'qa-roadmap',goal:'Synthetic test only'}]}
 const saved=await post('workspace',{revision:-1,state:next},a.cookie);check('workspace save',saved.ok)
 const reload=await get('workspace',a.cookie);const data=await reload.json();check('saved roadmap and opportunity persist',data.state.saved[0]==='qa:synthetic-saved-record' && data.state.roadmaps[0].id==='qa-roadmap')
 const stale=await post('workspace',{revision:-1,state:next},a.cookie);check('concurrent revision protected',stale.status===409)
 const other=await get('workspace',b.cookie);check('other user workspace isolated',(await other.json()).state.saved.length===0)
 for(const table of ['openpath_profiles','openpath_workspace','openpath_library']){
  const response=await fetch(new URL('/rest/v1/'+table+'?user_id=eq.'+a.id,env.SUPABASE_URL),{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+b.token},signal:AbortSignal.timeout(10000)});check('direct RLS read isolated '+table,response.ok && (await response.json()).length===0)
 }
 const forbidden=await fetch(new URL('/rest/v1/openpath_workspace',env.SUPABASE_URL),{method:'POST',headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+b.token,'content-type':'application/json'},body:JSON.stringify({user_id:a.id,state:next,revision:1}),signal:AbortSignal.timeout(10000)});check('cross-owner insert blocked',forbidden.status===403 || forbidden.status===409)
 const wrong=await post('auth/login',{email:a.email,password:randomBytes(24).toString('hex')});check('wrong password rejected',wrong.status===400)
 const link=await auth('admin/generate_link','POST',{type:'recovery',email:a.email});check('real recovery token generated',link.response.ok && Boolean(link.data.hashed_token))
 const verified=await post('auth/verify',{type:'recovery',token:link.data.hashed_token});check('recovery token exchanges to restricted cookie',verified.ok && (await verified.json()).recovery===true)
 const recovery=cookies(verified),password=randomBytes(24).toString('base64url')
 const reset=await post('auth/reset',{password,confirmation:password},recovery);check('password reset completed',reset.ok)
 const loginAgain=await post('auth/login',{email:a.email,password});check('new password signs in',loginAgain.ok);a.cookie=cookies(loginAgain)
 const out=await post('auth/logout',{},a.cookie);check('logout clears cookies',out.ok && out.headers.getSetCookie().filter(x=>x.includes('Max-Age=0')).length>=3)
 check('signed-out protected access rejected',(await get('workspace')).status===401)
 console.info(JSON.stringify({event:'auth_integration_audit',passed,passedCount:passed.length,mailDelivery:'Not tested by admin-generated links; real inbox verification still required.'}))
}catch(error){console.error(JSON.stringify({event:'auth_integration_audit',passed,failed:true,reason:error instanceof assert.AssertionError?error.message:'REMOTE_AUTH_QA_FAILED'}));process.exitCode=1}
finally{
 for(const user of users){await auth('logout?scope=global','POST',undefined,user.token).catch(()=>{});const removed=await auth('admin/users/'+encodeURIComponent(user.id),'DELETE');console.info(JSON.stringify({event:'synthetic_auth_cleanup',removed:removed.response.ok}))}
 await new Promise(resolve=>app.close(resolve))
}
