import {aiLimits,utcQuotaWindow,providerQuotaWindow} from '../shared/aiQuota.mjs'
import {createHash,randomUUID} from 'node:crypto'
import {ApiError} from './integrations.mjs'
export function quotaError(code,message,resetAt){
 const error=new ApiError(429,message)
 error.code=code
 if(resetAt){error.resetAt=new Date(resetAt).toISOString();error.retryAfter=Math.max(1,Math.ceil((Date.parse(error.resetAt)-Date.now())/1000))}
 return error
}
async function admissionError(env,subject,guest,kind){
 const {day,resetAt}=utcQuotaWindow()
 const minute=new Date().toISOString().slice(0,16).replace('T','-').replace(':','-')
 const keys=['subject:'+day+':'+subject,'global:'+day,'minute:'+minute,...(kind==='roadmap'?['roadmap:'+day+':'+subject]:[])]
 const caps=[guest?aiLimits.guestDaily:aiLimits.accountDaily,aiLimits.globalDaily,aiLimits.globalMinute,...(kind==='roadmap'?[guest?1:aiLimits.accountRoadmaps]:[])]
 for(let i=0;i<keys.length;i++){
  const rows=await quotaStore(env,'path4u_ai_counters?key=eq.'+encodeURIComponent(keys[i])+'&select=used')
  if((rows?.[0]?.used || 0)<caps[i])continue
  if(i===2)return quotaError('app_minute_limit','Shared AI capacity is busy (4 interactions per minute). Please wait a minute before retrying.',(Math.floor(Date.now()/60000)+1)*60000)
  return quotaError(i===0?'session_daily_limit':i===1?'app_daily_limit':'roadmap_daily_limit',i===0?'Your daily AI allowance is used. It renews at 00:00 UTC (08:00 Malaysia time).':i===1?'Path4U’s shared daily AI allowance is used. It renews at 00:00 UTC (08:00 Malaysia time).':'Your daily roadmap allowance is used. It renews at 00:00 UTC (08:00 Malaysia time).',resetAt)
 }
 return quotaError('app_quota_limit','AI capacity is busy. Please retry shortly.',Date.now()+60000)
}
export const durableAI=env=>env.PATH4U_DATA_BACKEND==='supabase'
const uuid=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
export async function quotaStore(env,path,{method='GET',body,prefer}={}){
 let response
 try{response=await fetch(new URL('/rest/v1/'+path,env.SUPABASE_URL),{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error'})}catch{throw new ApiError(503,'AI usage storage could not be reached. No new Gemini call was started.')}
 const data=await response.json().catch(()=>null)
 if(!response.ok)throw new ApiError(503,'AI usage storage is unavailable. Other Path4U features remain available.')
 return data
}
// Deliberately closed list: no shared cache for conversations, goals, attachments or resumes.
export function publicCacheKey(input){
 if(input.attachment || input.goal || input.roadmapGoal || input.history?.length || input.action==='image')return null
 const message=typeof input.message==='string'?input.message.toLowerCase().trim().replace(/[.!?]+$/,'').replace(/\s+/g,' '):''
 if(!['hello','hi','what is python','explain python loops','what is cybersecurity','what is machine learning'].includes(message))return null
 return createHash('sha256').update('path4u-public-v1:'+message).digest('hex')
}
export async function withAIQuota(env,{subject,guest=false,requestId,input,kind='chat'},run){
 const id=requestId ?? randomUUID()
 if(!uuid.test(id))throw new ApiError(400,'Provide a valid request ID.')
 const publicKey=publicCacheKey(input)
 const cacheKey=publicKey?(guest?'guest:':'account:')+publicKey:null
 if(cacheKey){const rows=await quotaStore(env,'path4u_public_ai_cache?key=eq.'+cacheKey+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&select=value');if(rows?.[0])return {...rows[0].value,cached:true}}
 const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex')
 const claim=await quotaStore(env,'rpc/path4u_reserve_ai',{method:'POST',body:{p_subject:subject,p_request:id,p_fingerprint:fingerprint,p_kind:kind,p_guest:guest}})
 if(claim?.state==='conflict')throw new ApiError(409,'This request ID was already used for different content.')
 if(claim?.state==='duplicate'){
  if(claim.result?.failure)throw Object.assign(new ApiError(claim.result.status,claim.result.failure),{code:claim.result.code,resetAt:claim.result.resetAt,retryAfter:claim.result.resetAt?Math.max(1,Math.ceil((Date.parse(claim.result.resetAt)-Date.now())/1000)):claim.result.retryAfter})
  if(claim.result)return claim.result
  throw new ApiError(409,'This request was already accepted. Wait for the response; it will not start another Gemini call.')
 }
 if(claim?.state==='limited')throw await admissionError(env,subject,guest,kind)
 if(claim?.state!=='reserved')throw new ApiError(503,'AI usage could not be reserved. No Gemini request was started.')
 const target='path4u_ai_requests?subject=eq.'+encodeURIComponent(subject)+'&request_id=eq.'+id
 try{
  const result=await run(claim.remaining)
  // Result replay is isolated by server-established subject and expires after five minutes.
  await quotaStore(env,target,{method:'PATCH',body:{result,expires_at:new Date(Date.now()+300000).toISOString()}}).catch(()=>{})
  if(cacheKey)await quotaStore(env,'path4u_public_ai_cache?on_conflict=key',{method:'POST',body:{key:cacheKey,value:result,expires_at:new Date(Date.now()+86400000).toISOString()},prefer:'resolution=merge-duplicates'}).catch(()=>{})
  return result
 }catch(error){
  // Keep the accepted request reservation even when generation fails; rapid retry can't evade caps.
  if(error instanceof ApiError)await quotaStore(env,target,{method:'PATCH',body:{result:{failure:error.message,status:error.status,...(error.code?{code:error.code}:{}),...(error.resetAt?{resetAt:error.resetAt}:{}),...(error.retryAfter?{retryAfter:error.retryAfter}:{})}}}).catch(()=>{})
  throw error
 }
}
// Compare-and-swap counters use existing service-only tables; no schema change is needed.
export async function claimCounter(env,key,amount,cap){
 for(let attempt=0;attempt<4;attempt++){
  const rows=await quotaStore(env,'path4u_ai_counters?key=eq.'+encodeURIComponent(key)+'&select=used')
  const old=rows?.[0]
  if((old?.used || 0)+amount>cap)throw new ApiError(429,'Shared Gemini capacity is reserved for fair use. Retry later; your input and saved work are kept.')
  const change=old?await quotaStore(env,'path4u_ai_counters?key=eq.'+encodeURIComponent(key)+'&used=eq.'+old.used,{method:'PATCH',body:{used:old.used+amount},prefer:'return=representation'}):await quotaStore(env,'path4u_ai_counters?on_conflict=key',{method:'POST',body:{key,used:amount,expires_at:new Date(Date.now()+172800000).toISOString()},prefer:'resolution=ignore-duplicates,return=representation'})
  if(change?.length)return
 }
 throw new ApiError(429,'Several AI requests arrived together. Wait a few seconds before retrying.')
}
export async function reserveModelCall(env,body){
 if(!durableAI(env))return
 const {day:today,resetAt:providerReset}=providerQuotaWindow()
 const minute=new Date().toISOString().slice(0,16)
 // Conservative input estimate, not a claim of exact tokenizer accounting.
 const tokens=Math.ceil(Buffer.byteLength(typeof body==='string'?body:'')/2)+512
 // These are additional safety budgets, not substitutes for Google's project limits.
 for(const [key,amount,cap,code,message,reset] of [
  ['model:day:'+today,1,aiLimits.modelDaily,'provider_daily_budget','Path4U’s Gemini safety budget is used. It follows the Pacific day, so the 08:00 Malaysia app reset does not restore it.',providerReset],
  ['model:minute:'+minute,1,aiLimits.modelMinute,'provider_minute_budget','Gemini call safety capacity is busy. Please retry shortly.',(Math.floor(Date.now()/60000)+1)*60000],
  ['model:input:'+minute,tokens,aiLimits.modelInputMinute,'provider_input_budget','Gemini input safety capacity is busy. Please retry shortly.',(Math.floor(Date.now()/60000)+1)*60000],
 ]){
  try{await claimCounter(env,key,amount,cap)}catch(error){if(error.status===429)throw quotaError(code,message,reset);throw error}
 }
}
