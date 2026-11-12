import {ApiError} from './integrations.mjs'
import {redisCommand as sendRedis} from './redisStore.mjs'
async function redisCommand(env,command) {
 try{return await sendRedis(env,command)}catch(error){if(error instanceof ApiError && error.status===503)throw new ApiError(503,'Account storage is unavailable. Your changes have not been confirmed saved. Check the replacement store configuration or expiry.');throw error}
}
const prefix='path4u:{app}:accounts:v1:'
export async function redisDataRequest(env,resource,{method='GET',body,token,service=false}={}) {
 const url=new URL(resource,'https://local.invalid'),table=url.pathname.slice('/rest/v1/'.length)
 if(table==='openpath_signup_tickets')return {ok:true,status:200,data:[]}
 if(table==='rpc/openpath_claim_assistant_usage'){
  const key=prefix+'usage:'+new Date().toISOString().slice(0,13)+':'+body.p_user
  const day=new Date().toISOString().slice(0,10)
  const result=await redisCommand(env,['EVAL',"local h=tonumber(redis.call('GET',KEYS[1]) or '0');local d=tonumber(redis.call('GET',KEYS[2]) or '0');local g=tonumber(redis.call('GET',KEYS[3]) or '0');local cost=tonumber(ARGV[1]);if (cost~=1 and cost~=3) or h+cost>18 or d+cost>20 or g+cost>100 then return 0 end;for i=1,3 do redis.call('INCRBY',KEYS[i],cost);redis.call('EXPIRE',KEYS[i],172800) end;return 1",3,key,prefix+'usage:'+day+':'+body.p_user,'path4u:{app}:demo:v1:global:'+day,body.p_units])
  return {ok:true,status:200,data:result===1}
 }
 if(service || !token)throw new ApiError(403,'This data operation requires a verified account.')
 const auth=await fetch(new URL('/auth/v1/user',env.SUPABASE_URL),{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000),redirect:'error'})
 const user=await auth.json().catch(()=>null)
 if(!auth.ok || !user?.email_confirmed_at || user.app_metadata?.age_requirement_met!==true)throw new ApiError(403,'Verify your email and complete age eligibility first.')
 const owner=user.id
 const requested=body?.user_id || url.searchParams.get('user_id')?.replace(/^eq\./,'')
 if(requested && requested!==owner)throw new ApiError(403,'This record belongs to another account.')
 if(table==='openpath_opportunities') return {ok:true,status:200,data:[]}
 if(!['openpath_profiles','openpath_workspace','openpath_library'].includes(table))throw new ApiError(503,'This data operation is not supported by the replacement store.')
 const key=prefix+table+':'+owner
 if(table==='openpath_library'){
  const kind=body?.kind || url.searchParams.get('kind')?.replace(/^eq\./,'')
  const id=body?.id || url.searchParams.get('id')?.replace(/^eq\./,'')
  if(!['draft','conversation'].includes(kind))throw new ApiError(400,'Invalid library type.')
  const libraryKey=key+':'+kind
  if(method==='GET'){const rows=await redisCommand(env,['HVALS',libraryKey]);return {ok:true,status:200,data:rows.map(row=>JSON.parse(row)).sort((a,b)=>b.updated_at.localeCompare(a.updated_at))}}
  if(method==='DELETE'){await redisCommand(env,['HDEL',libraryKey,id]);return {ok:true,status:200,data:[]}}
  const row={id,value:body.value,updated_at:new Date().toISOString()}
  const saved=await redisCommand(env,['EVAL',"if redis.call('HEXISTS',KEYS[1],ARGV[1])==0 and redis.call('HLEN',KEYS[1])>=30 then return 0 end;redis.call('HSET',KEYS[1],ARGV[1],ARGV[2]);return 1",1,libraryKey,id,JSON.stringify(row)])
  return saved===1?{ok:true,status:200,data:[row]}:{ok:false,status:409,data:{message:'Library item limit reached'}}
 }
 if(method==='GET'){const value=await redisCommand(env,['GET',key]);return {ok:true,status:200,data:value?[JSON.parse(value)]:[]}}
 if(table==='openpath_profiles'){await redisCommand(env,['SET',key,JSON.stringify(body)]);return {ok:true,status:200,data:[body]}}
 const expected=method==='POST'?-1:Number(url.searchParams.get('revision')?.replace(/^eq\./,''))
 const row={state:body.state,revision:body.revision}
 const saved=await redisCommand(env,['EVAL',"local old=redis.call('GET',KEYS[1]);local rev=-1;if old then rev=cjson.decode(old).revision end;if rev~=tonumber(ARGV[1]) then return 0 end;redis.call('SET',KEYS[1],ARGV[2]);return 1",1,key,expected,JSON.stringify(row)])
 return saved===1?{ok:true,status:200,data:[row]}:{ok:false,status:409,data:[]}
}
