// Explicit opt-in only. Never executes on a normal build or a Production deployment.
if(process.env.PATH4U_APPLY_DURABLE!=='1')process.exit(0)
if(process.env.VERCEL_ENV!=='preview')throw Error('MIGRATION_REQUIRES_PREVIEW')
import {connectDatabase} from './postgres.mjs'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {redisCommand} from '../server/redisStore.mjs'
const version='20261112132337'
const sql=await readFile(new URL('../supabase/migrations/'+version+'_durable_path4u_workspace.sql',import.meta.url),'utf8')
const digest=createHash('sha256').update(sql).digest('hex')
const client=await connectDatabase()
try{
 await client.query('begin');await client.query('select pg_advisory_xact_lock(641412025)')
 await client.query('create schema if not exists openpath_private')
 await client.query('create table if not exists openpath_private.path4u_migrations(version text primary key,digest text not null,applied_at timestamptz not null default now())')
 await client.query('revoke all on openpath_private.path4u_migrations from public,anon,authenticated')
 const old=(await client.query('select digest from openpath_private.path4u_migrations where version=$1',[version])).rows[0]
 if(old && old.digest!==digest)throw Error('MIGRATION_CHECKSUM_MISMATCH')
 if(!old){
  await client.query(sql)
  await client.query('insert into openpath_private.path4u_migrations(version,digest) values($1,$2)',[version,digest])
 }
 await client.query('commit')
 console.info(JSON.stringify({event:'durable_migration',version,applied:!old,preservesLegacyTables:true,changesAuthTriggers:false}))
 // Copy only Path4U-owned Redis records whose Auth owner exists. Never overwrite PostgreSQL rows.
 let cursor='0',copied=0,skipped=0
 if(process.env.UPSTASH_REDIS_REST_URL)do{
  const scan=await redisCommand(process.env,['SCAN',cursor,'MATCH','path4u:{app}:accounts:v1:openpath_*','COUNT',100]);cursor=scan[0]
  for(const key of scan[1]){
   const match=key.match(/:accounts:v1:(openpath_profiles|openpath_workspace|openpath_library):([0-9a-f-]{36})(?::(draft|conversation))?$/i)
   if(!match)continue
   const [,table,owner,kind]=match
   if(!(await client.query('select exists(select 1 from auth.users where id=$1) as ok',[owner])).rows[0].ok){skipped++;continue}
   const rows=table==='openpath_library'?await redisCommand(process.env,['HVALS',key]):[await redisCommand(process.env,['GET',key])]
   for(const value of rows.filter(Boolean)){
    const row=JSON.parse(value)
    const result=table==='openpath_profiles'?await client.query('insert into public.openpath_profiles(user_id,preferences) values($1,$2) on conflict do nothing',[owner,row.preferences]):table==='openpath_workspace'?await client.query('insert into public.openpath_workspace(user_id,state,revision) values($1,$2,$3) on conflict do nothing',[owner,row.state,row.revision]):await client.query('insert into public.openpath_library(user_id,kind,id,value,updated_at) values($1,$2,$3,$4,$5) on conflict do nothing',[owner,kind,row.id,row.value,row.updated_at])
    copied+=result.rowCount
   }
  }
 }while(cursor!=='0')
 console.info(JSON.stringify({event:'durable_copy',copied,skipped,originalsRetained:true}))
}catch(error){await client.query('rollback').catch(()=>{});console.error(JSON.stringify({event:'durable_migration_failed',code:/^[A-Z0-9_]{2,60}$/.test(error.code||error.message)?(error.code||error.message):'MIGRATION_FAILED'}));process.exitCode=1}
finally{await client.end()}
