if(process.env.PATH4U_DB_INSPECT!=='1')process.exit(0)
const {Client}=await import('pg')
const {readFile}=await import('node:fs/promises')
const ca=await readFile(new URL('./supabase-ca.crt',import.meta.url),'utf8')
let connected=false
for(const key of ['POSTGRES_URL','POSTGRES_URL_NON_POOLING']){
 if(!process.env[key])continue
 let client
 try{
  const url=new URL(process.env[key]);for(const name of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(name)
  client=new Client({connectionString:url.toString(),ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:10000,statement_timeout:10000,query_timeout:12000})
  await client.connect();connected=true;await client.query('BEGIN READ ONLY')
  const tables=await client.query("select schemaname,tablename,rowsecurity from pg_tables where schemaname in ('public','openpath_private') order by schemaname,tablename")
  const policies=await client.query("select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname")
  const triggers=await client.query("select tgname,pg_get_triggerdef(oid) as definition from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal")
  const migrationTable=await client.query("select to_regclass('supabase_migrations.schema_migrations') is not null as exists")
  let migrations=[];if(migrationTable.rows[0].exists)migrations=(await client.query('select version from supabase_migrations.schema_migrations order by version')).rows
  await client.query('ROLLBACK')
  console.info(JSON.stringify({event:'postgres_readonly_audit',connected:true,via:key,projectRef:process.env.SUPABASE_URL?new URL(process.env.SUPABASE_URL).hostname.split('.')[0]:null,tables:tables.rows,triggers:triggers.rows,migrations}))
  for(const policy of policies.rows)console.info(JSON.stringify({event:'postgres_policy_audit',...policy}))
  break
 }catch(error){console.info(JSON.stringify({event:'postgres_readonly_audit',connected:false,via:key,code:/^[A-Z0-9_]{2,40}$/.test(error.code || '')?error.code:'CONNECTION_OR_QUERY_FAILED'}))}
 finally{await client?.end().catch(()=>{})}
}
if(!connected)console.info(JSON.stringify({event:'postgres_readonly_audit',available:false,configurationPresent:Boolean(process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING)}))
