// Opt-in retained QA helper, restricted to the two accounts in an explicitly approved run.
// Token retrieval and RLS checks are read-only. Explicit REKEY regenerates ONLY QA passwords.
// Generated QA credentials/tokens leave this helper only encrypted to the local test key.
// The private decryption key stays local and is removed after QA.
if (!process.env.PATH4U_RETAINED_QA_RUN) process.exit(0)
if (process.env.VERCEL_ENV !== 'preview') throw Error('RETAINED_QA_REQUIRES_PREVIEW')
import {randomBytes,createCipheriv,publicEncrypt} from 'node:crypto'
import {connectDatabase} from './postgres.mjs'
const run=process.env.PATH4U_RETAINED_QA_RUN
if(!/^[a-f0-9-]{36}$/.test(run) || !process.env.PATH4U_RETAINED_QA_PUBLIC_KEY) throw Error('INVALID_RETAINED_QA_RUN')
const key=Buffer.from(process.env.PATH4U_RETAINED_QA_PUBLIC_KEY,'base64').toString('utf8')
const db=await connectDatabase()
try{
 await db.query('begin read only')
 const names=[0,1].map(index=>'Path4U Synthetic QA '+run+' '+index)
 const rows=(await db.query("select id,email,confirmation_token,recovery_token,email_confirmed_at,raw_app_meta_data->>'age_requirement_met' as eligible,raw_user_meta_data->>'full_name' as name from auth.users where raw_user_meta_data->>'full_name'=any($1::text[]) and created_at>now()-interval '2 hours'",[names])).rows
 if(rows.length!==2 || rows.some(row=>!/^webwavework9\+path4u-qa-[a-f0-9-]{36}@gmail\.com$/.test(row.email)))throw Error('RETAINED_QA_OWNERSHIP_MISMATCH')
 if(process.env.PATH4U_RETAINED_QA_REKEY==='1') {
  for(const row of rows) {
   const password=randomBytes(24).toString('base64url')
   const response=await fetch(new URL('/auth/v1/admin/users/'+encodeURIComponent(row.id),process.env.SUPABASE_URL),{method:'PUT',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(12000)})
   if(!response.ok)throw Error('RETAINED_QA_PASSWORD_REGENERATION_FAILED')
   row.generated_qa_password=password
  }
 }

 const phase=process.env.PATH4U_RETAINED_QA_LINK_PHASE
 if(phase) {
  if(!['confirm','recovery'].includes(phase))throw Error('INVALID_QA_LINK_PHASE')
  const origin=process.env.PATH4U_RETAINED_QA_CALLBACK_ORIGIN
  if(!/^https:\/\/openpath-ai-demo-03531-[a-z0-9]+-webwavework9-8838\.vercel\.app$/.test(origin??''))throw Error('INVALID_QA_CALLBACK_ORIGIN')
  for(const row of rows.filter(row=>phase==='confirm' || row.name===names[0])) {
   const result=await fetch(new URL('/auth/v1/admin/generate_link',process.env.SUPABASE_URL),{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({type:phase==='confirm'?'magiclink':'recovery',email:row.email,redirect_to:origin+'/auth/callback'}),signal:AbortSignal.timeout(12000)})
   const link=await result.json()
   if(!result.ok || !link.hashed_token)throw Error('QA_PROVIDER_LINK_UNAVAILABLE')
   if(phase==='confirm')row.confirmation_token=link.hashed_token;else row.recovery_token=link.hashed_token
   const redirect=link.redirect_to || new URL(link.action_link).searchParams.get('redirect_to')
   row.callback_origin=redirect?new URL(redirect).origin:null
  }
 }
 const owner=rows.find(row=>row.name===names[0]),other=rows.find(row=>row.name===names[1])
 const counts={}
 for(const table of ['openpath_profiles','openpath_workspace','openpath_library'])counts[table]=(await db.query('select count(*)::int as count from public.'+table+' where user_id=$1',[owner.id])).rows[0].count
 await db.query('set local role authenticated')
 await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:other.id,role:'authenticated'})])
 const isolation={}
 for(const table of ['openpath_profiles','openpath_workspace','openpath_library'])isolation[table]=(await db.query('select count(*)::int as count from public.'+table+' where user_id=$1',[owner.id])).rows[0].count===0
 await db.query('reset role')
 console.info(JSON.stringify({event:'retained_qa_rls',existingOwnerRows:counts,crossOwnerReadBlocked:isolation,readOnly:true}))
 const secret=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv)
 const data=Buffer.concat([cipher.update(JSON.stringify(rows)),cipher.final()])
 console.info(JSON.stringify({event:'retained_qa_token_envelope',key:publicEncrypt({key,oaepHash:'sha256'},secret).toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64'),accountsRetained:true,existingAccountsModified:false}))
}finally{await db.query('rollback');await db.end()}
