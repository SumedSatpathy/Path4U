if(process.env.PATH4U_FEED_REFRESH!=='1')process.exit(0)
if(process.env.VERCEL_ENV!=='preview' || process.env.PATH4U_DATA_BACKEND!=='supabase')throw Error('FEED_REFRESH_REQUIRES_DURABLE_PREVIEW')
import {getOpportunityCatalog} from '../server/feed.mjs'
const env=process.env
const response=await fetch(new URL('/rest/v1/path4u_feed_cache?provider=eq.hackalendar',env.SUPABASE_URL),{method:'PATCH',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},body:JSON.stringify({retry_after:'1970-01-01T00:00:00Z'}),signal:AbortSignal.timeout(10000)})
if(!response.ok)throw Error('FEED_REFRESH_UNAVAILABLE')
const result=await getOpportunityCatalog(env)
console.info(JSON.stringify({event:'live_source_audit',counts:Object.fromEntries(['Internship','Job','Hackathon','Workshop'].map(c=>[c,result.opportunities.filter(x=>x.category===c).length])),malaysia:result.opportunities.filter(x=>/malaysia/i.test(x.location)).length,providers:result.providers}))
