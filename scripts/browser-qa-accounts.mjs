if(process.env.PATH4U_QA_PUBLIC_KEY===undefined && process.env.PATH4U_QA_CLEANUP===undefined)process.exit(0)
if(process.env.VERCEL_ENV!=='preview')throw Error('QA_REQUIRES_PREVIEW')
import {randomUUID,randomBytes,publicEncrypt} from 'node:crypto'
const env=process.env
async function admin(path,method='GET',body){const r=await fetch(new URL('/auth/v1/admin/'+path,env.SUPABASE_URL),{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});const data=await r.json().catch(()=>null);if(!r.ok)throw Error('SYNTHETIC_QA_OPERATION_FAILED');return data}
if(env.PATH4U_QA_CLEANUP){
 const ids=env.PATH4U_QA_CLEANUP.split(',');if(ids.length>2 || ids.some(x=>!/^qa-[a-f0-9-]{36}:[a-f0-9-]{36}$/.test(x)))throw Error('INVALID_QA_CLEANUP')
 for(const value of ids){const [run,id]=value.split(':');const user=await admin('users/'+id);if(user.app_metadata?.path4u_qa_run!==run || !/^path4u\.browser\.qa\.[a-f0-9-]+@example\.test$/.test(user.email))throw Error('QA_OWNER_MARKER_MISMATCH');await admin('users/'+id,'DELETE');console.info(JSON.stringify({event:'browser_qa_cleanup',removed:true}))}
}
if(env.PATH4U_QA_PUBLIC_KEY){
 const key=Buffer.from(env.PATH4U_QA_PUBLIC_KEY,'base64').toString('utf8'),run='qa-'+randomUUID()
 const users=[]
 try{for(let n=0;n<2;n++){
  const email='path4u.browser.qa.'+randomUUID()+'@example.test',password=randomBytes(24).toString('base64url')
  const user=await admin('users','POST',{email,password,email_confirm:true,app_metadata:{age_requirement_met:true,age_policy_version:'my-18-v1',path4u_qa_run:run},user_metadata:{full_name:'Synthetic Browser Candidate'}})
  users.push(user.id)
  const encrypted=publicEncrypt({key,oaepHash:'sha256'},Buffer.from(JSON.stringify({id:user.id,email,password,run}))).toString('base64')
  console.info(JSON.stringify({event:'browser_qa_seed',index:n,encrypted}))
 }}catch(error){for(const id of users)await admin('users/'+id,'DELETE').catch(()=>{});throw error}
}
