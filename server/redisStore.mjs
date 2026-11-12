import {ApiError} from './integrations.mjs'
export async function redisCommand(env,command) {
 const endpoint=env.UPSTASH_REDIS_REST_URL, token=env.UPSTASH_REDIS_REST_TOKEN
 if(!endpoint || !token) throw new ApiError(503,'Live demo quota storage is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to this Vercel environment.')
 let url;try{url=new URL(endpoint);if(url.protocol!=='https:' || !url.hostname.endsWith('.upstash.io') || url.username || url.password) throw Error()}catch{throw new ApiError(503,'The live demo quota endpoint configuration is invalid.')}
 let response;try{response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(command),redirect:'error',signal:AbortSignal.timeout(8000)})}catch{throw new ApiError(503,'Live demo quota storage is unreachable. No Gemini request was started.')}
 const body=await response.json().catch(()=>null)
 if(!response.ok || !body || body.error) throw new ApiError(503,'Live demo quota storage rejected the request. Check its server credentials and availability.')
 return body.result
}
