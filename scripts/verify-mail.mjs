if(!process.env.PATH4U_MAIL_QA_ALIAS)process.exit(0)
if(process.env.VERCEL_ENV!=='preview')throw Error('MAIL_QA_REQUIRES_PREVIEW')
import {connectDatabase} from './postgres.mjs'
import {createOpenPathServer} from '../server/index.mjs'
import assert from 'node:assert/strict'
const alias=process.env.PATH4U_MAIL_QA_ALIAS
if(!/^[a-z0-9]+\+path4u-qa-[a-f0-9-]{36}@gmail\.com$/.test(alias))throw Error('INVALID_MAIL_QA_ALIAS')
const db=await connectDatabase(),env={...process.env,PATH4U_DATA_BACKEND:'supabase',PATH4U_SIGNUP_MODE:'server-attested'}
const app=createOpenPathServer({env});const local=await new Promise(resolve=>app.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+app.address().port)))
let owner
try{
 const row=(await db.query("select id,raw_app_meta_data->>'age_requirement_met' as eligible from auth.users where email=$1",[alias])).rows[0];assert.ok(row,'signup record exists');owner=row.id;assert.equal(row.eligible,'true','server attestation recorded on real signup')
 const response=await fetch(new URL('/auth/v1/admin/generate_link',env.SUPABASE_URL),{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({type:'magiclink',email:alias,redirect_to:'https://'+env.VERCEL_URL+'/auth/callback'}),signal:AbortSignal.timeout(12000)})
 const link=await response.json();assert.ok(response.ok && link.hashed_token)
 const verified=await fetch(local+'/api/auth/verify',{method:'POST',headers:{Origin:local,'content-type':'application/json'},body:JSON.stringify({type:'email',token:link.hashed_token})});assert.ok(verified.ok);const state=await verified.json();assert.equal(state.user.eligible,true)
 const confirmed=(await db.query('select email_confirmed_at is not null as confirmed from auth.users where id=$1',[owner])).rows[0].confirmed;assert.equal(confirmed,true)
 let destination;try{destination=new URL(link.action_link).searchParams.get('redirect_to');destination=destination?new URL(destination).origin:undefined}catch{}
 console.info(JSON.stringify({event:'signup_confirmation_audit',realSignupRecord:true,serverAgeAttestation:true,emailTokenExchange:true,emailConfirmedBySupabase:true,redirectOrigin:destination,expectedPreviewOrigin:'https://'+env.VERCEL_URL,inboxDelivery:'Confirmed by user separately; automated exchange used an admin-generated token, not the delivered email.'}))
}catch(error){console.error(JSON.stringify({event:'signup_confirmation_audit',failed:true,reason:error instanceof assert.AssertionError?error.message:'MAIL_QA_FAILED'}));process.exitCode=1}
finally{
 if(owner){const response=await fetch(new URL('/auth/v1/admin/users/'+owner,env.SUPABASE_URL),{method:'DELETE',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(12000)});console.info(JSON.stringify({event:'mail_qa_cleanup',removed:response.ok}))}
 await db.end();await new Promise(resolve=>app.close(resolve))
}
