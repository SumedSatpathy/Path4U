import {ApiError} from './integrations.mjs'
const api='https://boards-api.greenhouse.io/v1/boards/'
const hosts=new Set(['boards.greenhouse.io','job-boards.greenhouse.io'])
const memory=new Map(),pending=new Map()
const sixHours=6*3600000
const text=(value,max=1200)=>typeof value==='string'?value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;|&#160;|&#x0*a0;/gi,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim().slice(0,max):''
const date=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(Date.parse(value))?value:''
export function normalizeOpportunityURL(value){
 try{const u=new URL(value);if(u.protocol!=='https:' || u.username || u.password || u.port || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname) || !u.hostname.includes('.'))return '';for(const k of [...u.searchParams.keys()])if(/^utm_|^(gh_jid|ref|source)$/i.test(k))u.searchParams.delete(k);u.hash='';return u.toString().replace(/\/$/,'')}catch{return ''}
}
function base(id,title,organization,now){return {id,title,organization:organization || 'Organizer not stated',initials:(organization || title).split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),color:'blue',location:'Not stated',format:'Not stated',audience:'Not stated',discipline:'Other',durationMonths:-1,deadline:'',published:now,discoveredAt:now,checkedAt:now,verified:false,status:'Status Unverified',summary:'',description:'',skills:[],requirements:[],eligibility:[],match:{score:0,reasons:[],gaps:[]}}}
async function readJSON(url){const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Path4U/1.0 (+public opportunity discovery)'},redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new ApiError(502,'Opportunity provider unavailable.');const raw=await response.text();if(raw.length>15000000)throw Error('FEED_TOO_LARGE');return JSON.parse(raw)}
export function mapGreenhouse(board,organization,data,now=new Date().toISOString()){
 if(!Array.isArray(data?.jobs))throw Error('INVALID_FEED')
 return data.jobs.flatMap(job=>{
  if(!Number.isSafeInteger(job?.id) || job.id<=0 || job.internal_job_id===null || !text(job.title))return []
  const sourceUrl=normalizeOpportunityURL(job.absolute_url)
  if(!sourceUrl)return []
  const u=new URL(sourceUrl);if(!hosts.has(u.hostname) || u.pathname.replace(/\/$/,'')!==`/${board}/jobs/${job.id}`)return []
  const title=text(job.title,220),description=text(job.content,14000),location=text(job.location?.name,180) || 'Not stated'
  const searchable=title+' '+description
  const discipline=/\b(machine learning|artificial intelligence|AI)\b/i.test(title)?'AI':/\bdata (science|scientist|analytics)\b/i.test(title)?'Data Science':/\b(design|designer)\b/i.test(title)?'Design':/\b(software|engineer|developer|security|cloud|technical)\b/i.test(title)?'Software':/\bproduct\b/i.test(title)?'Product':'Other'
  const skills=['Python','JavaScript','TypeScript','React','SQL','Java','Go','C++','Kubernetes','AWS','Linux','Rust'].filter(skill=>new RegExp('(?:^|[^a-z])'+skill.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z])','i').test(searchable))
  const deadline=date(job.application_deadline)
  const status=deadline && deadline.slice(0,10)<now.slice(0,10)?'Expired':'Verified Open'
  return [{...base(`greenhouse:${board}:${job.id}`,title,organization,now),category:/\bintern(ship)?\b/i.test(title)?'Internship':'Job',location,format:/\bhybrid\b/i.test(location)?'Hybrid':/\b(remote|home based|home-based)\b/i.test(location)?'Remote':'Not stated',discipline,summary:description.slice(Math.max(0,description.search(/(?:about the role|what you.ll do|the role|your mission)/i)),Math.max(0,description.search(/(?:about the role|what you.ll do|the role|your mission)/i))+280) || 'Read the employer’s original listing for role details.',description:description.slice(0,2400) || 'The employer did not include a description in the feed.',skills,deadline,published:date(job.first_published)||now,sourceId:String(job.id),sourceName:'Greenhouse · '+organization,sourceUrl,verified:status==='Verified Open',status,statusEvidence:'Published on the employer’s current public job board.',employmentType:/\bintern(ship)?\b/i.test(title)?'Internship':undefined,experienceLevel:/\b(senior|staff|principal|lead)\b/i.test(title)?'Senior':/\b(junior|graduate|entry.level|intern)\b/i.test(title)?'Entry level':'Not stated'}]
 })
}
export function mapSmartRecruiters(job,now=new Date().toISOString()){
 const sourceUrl=normalizeOpportunityURL(job.applyUrl || job.postingUrl)
 if(!sourceUrl || new URL(sourceUrl).hostname!=='jobs.smartrecruiters.com' || !new URL(sourceUrl).pathname.startsWith('/Grab/') || job.active!==true || job.visibility!=='PUBLIC')return []
 const title=text(job.name,220),sections=job.jobAd?.sections || {},description=text(sections.jobDescription?.text,2400),qualifications=text(sections.qualifications?.text,2400)
 return [{...base('smartrecruiters:Grab:'+job.id,title,'Grab',now),category:/\bintern(ship)?\b/i.test(title)?'Internship':'Job',location:text(job.location?.fullLocation,180) || [job.location?.city,job.location?.country].filter(Boolean).join(', '),format:job.location?.remote===true?'Remote':job.location?.hybrid===true?'Hybrid':job.location?.remote===false?'In person':'Not stated',discipline:/\bdata (scientist|science)\b/i.test(title)?'Data Science':/\bAI|machine learning\b/i.test(title)?'AI':'Software',summary:description.slice(0,280),description,requirements:qualifications?[qualifications]:[],eligibility:[],experienceLevel:text(job.experienceLevel?.label,80)||'Not stated',employmentType:text(job.typeOfEmployment?.label,80)||undefined,published:date(job.releasedDate)||now,sourceId:String(job.id),sourceUrl,sourceName:'SmartRecruiters · Grab',verified:true,status:'Verified Open',statusEvidence:'Public posting is active in the employer API.'}]
}
async function readGrab(){
 const postings=[]
 for(let offset=0;offset<300;offset+=100){const page=await readJSON('https://api.smartrecruiters.com/v1/companies/Grab/postings?limit=100&country=my&offset='+offset);if(!Array.isArray(page.content))throw Error('INVALID_FEED');postings.push(...page.content);if(offset+page.content.length>=page.totalFound || !page.content.length)break}
 const selected=postings.filter(x=>/\b(intern(ship)?|engineer|software|data|security|developer|technology|product design)\b/i.test(x.name) && /^\d+$/.test(x.id)).slice(0,60)
 const results=[]
 for(let n=0;n<selected.length;n+=5){const batch=await Promise.allSettled(selected.slice(n,n+5).map(x=>readJSON('https://api.smartrecruiters.com/v1/companies/Grab/postings/'+x.id)));for(const result of batch)if(result.status==='fulfilled')results.push(...mapSmartRecruiters(result.value))}
 if(selected.length && !results.length)throw Error('POSTINGS_UNAVAILABLE')
 return results
}
export function mapHackalendar(data,now=new Date().toISOString()){
 if(!Array.isArray(data?.data))throw Error('INVALID_FEED')
 return data.data.flatMap(event=>{
  const sourceUrl=normalizeOpportunityURL(event.registrationUrl)
  if(!event.id || !text(event.name) || !sourceUrl || ['cancelled','withdrawn','closed'].includes(event.status))return []
  const end=date(event.endAt),start=date(event.startAt)
  if((end || start).slice(0,10)<now.slice(0,10))return []
  const deadline=date(event.registrationDeadline),description=text(event.description)
  return [{...base('hackalendar:'+event.id,text(event.name,220),text(event.organizer,180),now),category:/\bworkshop\b/i.test(event.name)?'Workshop':'Hackathon',location:[text(event.cityLabel,100),text(event.countryCode,5)].filter(Boolean).join(', ') || (event.mode==='online'?'International · online':'Not stated'),format:({online:'Remote',hybrid:'Hybrid',in_person:'In person'})[event.mode] || 'Not stated',discipline:event.themes?.includes('ai')?'AI':event.themes?.includes('data')?'Data Science':'Other',summary:description.slice(0,280),description,sourceId:String(event.id),sourceName:'Hackalendar',sourceUrl,sourceRecordUrl:normalizeOpportunityURL(event.url),deadline,eventStart:start,eventEnd:end,eventTimezone:text(event.timezone,80)||undefined,fees:event.isFree===true?'Free (reported by provider)':event.isFree===false?'Paid; check organizer':undefined,sourceVerifiedAt:date(event.lastVerifiedAt)||undefined,status:deadline && deadline.slice(0,10)<now.slice(0,10)?'Expired':'Status Unverified',statusEvidence:'Event published in a public directory. Registration availability has not been confirmed with the organizer.'}]
 })
}
// Low-volume link checks only for reviewed event-platform hosts. Never follow an
// arbitrary feed-provided redirect or contact private hosts with server credentials.
async function checkEventLinks(listings){
 const allowed=new Set(['lu.ma','luma.com'])
 for(let n=0;n<listings.length;n+=3)await Promise.all(listings.slice(n,n+3).map(async item=>{
  let target=item.sourceUrl
  try{for(let hop=0;hop<3;hop++){
   const url=new URL(target);if(!allowed.has(url.hostname))return
   const response=await fetch(url,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(5000)})
   item.linkCheckedAt=new Date().toISOString();item.linkStatus=response.status
   if([404,410].includes(response.status)){item.status='Closed';item.verified=false;item.statusEvidence='Original registration link returned HTTP '+response.status+' on '+item.linkCheckedAt;return}
   if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');if(!location)return;target=new URL(location,url).toString();continue}
   return
  }}catch{/* A failed status check never proves that registration is open or closed. */}
 }))
 return listings
}
async function store(env,path,{method='GET',body,prefer}={}){
 if(env.PATH4U_DATA_BACKEND!=='supabase' || !env.SUPABASE_SERVICE_ROLE_KEY)return null
 const response=await fetch(new URL('/rest/v1/'+path,env.SUPABASE_URL),{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000),redirect:'error'})
 if(!response.ok)throw Error('FEED_STORAGE_UNAVAILABLE')
 return response.status===204?[]:await response.json().catch(()=>[])
}
async function provider(env,name,loader){
 let cached,storage=env.PATH4U_DATA_BACKEND==='supabase'?'Supabase':'Instance cache'
 try{cached=(await store(env,'path4u_feed_cache?provider=eq.'+encodeURIComponent(name)+'&select=*'))?.[0] ?? memory.get(name)}catch{cached=memory.get(name);storage='Instance cache · durable cache unavailable'}
 const now=Date.now(),iso=new Date(now).toISOString()
 if(cached && Date.parse(cached.retry_after)>now)return {name,listings:cached.payload,checkedAt:cached.checked_at,stale:cached.last_error || now-Date.parse(cached.checked_at)>sixHours,storage}
 if(pending.has(name))return pending.get(name)
 const task=(async()=>{
  try{
   if(env.PATH4U_DATA_BACKEND==='supabase'){
    let lease
    if(cached)lease=await store(env,'path4u_feed_cache?provider=eq.'+encodeURIComponent(name)+'&retry_after=lte.'+encodeURIComponent(iso),{method:'PATCH',body:{retry_after:new Date(now+60000).toISOString()},prefer:'return=representation'})
    else lease=await store(env,'path4u_feed_cache?on_conflict=provider',{method:'POST',body:{provider:name,payload:[],checked_at:'1970-01-01T00:00:00Z',retry_after:new Date(now+60000).toISOString()},prefer:'resolution=ignore-duplicates,return=representation'})
    if(!lease?.length)return {name,listings:cached?.payload||[],checkedAt:cached?.checked_at,stale:true,storage,refreshing:true}
   }
   const previous=new Map((cached?.payload || []).map(x=>[x.id,x]))
   const current=await loader()
   const listings=current.map(x=>({...x,discoveredAt:previous.get(x.id)?.discoveredAt || x.discoveredAt}))
   const row={provider:name,payload:listings,checked_at:iso,retry_after:new Date(now+sixHours).toISOString(),last_error:false}
   await store(env,'path4u_feed_cache?on_conflict=provider',{method:'POST',body:row,prefer:'resolution=merge-duplicates'})
   if(env.PATH4U_DATA_BACKEND==='supabase'){
    if(listings.length)await store(env,'openpath_opportunities?on_conflict=id',{method:'POST',body:listings.map(x=>({id:x.id,listing:x,published_at:x.published,deadline_at:x.deadline?.includes('T')?x.deadline:null,verified_at:x.verified?iso:null,active:x.status!=='Expired' && x.status!=='Closed'})),prefer:'resolution=merge-duplicates'})
    const ids=new Set(listings.map(x=>x.id));const gone=[...previous.keys()].filter(id=>!ids.has(id))
    for(const id of gone)await store(env,'openpath_opportunities?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:{active:false,verified_at:null}})
   }
   memory.set(name,row)
   return {name,listings,checkedAt:iso,stale:false,storage}
  }catch{
   if(cached){const row={...cached,last_error:true,retry_after:new Date(now+15*60000).toISOString()};memory.set(name,row);await store(env,'path4u_feed_cache?provider=eq.'+encodeURIComponent(name),{method:'PATCH',body:{last_error:true,retry_after:row.retry_after}}).catch(()=>{})}
   return {name,listings:cached?.payload||[],checkedAt:cached?.checked_at,stale:true,storage,error:'Provider refresh unavailable; showing last successful results where available.'}
  }
 })().finally(()=>pending.delete(name));pending.set(name,task);return task
}
export function approvedFeedConfigured(){return true}
export async function getOpportunityCatalog(env=process.env){
 const boards=[...new Set((env.OPENPATH_GREENHOUSE_BOARDS || 'cloudflare,canonical').split(',').map(x=>x.trim()).filter(x=>/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(x)))].slice(0,6)
 const providers=await Promise.all([provider(env,'smartrecruiters:Grab:my',readGrab),...boards.map(board=>provider(env,'greenhouse:'+board,async()=>{const [info,data]=await Promise.all([readJSON(api+board),readJSON(api+board+'/jobs?content=true')]);if(!text(info.name))throw Error('INVALID_BOARD');return mapGreenhouse(board,text(info.name,160),data)})),provider(env,'hackalendar',async()=>{
  const listings=[];let offset=0
  for(let i=0;i<3;i++){const data=await readJSON('https://hackalendar.com/api/events?limit=200&offset='+offset);listings.push(...mapHackalendar(data));if(!data.meta?.hasMore)break;const next=data.meta.nextOffset;if(!Number.isInteger(next)||next<=offset)break;offset=next}
  return checkEventLinks(listings)
 })])
 const unique=new Map(),now=Date.now()
 for(const p of providers)for(const entry of p.listings){
  const expired=entry.status==='Expired'||entry.status==='Closed'||(entry.deadline && entry.deadline.slice(0,10)<new Date().toISOString().slice(0,10))||(entry.eventEnd && entry.eventEnd.slice(0,10)<new Date().toISOString().slice(0,10))
  if(expired)continue
  const stale=now-Date.parse(p.checkedAt)>24*3600000
  const item={...entry,summary:text(entry.summary,280),description:text(entry.description,2400),...(stale?{verified:false,status:'Status Unverified',statusEvidence:'Source check is older than 24 hours.'}:{}),cached:p.stale}
  const key=normalizeOpportunityURL(item.sourceUrl);if(!key)continue
  const old=unique.get(key);if(!old || (item.status==='Verified Open' && old.status!=='Verified Open'))unique.set(key,item)
 }
 const opportunities=[...unique.values()].sort((a,b)=>Number(/malaysia|kuala lumpur/i.test(b.location))-Number(/malaysia|kuala lumpur/i.test(a.location)) || Number(b.format==='Remote')-Number(a.format==='Remote') || b.discoveredAt.localeCompare(a.discoveredAt))
 return {opportunities,providers:providers.map(({listings,...p})=>({...p,count:listings.length})),refreshHours:6,mechanism:'On-demand refresh with cache and per-provider refresh lease',stale:providers.some(x=>x.stale)}
}
export async function getApprovedFeed(env){return (await getOpportunityCatalog(env)).opportunities}
