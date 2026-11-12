import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto'
import {ApiError} from './integrations.mjs'
import {containsPersonalData} from './aiPrivacy.mjs'
import {learningInput} from './learning.mjs'
import {generateLiveResult} from './liveDemo.mjs'
import {quotaStore,withAIQuota,claimCounter,quotaError} from './aiQuota.mjs'
import {aiLimits,utcQuotaWindow} from '../shared/aiQuota.mjs'
const equal=(a,b)=>/^[a-zA-Z0-9_-]{43}$/.test(a || '') && timingSafeEqual(Buffer.from(a),Buffer.from(b))
const uuid=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
export async function durableDemoRequest(path,input,request,response,env,origin,hosted){
 if(!env.SUPABASE_SERVICE_ROLE_KEY)throw new ApiError(503,'AI usage storage is not configured.')
 const hmac=text=>createHmac('sha256',env.SUPABASE_SERVICE_ROLE_KEY).update(text).digest('base64url')
 const address=(hosted?request.headers['x-vercel-forwarded-for']:request.socket?.remoteAddress)?.split(',')[0]?.trim()
 const bucket=address?createHmac('sha256',env.SUPABASE_SERVICE_ROLE_KEY).update(address).digest('hex'):null
 const value=(request.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('path4u_live='))?.slice(12)
 const parts=String(value || '').split('.')
 const now=Math.floor(Date.now()/1000)
 let id=null,issued=null,upgrade=false
 if(parts.length===4 && parts[0]==='v2' && uuid.test(parts[1]) && /^\d{10}$/.test(parts[2])){
  const time=Number(parts[2])
  if(time<=now && now-time<86400 && equal(parts[3],hmac('guest-v2:'+parts[1]+':'+parts[2]))){id=parts[1];issued=time}
 }else if(parts.length===2 && bucket && uuid.test(parts[0]) && equal(parts[1],hmac(parts[0]+':'+bucket))){
  // Upgrade old cookies without resetting their already consumed allowance.
  id=parts[0];issued=now;upgrade=true
 }
 function setCookie(){response.setHeader('Set-Cookie','path4u_live=v2.'+id+'.'+issued+'.'+hmac('guest-v2:'+id+':'+issued)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+Math.max(0,86400-(now-issued))+(origin.startsWith('https:')?'; Secure':''))}
 async function balance(){
  const quota={...utcQuotaWindow(),session:hmac('balance:'+id).slice(0,16)}
  const rows=await quotaStore(env,'path4u_ai_counters?key=eq.'+encodeURIComponent('subject:'+quota.day+':guest:'+id)+'&select=used')
  return {credits:Math.max(0,aiLimits.guestDaily-(rows?.[0]?.used || 0)),liveAI:true,quota}
 }
 if(path==='session'){
  if(!id){
   if(!bucket)throw new ApiError(503,'The server could not establish demo usage identity.')
   const window=Math.floor(Date.now()/aiLimits.sessionMintWindowMs)
   try{await claimCounter(env,'guest:mint:'+window+':'+bucket,1,aiLimits.sessionMints)}catch(error){
    if(error.status===429)throw quotaError('session_creation_rate','Many new demo sessions were opened on this network. Please wait a few minutes. Existing sessions can continue.',(window+1)*aiLimits.sessionMintWindowMs)
    throw error
   }
   id=randomUUID();issued=now;upgrade=true
  }
  if(upgrade)setCookie()
  return balance()
 }
 if(!id)throw new ApiError(401,'Start a live demo session first.')
 if(upgrade)setCookie()
 const subject='guest:'+id
 const data=learningInput(path,input)
 if(containsPersonalData(data))throw new ApiError(403,'Keep private resumes and personal details in local Resume Studio.')
 if(!env.GEMINI_API_KEY)throw new ApiError(503,'Gemini is not configured in this environment.')
 // All guest tools share four interactions. Roadmap and flowchart use the same
 // generator. Keep the existing atomic interaction reservation and account policy.
 const reply=await withAIQuota(env,{subject,guest:true,requestId:input.requestId,input:{path,...data},kind:'chat'},async remaining=>({result:await generateLiveResult(path,data,env),credits:remaining,liveAI:true}))
 // Cached/replayed responses may belong to yesterday. Return today's balance.
 return {...reply,...await balance()}
}
