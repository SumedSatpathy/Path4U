if(process.env.PATH4U_AUTH_AUDIT!=='1')process.exit(0)
if(process.env.VERCEL_ENV!=='preview')throw Error('READONLY_AUDIT_REQUIRES_PREVIEW')
import {connectDatabase} from './postgres.mjs'
const db=await connectDatabase()
try{
 await db.query('begin read only')
 const tables=(await db.query("select name,to_regclass('public.'||name) is not null as exists from unnest(array['openpath_signup_tickets','openpath_profiles','openpath_workspace','openpath_library']) name")).rows
 const triggers=(await db.query("select tgname,pg_get_triggerdef(oid) as definition from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal")).rows
 const actions=(await db.query("select payload->>'action' as action,count(*)::int as count from auth.audit_log_entries where created_at>now()-interval '30 minutes' group by 1")).rows.filter(x=>/^[a-z_]{1,60}$/.test(x.action || ''))
 const ticketResponse=await fetch(new URL('/rest/v1/openpath_signup_tickets?select=token_hash&limit=0',process.env.SUPABASE_URL),{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(12000)})
 const ticketBody=await ticketResponse.json().catch(()=>({}))
 const settingsResponse=await fetch(new URL('/auth/v1/settings',process.env.SUPABASE_URL),{headers:{apikey:process.env.SUPABASE_ANON_KEY},signal:AbortSignal.timeout(12000)})
 const settings=await settingsResponse.json().catch(()=>({}))
 console.info(JSON.stringify({event:'auth_readonly_diagnosis',signupTicketProbe:{status:ticketResponse.status,code:/^[A-Z0-9_]{1,40}$/.test(ticketBody?.code??'')?ticketBody.code:undefined},emailConfirmation:{settingsStatus:settingsResponse.status,enabled:settings.mailer_autoconfirm===false},projectRef:new URL(process.env.SUPABASE_URL).hostname.split('.')[0],tables,triggers,actions,readsUserEmails:false,changesDatabase:false}))
}finally{await db.query('rollback');await db.end()}
