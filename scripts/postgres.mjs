import pg from 'pg'
import {readFile} from 'node:fs/promises'
export async function connectDatabase(env=process.env) {
 const value=env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL
 if(!value)throw Error('DATABASE_CONFIGURATION_MISSING')
 const url=new URL(value)
 if(!url.hostname.endsWith('.supabase.com') && !url.hostname.endsWith('.supabase.co'))throw Error('DATABASE_HOST_NOT_SUPABASE')
 const ref=new URL(env.SUPABASE_URL).hostname.split('.')[0]
 if(url.hostname!=='db.'+ref+'.supabase.co' && decodeURIComponent(url.username)!=='postgres.'+ref)throw Error('DATABASE_PROJECT_MISMATCH')
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key)
 const ca=await readFile(new URL('./supabase-ca.crt',import.meta.url),'utf8')
 const client=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:10000,statement_timeout:15000,query_timeout:20000})
 await client.connect()
 return client
}
