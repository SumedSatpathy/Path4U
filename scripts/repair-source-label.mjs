if(process.env.PATH4U_FIX_SOURCE_LABELS!=='1')process.exit(0)
if(process.env.VERCEL_ENV!=='preview')throw Error('CACHE_LABEL_REPAIR_REQUIRES_PREVIEW')
import {connectDatabase} from './postgres.mjs'
const db=await connectDatabase()
try{
 await db.query('begin')
 const label='SmartRecruiters · Grab'
 const cache=await db.query("update public.path4u_feed_cache set payload=(select jsonb_agg(jsonb_set(item,'{sourceName}',to_jsonb($1::text)) order by idx) from jsonb_array_elements(payload) with ordinality as x(item,idx)) where provider='smartrecruiters:Grab:my' and jsonb_typeof(payload)='array' and jsonb_array_length(payload)>0",[label])
 const rows=await db.query("update public.openpath_opportunities set listing=jsonb_set(listing,'{sourceName}',to_jsonb($1::text)) where id like 'smartrecruiters:Grab:%' and listing->>'sourceName' is distinct from $1",[label])
 await db.query('commit');console.info(JSON.stringify({event:'source_label_cache_repair',cacheRows:cache.rowCount,listings:rows.rowCount,onlyAttributionTextChanged:true}))
}catch{await db.query('rollback');throw Error('SOURCE_LABEL_REPAIR_FAILED')}
finally{await db.end()}
