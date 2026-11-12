// Isolated PostgREST/provider double. No real credentials, DB writes or API usage.
import {roadmapFixture} from './roadmap.mjs'
export function quotaFixture(t) {
 const counters=new Map(),requests=new Map(),cache=new Map(),calls=[]
 let providerStatus=200,invalidMap=false,storageDown=false
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const u=new URL(url),body=init.body?JSON.parse(init.body):null,method=init.method || 'GET'
  if(u.hostname==='generativelanguage.googleapis.com'){
   calls.push(body)
   if(providerStatus!==200)return Response.json({}, {status:providerStatus,headers:{'retry-after':'20'}})
   const input=JSON.parse(body.contents[0].parts[0].text),schema=body.generationConfig.responseSchema.properties
   const result=schema.milestones?roadmapFixture(input):schema.nodes?{nodes:invalidMap?['bad']:['Cybersecurity','Network defense','Threat modeling','Incident response','Secure coding']}:{answer:'A controlled explanation of '+input.message,title:'Guidance',artifact:'text',proposal:''}
   return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]})
  }
  if(u.hostname!=='quota.example.test')throw Error('Unexpected external request: '+u.hostname)
  if(storageDown)return Response.json({}, {status:503})
  const key=u.searchParams.get('key')?.slice(3)
  if(u.pathname.endsWith('/rpc/path4u_reserve_ai')){
   const {p_subject:subject,p_request:id,p_fingerprint:fp,p_kind:kind,p_guest:guest}=body
   const requestKey=subject+':'+id,old=requests.get(requestKey)
   if(old && old.expires>Date.now())return Response.json(old.fp!==fp?{state:'conflict'}:{state:'duplicate',result:old.result})
   const day=new Date().toISOString().slice(0,10),minute=new Date().toISOString().slice(0,16).replace('T','-').replace(':','-')
   // Same durable RPC policy as the inspected SQL; independent hard-coded limits.
   const gates=[['global:'+day,80],['subject:'+day+':'+subject,guest?4:12],['minute:'+minute,4],...(kind==='roadmap'?[['roadmap:'+day+':'+subject,guest?1:2]]:[])]
   if(gates.some(([k,cap])=>(counters.get(k)||0)>=cap))return Response.json({state:'limited'})
   for(const [k] of gates)counters.set(k,(counters.get(k)||0)+1)
   requests.set(requestKey,{fp,result:null,expires:Date.now()+86400000})
   return Response.json({state:'reserved',remaining:(guest?4:12)-counters.get('subject:'+day+':'+subject)})
  }
  if(u.pathname.endsWith('/path4u_ai_counters')){
   if(method==='GET')return Response.json(counters.has(key)?[{used:counters.get(key)}]:[])
   if(method==='PATCH'){
    if(counters.get(key)!==Number(u.searchParams.get('used')?.slice(3)))return Response.json([])
    counters.set(key,body.used);return Response.json([{used:body.used}])
   }
   if(counters.has(body.key))return Response.json([])
   counters.set(body.key,body.used);return Response.json([{used:body.used}])
  }
  if(u.pathname.endsWith('/path4u_ai_requests')){
   const r=requests.get(u.searchParams.get('subject').slice(3)+':'+u.searchParams.get('request_id').slice(3))
   Object.assign(r,{result:body.result,...(body.expires_at?{expires:Date.parse(body.expires_at)}:{})});return Response.json(null)
  }
  if(u.pathname.endsWith('/path4u_public_ai_cache')){
   if(method==='GET'){const row=cache.get(key);return Response.json(row && row.expires_at>new Date().toISOString()?[{value:row.value}]:[])}
   cache.set(body.key,body);return Response.json(null)
  }
  throw Error('Unexpected quota path: '+u.pathname)
 })
 return {counters,requests,calls,env:{PATH4U_DATA_BACKEND:'supabase',PATH4U_DEMO_BACKEND:'supabase',DEMO_ONLY_MODE:'true',SUPABASE_URL:'https://quota.example.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic',GEMINI_API_KEY:'synthetic',GEMINI_MODEL:'mock'},providerStatus:value=>{providerStatus=value},invalidMap:value=>{invalidMap=value},storageDown:value=>{storageDown=value}}
}
