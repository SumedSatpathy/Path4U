if(process.env.PATH4U_VERIFY_REDIRECT!=='1')process.exit(0)
if(process.env.VERCEL_ENV!=='preview')throw Error('REDIRECT_QA_REQUIRES_PREVIEW')
import {randomUUID,randomBytes} from 'node:crypto'
import {geminiConfig} from '../server/geminiConfig.mjs'
const env=process.env
async function admin(path,method='GET',body){const r=await fetch(new URL('/auth/v1/admin/'+path,env.SUPABASE_URL),{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('REDIRECT_AUDIT_UNAVAILABLE');return r.json()}
let id
try{
 const email='path4u.redirect.qa.'+randomUUID()+'@example.test'
 const user=await admin('users','POST',{email,password:randomBytes(24).toString('base64url'),email_confirm:true});id=user.id
 const target='https://'+env.VERCEL_URL+'/auth/callback'
 const data=await admin('generate_link','POST',{type:'recovery',email,redirect_to:target})
 const actual=data.redirect_to || new URL(data.action_link).searchParams.get('redirect_to')
 console.info(JSON.stringify({event:'auth_redirect_audit',matchesExpected:actual===target,actualOrigin:actual?new URL(actual).origin:null,expectedOrigin:new URL(target).origin,emailSent:false}))
 const config=geminiConfig(env)
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(config.model),{headers:{'x-goog-api-key':env.GEMINI_API_KEY},signal:AbortSignal.timeout(12000)})
 const model=await response.json();console.info(JSON.stringify({event:'model_metadata_audit',model:config.model,available:response.ok && model.supportedGenerationMethods?.includes('generateContent'),paidSearch:config.search,privateAI:config.privateAI}))
}catch{console.info(JSON.stringify({event:'auth_redirect_audit',available:false}))}
finally{if(id){await admin('users/'+id,'DELETE');console.info(JSON.stringify({event:'redirect_qa_cleanup',removed:true}))}}
