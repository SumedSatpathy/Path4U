// Read-only metadata audit. No user rows, passwords, tokens or key values are printed.
if (process.env.PATH4U_INSPECT_BACKEND !== '1') process.exit(0)
const env=process.env
const required=['/openpath_profiles','/openpath_workspace','/openpath_opportunities','/openpath_library','/rpc/openpath_claim_assistant_usage','/rpc/path4u_demo_session']
try {
 if(!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Missing backend configuration')
 const metadata=await fetch(new URL('/rest/v1/',env.SUPABASE_URL),{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,Accept:'application/openapi+json'},signal:AbortSignal.timeout(15000),redirect:'error'})
 const schema=await metadata.json().catch(()=>null)
 const settings=await fetch(new URL('/auth/v1/settings',env.SUPABASE_URL),{headers:{apikey:env.SUPABASE_ANON_KEY},signal:AbortSignal.timeout(15000),redirect:'error'})
 const auth=await settings.json().catch(()=>null)
 console.info(JSON.stringify({event:'backend_metadata_audit',readOnly:true,schemaStatus:metadata.status,authStatus:settings.status,paths:required.map(path=>({path,visible:Boolean(schema?.paths?.[path])})),emailProvider:auth?.external?.email,emailAutoconfirm:auth?.mailer_autoconfirm,scope:'API metadata only; does not verify live login, RLS isolation, triggers, storage policies or existing-user data.'}))
} catch {console.info(JSON.stringify({event:'backend_metadata_audit',readOnly:true,available:false,error:'Backend metadata inspection unavailable; no database changes were made.'}))}
