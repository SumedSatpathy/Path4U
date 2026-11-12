export const requiredResumeFields = ['name','email','education','technical','role']
export const resumeHints = {
 education: 'One qualification per line: Qualification | Institution. Optional dates: 2022-09 to 2026-06.',
 work: 'Optional. One entry per line: Role | Employer | Description. Optional dates: 2023-01 to Present.',
 internships: 'Optional. One entry per line: Role | Organization | Description.',
 projects: 'Optional. One entry per line: Project title | Description.',
 certifications: 'Optional. One entry per line: Certificate name | Issuer.',
 technical: 'Separate skills with commas, semicolons or new lines. Include each skill once.',
}
const placeholder = /^(?:your (?:full )?name|full name|name|test|placeholder|n\/?a|asdf|\[.*\])$/i
const parts = value => value.split(/\s*\|\s*|\s*;\s*|\s*,\s*|\s+at\s+/i).filter(Boolean)
function dates(value) {
 const ranges = value.matchAll(/\b(\d{4}(?:-\d{2}(?:-\d{2})?)?)\s*(?:to|–|—|\s-\s|-(?=\d{4}\b))\s*(\d{4}(?:-\d{2}(?:-\d{2})?)?|present|current)\b/gi)
 for(const [,start,end] of ranges) {
  const valid = date => { const [y,m=1,d=1]=date.split('-').map(Number);const parsed=new Date(Date.UTC(y,m-1,d));return parsed.getUTCFullYear()===y && parsed.getUTCMonth()===m-1 && parsed.getUTCDate()===d }
  const todayParts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value]))
  const today=[todayParts.year,todayParts.month,todayParts.day].join('-')
  if(/present|current/i.test(end) && start.padEnd(10,'-01')>today) return 'A start date cannot be in the future when the end is Present.'
  if(!valid(start) || !/present|current/i.test(end) && (!valid(end) || start.padEnd(10,'-01') > end.padEnd(10,'-01'))) return 'Use valid dates with the start before the end (YYYY-MM to YYYY-MM or Present).'
 }
 return ''
}
export function validateResume(profile) {
 const errors={}
 for(const key of requiredResumeFields) if(typeof profile?.[key] !== 'string' || !profile[key].trim()) errors[key]='This information is required.'
 if(!profile || typeof profile !== 'object') return errors
 for(const [key,value] of Object.entries(profile)) {
  if(typeof value !== 'string' || value.length>10000) {errors[key]='Enter text within the field limit.';continue}
  if(value && !value.trim()) errors[key]='Enter a value or clear this optional field.'
 }
 if(Object.values(profile).some(value=>typeof value!=='string')) return errors
 if(profile.name?.trim() && (placeholder.test(profile.name.trim()) || !/\p{L}/u.test(profile.name))) errors.name='Enter your actual name instead of placeholder text.'
 if(profile.email?.trim() && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(profile.email.trim())) errors.email='Enter an email such as name@example.com.'
 if(profile.phone?.trim()) {
  const phone=profile.phone.trim();const digits=phone.replace(/\D/g,'')
  if(!/^\+?[\d\s().-]+$/.test(phone) || digits.length<7 || digits.length>15 || (phone.match(/\(/g)||[]).length!==(phone.match(/\)/g)||[]).length) errors.phone='Use 7–15 digits, with an optional country prefix, spaces, brackets or hyphens.'
 }
 for(const key of ['linkedin','github','portfolio']) if(profile[key]?.trim()) {
  try {const url=new URL(profile[key].trim());if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.')||/\s/.test(profile[key])) throw new Error();if(key!=='portfolio' && !(url.hostname===key+'.com' || url.hostname.endsWith('.'+key+'.com'))) throw new Error()}
  catch {errors[key]='Enter a full '+(key==='portfolio'?'website':key==='github'?'GitHub':'LinkedIn')+' URL starting with https://.'}
 }
 for(const key of ['technical','soft']) if(profile[key]?.trim()) {
  const skills=profile[key].split(/[,;\n]/).map(item=>item.trim())
  if(skills.some(item=>!item)) errors[key]='Remove empty skill entries between separators.'
  else if(new Set(skills.map(item=>item.normalize('NFKC').toLocaleLowerCase('en'))).size!==skills.length) errors[key]='Remove duplicate skills; each skill should appear once.'
 }
 for(const [key,count] of [['education',2],['work',3],['internships',3],['projects',2],['certifications',2]]) if(profile[key]?.trim()) {
  const lines=profile[key].split(/\n/).filter(line=>line.trim())
  if(lines.some(line=>parts(line.trim()).length<count || line.split('|').some(part=>!part.trim()))) errors[key]=resumeHints[key]
  const issue=dates(profile[key]);if(issue) errors[key]=issue
 }
 return errors
}
export function resumeCompletion(profile) {
 const errors=validateResume(profile)
 return Math.round(requiredResumeFields.filter(key=>!errors[key]).length/requiredResumeFields.length*100)
}
export function validateResumeDocument(content) {
 if(typeof content !== 'string') return 'Enter resume content.'
 const lines=content.split(/\r?\n/)
 const clean=line=>line.replace(/^#{1,6}\s*|^[-•]\s*/g,'').replace(/\*\*/g,'').trim().replace(/:$/,'')
 const headings=/^(?:education|technical skills|professional skills|skills|projects|work experience|experience|internships|certifications|languages|achievements|professional summary|summary|volunteer experience)$/i
 const section=heading=>{const start=lines.findIndex(line=>clean(line).toLowerCase()===heading.toLowerCase());if(start<0)return '';let end=start+1;while(end<lines.length && !headings.test(clean(lines[end])))end++;return lines.slice(start+1,end).map(clean).filter(Boolean).join('\n')}
 const rawEducation=section('Education')
 const education=rawEducation.includes('\n') && !/[|;,]/.test(rawEducation) ? rawEducation.split('\n').join(' | ') : rawEducation
 const name=content.match(/^# ([^\n]+)/)?.[1] || clean(lines.find(line=>line.trim()) || '')
 const email=content.match(/[^\s@<>·]+@[^\s@<>·]+\.[^\s@<>·]+/)?.[0] || ''
 const errors=validateResume({name,email,education,technical:section('Technical Skills')||section('Skills'),role:'Resume'})
 const first=requiredResumeFields.find(key=>errors[key])
 return first ? 'Complete '+({name:'the name',email:'the email',education:'education (qualification | institution)',technical:'skills',role:'the target role'}[first])+' in the editable resume before exporting.' : ''
}
