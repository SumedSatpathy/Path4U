import { validateResume } from './resumeValidation.mjs'
export const roleOptions = ['Software Engineer', 'AI Engineer', 'Data Scientist', 'Data Analyst', 'Cybersecurity Analyst', 'Cloud Engineer', 'Frontend Developer', 'Backend Developer', 'UI/UX Designer', 'FinTech Developer', 'Business Analyst', 'Financial Analyst', 'Product Manager', 'DevOps Engineer', 'Graduate Intern']
const roleSkills = {
  'Software Engineer': ['software', 'testing', 'Git', 'API', 'JavaScript', 'Python'],
  'AI Engineer': ['Python', 'machine learning', 'model', 'evaluation', 'PyTorch', 'deployment'],
  'Data Scientist': ['Python', 'SQL', 'statistics', 'model', 'machine learning', 'pandas'],
  'Data Analyst': ['SQL', 'Excel', 'dashboard', 'visualization', 'Python', 'reporting'],
  'Cybersecurity Analyst': ['security', 'incident', 'network', 'risk', 'SIEM', 'vulnerability'],
  'Cloud Engineer': ['cloud', 'AWS', 'Azure', 'Terraform', 'network', 'deployment'],
  'Frontend Developer': ['JavaScript', 'TypeScript', 'React', 'HTML', 'CSS', 'accessibility'],
  'Backend Developer': ['API', 'SQL', 'database', 'testing', 'Python', 'Node'],
  'UI/UX Designer': ['design', 'research', 'prototype', 'Figma', 'accessibility', 'usability'],
  'FinTech Developer': ['API', 'payments', 'security', 'SQL', 'testing', 'finance'],
  'Business Analyst': ['requirements', 'stakeholder', 'analysis', 'process', 'reporting', 'Excel'],
  'Financial Analyst': ['Excel', 'financial', 'modeling', 'reporting', 'budget', 'forecast'],
  'Product Manager': ['roadmap', 'research', 'metrics', 'strategy', 'stakeholder', 'product'],
  'DevOps Engineer': ['CI/CD', 'Docker', 'Kubernetes', 'Terraform', 'automation', 'monitoring'],
  'Graduate Intern': ['project', 'team', 'education', 'research', 'communication', 'volunteer'],
}
const stop = new Set('about across after also and any are before being both can could for from have into job must our role should skills that their them these they this those through will with work would your required preferred experience years'.split(' '))
const split = value => value.split(/\n+/).map(line => line.trim().replace(/^[-•*]\s*/, '')).filter(Boolean)
const terms = value => [...new Set(value.toLowerCase().match(/[\p{L}][\p{L}\p{N}+#/-]{2,}/gu) ?? [])].filter(word => !stop.has(word))
const phrase = (text, value) => new RegExp('(^|[^\\p{L}\\p{N}])' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^\\p{L}\\p{N}])', 'iu').test(text)
const plain = value => value.replace(/[\r\n]+/g, ' ').trim()
const keywordMatches = (text, words) => words.filter(word => phrase(text, word))
const targets = (role, job) => [...new Set([...(roleSkills[role] ?? terms(role)), ...terms(job).slice(0, 18)])]

export function buildResume(profile) {
  const issues=validateResume(profile)
  if(Object.keys(issues).length) throw new Error('Complete resume information: '+Object.keys(issues).join(', '))
  const { name, email, phone, city, linkedin, github, portfolio, role, level, industry, summary, education, work, internships, projects, technical, soft, certifications, achievements, languages, volunteer, job, template } = profile
  const keywords = targets(role, job)
  const contact = [email, phone, city, linkedin, github, portfolio].map(plain).filter(Boolean).join(' · ')
  const title = [role, level, industry].map(plain).filter(Boolean).join(' · ')
  const add = (heading, value, sort = false) => {
    const items = split(value)
    if (sort) items.sort((a, b) => keywordMatches(b, keywords).length - keywordMatches(a, keywords).length)
    return items.length ? ['## ' + heading, ...items.map(item => '- ' + item), ''].join('\n') : ''
  }
  const identity = ['# ' + plain(name), title, contact, ''].filter((line, index) => index === 0 || line).join('\n')
  const core = summary.trim() ? '## Professional Summary\n' + summary.trim() : ''
  const academics = [add('Education', education), add('Certifications', certifications)]
  const experience = [add('Work Experience', work, true), add('Internships', internships, true)]
  const skills = [add('Technical Skills', technical, true), add('Professional Skills', soft)]
  const project = add('Projects', projects, true)
  const order = template === 'Student & Graduate' ? [...academics, project, ...experience, ...skills]
    : template === 'Modern Technical' ? [...skills, project, ...experience, ...academics]
    : [...experience, ...academics, ...skills, project]
  return [identity, core, ...order, add('Achievements', achievements), add('Volunteer Experience', volunteer), add('Languages', languages)].filter(Boolean).join('\n\n').trim()
}

const generic = [
  [/\bworked on\b/i, 'Contributed to', '“Worked on” does not explain your contribution. Name the part you handled if you can verify it.'],
  [/\bresponsible for\b/i, 'Handled', 'Start with what you did. Add a specific task or outcome from your own experience.'],
  [/\bhelped with\b/i, 'Supported', 'Describe which part you supported and what you delivered.'],
  [/\bdid work on\b/i, 'Contributed to', 'Name the concrete task you completed instead of repeating “work.”'],
]

export function reviewResume(content, role, job = '', careerStage = 'Student / entry level') {
  const raw = split(content)
  const selected = targets(role, job)
  const matched = keywordMatches(content, selected)
  const roleTerms = roleSkills[role] ?? terms(role)
  const matchedRole = keywordMatches(content, roleTerms)
  const headings = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications'].filter(name => new RegExp('(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:[a-z]+\\s+){0,2}' + name + '\\s*:?\\s*(?:\\n|$)', 'i').test(content))
  const evidence = raw.filter(line => /\b(?:built|designed|implemented|created|reduced|improved|developed|managed|trained|deployed|published|delivered|presented|analysed|analyzed|evaluated|led)\b/i.test(line))
  const measurable = evidence.filter(line => /\d+\s*(?:%|users|hours|weeks|members|projects|records|reports|requests|customers|volunteers|students|participants)/i.test(line))
  const long = raw.filter(line => line.split(/\s+/).length > 32)
  const edits = content.split(/\r?\n/).flatMap((line, index) => {
    const candidate = generic.find(([pattern]) => pattern.test(line))
    if (candidate) {
      const [pattern, replacement, reason] = candidate
      return [{ id: index, before: line, after: line.replace(pattern, replacement), reason }]
    }
    const clean = line.trimEnd().replace(/ {2,}/g, ' ')
    return clean !== line ? [{ id: index, before: line, after: clean, reason: 'Consistent spacing makes the text easier to scan.' }] : []
  }).slice(0, 12)
  const ratio = (value, ideal) => Math.min(1, value / Math.max(1, ideal))
  const emails = content.match(/[^\s<>]+@[^\s<>]+/g) ?? []
  const email = emails.find(item => /^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+$/i.test(item))
  const hasName = Boolean(raw[0] && !/^(?:summary|education|skills|projects|experience|resume|curriculum vitae)$/i.test(raw[0]) && !/@/.test(raw[0]) && raw[0].split(/\s+/).length >= 2 && raw[0].length < 100)
  const missingInfo = [!hasName && 'A recognizable full name on the first line', !email && 'A valid contact email', !headings.includes('education') && 'An Education section', !headings.includes('skills') && 'A Skills section', !headings.includes('projects') && !headings.includes('experience') && 'Projects or experience'].filter(Boolean)
  const jobTerms = terms(job).slice(0,18)
  const jobMatches = keywordMatches(content,jobTerms)
  const clarity = raw.length ? (1-long.length/raw.length*.6) * (1-ratio(edits.length,Math.max(4,raw.length))*.2) * ratio(headings.length,3) : 0
  const rubric = [
    { label: 'Contact information and completeness', weight: 15, points: (Number(hasName)+Number(Boolean(email))+Number(headings.includes('education')))/3, note: [hasName?'Name detected':'Name needs review',email?'Valid email detected':'Valid email missing',headings.includes('education')?'Education section detected':'Education section missing'].join(' · '), evidence: raw.filter(line=>line===raw[0] || (email && line.includes(email)) || /education/i.test(line)).slice(0,3) },
    { label: 'Relevant technical skills', weight: 25, points: ratio(matchedRole.length,Math.min(5,roleTerms.length)), note: matchedRole.length+' target-role terms found; keyword presence alone does not prove proficiency.', evidence: raw.filter(line=>keywordMatches(line,roleTerms).length).slice(0,3) },
    { label: 'Projects and experience', weight: 25, points: ratio(evidence.length,careerStage==='Experienced professional'?5:3), note: evidence.length+' concrete action statements. Student projects, research and volunteering count equally; professional employment and numerical metrics are not required.', evidence: evidence.slice(0,3) },
    { label: 'Target job alignment', weight: 20, points: jobTerms.length ? ratio(jobMatches.length,Math.min(10,jobTerms.length)) : ratio(matchedRole.length,Math.min(5,roleTerms.length)), note: jobTerms.length ? jobMatches.length+' of '+jobTerms.length+' extracted job-description terms found. Review relevance manually.' : 'Compared with the selected role. Add a job description for a closer comparison.', evidence: raw.filter(line=>keywordMatches(line,jobTerms.length?jobTerms:roleTerms).length).slice(0,3) },
    { label: 'Clarity and readability', weight: 15, points: clarity, note: headings.length+' recognized sections · '+long.length+' long lines · '+edits.length+' wording or spacing flags. Full grammar is not assessed.', evidence: raw.filter(line=>/^(?:#{1,6}\s*)?(summary|education|skills|projects|experience)/i.test(line)).slice(0,3) },
  ].map(item => ({ ...item, score: Math.round(item.points * 100) / 10 }))
  const score = Math.round(rubric.reduce((sum, item) => sum + item.score * item.weight / 100, 0) * 10) / 10
  const missing = selected.filter(word => !matched.includes(word)).slice(0, 8)
  return { score, rubric, matched, missing, missingInfo, careerStage, evidence: evidence.length, measurable: measurable.length, headings: headings.length, long: long.length, edits }
}

export function applyResumeEdits(content, edits, accepted) {
  const byLine = new Map(edits.filter(edit => accepted.includes(edit.id)).map(edit => [edit.id, edit]))
  return content.split(/\r?\n/).map((line, index) => {
    const edit = byLine.get(index)
    return edit && edit.before === line ? edit.after : line
  }).join('\n')
}
