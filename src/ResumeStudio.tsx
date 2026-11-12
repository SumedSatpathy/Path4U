import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, FilePenLine, FileSearch, Sparkles } from 'lucide-react'
import { applyResumeEdits, buildResume, reviewResume, roleOptions, type ResumeProfile, type ResumeReview } from '../shared/resume.mjs'
import { validateResume, resumeCompletion, requiredResumeFields, resumeHints, validateResumeDocument } from '../shared/resumeValidation.mjs'
import { apiPost, failureMessage, useIntegrationStatus } from './api'
import { readAttachment } from './attachments'
import { DraftEditor } from './DraftEditor'
import { templates, type Draft } from './documents'
import { useLibrary } from './library'
import { Markdown } from './Markdown'
import { useUnsavedChanges } from './routes'
import { useWorkspace } from './workspace'
import './documents.css'

const initial: ResumeProfile = { name: '', email: '', phone: '', city: '', linkedin: '', github: '', portfolio: '', role: 'Graduate Intern', level: '', industry: '', summary: '', education: '', work: '', internships: '', projects: '', technical: '', soft: '', certifications: '', achievements: '', languages: '', volunteer: '', job: '', template: 'Student & Graduate' }

const sample = `Jamie Lee
jamie@example.test

Summary
Student interested in frontend development and accessible web experiences.

Education
BSc Computer Science, Example University

Projects
Worked on a course website with React and TypeScript.
Built a dashboard for 24 student volunteers.

Skills
HTML, CSS, React, TypeScript, Git`

function Role({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="field">Target role<input list="path4u-resume-roles" value={value} maxLength={100} onChange={event => onChange(event.target.value)} /><datalist id="path4u-resume-roles">{roleOptions.map(role => <option key={role} value={role} />)}</datalist></label>
}

export function ResumeStudio() {
  const [mode, setMode] = useState<'create' | 'review' | null>(null)
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState(initial)
  const [draft, setDraft] = useState<{ id: string; value: Draft } | null>(null)
  const [source, setSource] = useState('')
  const [review, setReview] = useState<ResumeReview | null>(null)
  const [accepted, setAccepted] = useState<Record<number, boolean>>({})
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify({profile:initial,source:'',draft:null}))
  useUnsavedChanges(JSON.stringify({profile,source,draft:draft?.value ?? null}) !== savedSnapshot)
  const currentDraft = useRef<Draft | null>(null)
  const recordDraft = useCallback((value: Draft) => { currentDraft.current = value }, [])
  const [section, setSection] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')
  const [share, setShare] = useState(false)
  const [careerStage,setCareerStage] = useState('Student / entry level')
  const library = useLibrary<Draft>('draft')
  const integration = useIntegrationStatus()
  const { demo } = useWorkspace()
  const change = (key: keyof ResumeProfile, value: string) => setProfile(current => ({ ...current, [key]: value }))
  const [touched,setTouched] = useState<Partial<Record<keyof ResumeProfile,boolean>>>({})
  const [focusKey,setFocusKey] = useState<keyof ResumeProfile | null>(null)
  const issues = validateResume(profile)
  useEffect(()=> { if(focusKey) { const field=document.getElementById('resume-'+focusKey); field?.focus(); field?.scrollIntoView({block:'center'}); setFocusKey(null) } },[focusKey,step])
  const field = (key: keyof ResumeProfile, label: string, multiline = false) => {
    const issue=touched[key] ? issues[key] : undefined
    const props={'aria-label':label, id:'resume-'+key, value:profile[key], 'aria-required':requiredResumeFields.includes(key), 'aria-invalid':Boolean(issue), 'aria-describedby':issue ? 'resume-'+key+'-error' : resumeHints[key] ? 'resume-'+key+'-hint' : undefined, onBlur:()=>setTouched(current=>({...current,[key]:true})), onChange:(event: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>change(key,event.target.value)}
    return <label key={key} className="field">{label}{requiredResumeFields.includes(key) && <span aria-hidden="true"> *</span>}
      {multiline ? <textarea {...props} className="resize-none" rows={3} maxLength={key==='job' ? 10000 : 1200}/> : <input {...props} type={key==='email' ? 'email' : key==='phone' ? 'tel' : 'text'} maxLength={key==='email' ? 254 : 160}/>}
      {resumeHints[key] && <small className="field-help" id={'resume-'+key+'-hint'}>{resumeHints[key]}</small>}
      {issue && <small className="field-error" id={'resume-'+key+'-error'}>{issue}</small>}
    </label>
  }
  function check(keys: (keyof ResumeProfile)[]) {
    setTouched(current=>({...current,...Object.fromEntries(keys.map(key=>[key,true]))}))
    const first=keys.find(key=>issues[key]);if(!first) return true
    setStep(['name','email','phone','city','linkedin','github','portfolio'].includes(first) ? 0 : ['role','level','industry','job','template'].includes(first) ? 2 : 1)
    setFocusKey(first);return false
  }

  async function upload(file: File, key: 'job' | 'resume') {
    setLoading('Reading document…'); setError('')
    try {
      const attachment = await readAttachment(file, true)
      if (!attachment.text) throw new Error('No selectable text found in the document.')
      if (key === 'job') change('job', attachment.text.slice(0, 10_000))
      else { setSource(attachment.text); setReview(null); setNotes('') }
    } catch (failure) { setError(failureMessage(failure)) }
    finally { setLoading('') }
  }

  const uploadField = (key: 'job' | 'resume', label: string) => <label className="field">{label}<input type="file" accept=".pdf,.docx,.txt" disabled={!!loading} onChange={event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void upload(file, key)
  }} /></label>

  function next() {
    setError('')
    if(!check(step===0 ? ['name','email','phone','linkedin','github','portfolio'] : step===1 ? ['education','technical','soft','work','internships','projects','certifications','summary'] : Object.keys(profile) as (keyof ResumeProfile)[])) return
    if(step<2) {setStep(step+1);return}
    const content = buildResume(profile)
    setDraft({ id: draft?.id ?? crypto.randomUUID(), value: { title: profile.name.trim() + ' Resume', content, template: profile.template as Draft['template'] } })
  }

  function regenerateSection() {
    if (!draft || !section || !currentDraft.current || !check(Object.keys(profile) as (keyof ResumeProfile)[])) return
    const result = buildResume(profile)
    const extract = (document: string) => {
      const marker = '## ' + section
      const lines = document.split('\n')
      const start = lines.indexOf(marker)
      if (start < 0) return null
      const next = lines.findIndex((line, index) => index > start && /^#{1,2} /.test(line))
      return { start, end: next < 0 ? lines.length : next, lines }
    }
    const rebuilt = extract(result)
    const previous = extract(currentDraft.current.content)
    if (!rebuilt || !previous) { setError('This section is missing from the form or draft.'); return }
    const replacement = rebuilt.lines.slice(rebuilt.start, rebuilt.end)
    previous.lines.splice(previous.start, previous.end - previous.start, ...replacement)
    setDraft({ id: draft.id, value: { ...currentDraft.current, content: previous.lines.join('\n').trim() } })
    setError('')
  }

  function analyze(text = source) {
    if (text.trim().length < 40 || !profile.role.trim()) { setError('Add at least 40 characters of resume text and choose a target role.'); return }
    setError(''); setReview(reviewResume(text, profile.role, profile.job, careerStage)); setAccepted({}); setDraft(null); setNotes('')
  }

  async function aiReview() {
    if (!share || !integration.gemini || !integration.privateAI) return
    setLoading('Requesting Gemini feedback…'); setError('')
    try {
      const data = new TextEncoder().encode(source)
      const attachment = { mime: 'text/plain', data: btoa(Array.from(data, byte => String.fromCharCode(byte)).join('')) }
      const result = await apiPost<{ answer: string; warning?: string }>('assistant', {
        privateDataConsent: share, action: 'chat', message: 'Review the attached resume for ' + profile.role + '. Explain concrete improvements without adding facts. The advisory score is handled separately. Job context: ' + profile.job.slice(0, 1100), attachment,
      })
      setNotes(result.answer)
      if (result.warning) setError(result.warning)
    } catch (failure) { setError(failureMessage(failure)) }
    finally { setLoading('') }
  }

  return <div className="learning-page resume-page">
    <header><p className="eyebrow">Application workspace</p><h1>Path4U Resume Studio</h1><p>Create a resume from your experience, or review an existing one against a target role.</p></header>
    <div className="resume-mode" aria-label="Resume tools">
      <button type="button" className="panel resume-mode-card" aria-pressed={mode === 'create'} onClick={() => { setMode('create'); setDraft(null); setError('') }}><FilePenLine size={23} /><strong>Create Resume</strong><span>Build and export an editable, role-specific resume.</span><ArrowRight size={18} /></button>
      <button type="button" className="panel resume-mode-card" aria-pressed={mode === 'review'} onClick={() => { setMode('review'); setDraft(null); setError('') }}><FileSearch size={23} /><strong>Analyze Resume</strong><span>See an advisory score and review suggested changes.</span><ArrowRight size={18} /></button>
    </div>
    {mode === 'create' && <section className="panel learning-card">
      <p role="status">Resume information: {resumeCompletion(profile)}% complete.</p><progress max={100} value={resumeCompletion(profile)} aria-label="Required resume information complete" /><p className="field-help">Fields marked * are required; other sections are optional.</p><div><p className="eyebrow">Step {step + 1} of 3</p><h2>{['Contact details', 'Experience and education', 'Target role and layout'][step]}</h2></div>
      {demo && <p className="muted">Use sample details in the demo. Saved drafts stay in this browser.</p>}
      {step === 0 && <div className="resume-fields">{field('name', 'Full name')}{field('email', 'Professional email')}{field('phone', 'Phone (optional)')}{field('city', 'City and country')}{field('linkedin', 'LinkedIn (optional)')}{field('github', 'GitHub (optional)')}{field('portfolio', 'Portfolio (optional)')}</div>}
      {step === 1 && <div className="resume-fields">
        {field('summary', 'Professional summary', true)}{field('education', 'Education', true)}{field('work', 'Work experience', true)}{field('internships', 'Internships', true)}{field('projects', 'Projects', true)}{field('technical', 'Technical skills', true)}{field('soft', 'Professional skills', true)}{field('certifications', 'Certifications', true)}{field('achievements', 'Achievements', true)}{field('volunteer', 'Volunteer experience (optional)', true)}{field('languages', 'Languages (optional)', true)}
      </div>}
      {step === 2 && <><div className="resume-fields"><label className="field">Target role <span aria-hidden="true">*</span><input aria-required="true" id="resume-role" list="path4u-target-roles" value={profile.role} aria-invalid={Boolean(touched.role && issues.role)} aria-describedby={touched.role && issues.role ? 'resume-role-error' : undefined} onBlur={()=>setTouched(current=>({...current,role:true}))} onChange={event=>change('role',event.target.value)}/><datalist id="path4u-target-roles">{roleOptions.map(role=><option key={role}>{role}</option>)}</datalist>{touched.role && issues.role && <small id="resume-role-error" className="field-error">{issues.role}</small>}</label>{field('level', 'Career level')}{field('industry', 'Industry or specialization')}<label className="field">Resume template<select value={profile.template} onChange={event => change('template', event.target.value)}>{templates.map(item => <option key={item}>{item}</option>)}</select></label></div>
        {field('job','Job description (optional)',true)}
        {uploadField('job', 'Read a job description file')}</>}
      <div className="draft-toolbar">{step > 0 && <button type="button" className="button button-secondary" onClick={() => { setStep(step - 1); setError('') }}><ArrowLeft size={16} /> Previous step</button>}<button type="button" className="button button-primary" disabled={!!loading} onClick={next}>{step < 2 ? 'Continue' : draft ? 'Rebuild from form' : 'Build resume'} <ArrowRight size={16} /></button></div>
    </section>}
    {mode === 'review' && <section className="panel learning-card">
      <h2>Resume review</h2><p className="field-help">Scoring and wording checks run on your device. Private resumes are not sent to the free Gemini service.</p><label className="field">Career stage<select value={careerStage} onChange={event=>{setCareerStage(event.target.value);setReview(null)}}><option>Student / entry level</option><option>Experienced professional</option></select></label><p className="muted">Use selectable text from PDF, DOCX or TXT files up to 2.5 MB. Files open on your device.</p>
      <div className="resume-fields"><Role value={profile.role} onChange={value => { change('role', value); setReview(null) }} />{uploadField('resume', 'Open a resume file')}</div>
      <label className="field">Resume text<textarea className="resize-none" rows={8} value={source} maxLength={20_000} onChange={event => { setSource(event.target.value); setReview(null); setDraft(null); setNotes('') }} /></label>
      <label className="field">Job description (optional)<textarea className="resize-none" rows={3} value={profile.job} maxLength={10_000} onChange={event => { change('job', event.target.value); setReview(null) }} /></label>
      <div className="draft-toolbar"><button type="button" className="button button-primary" disabled={!!loading} onClick={() => analyze()}>Score resume</button><button type="button" className="button button-secondary" onClick={() => { setSource(sample); setReview(null); setDraft(null); setNotes('') }}>Use sample resume</button></div>
      {review && <>
        <div className="resume-score"><strong>{review.score.toFixed(1)} <span>/ 10</span></strong><div><h3>Path4U Resume Quality Score</h3><p>Based on text checks. It does not predict hiring outcomes or ATS results.</p></div></div>
        <div className="resume-rubric">{review.rubric.map(item => <div key={item.label}><div><strong>{item.label}</strong><span>{item.score.toFixed(1)}/10 · {item.weight}% weight</span></div><progress max={10} value={item.score} aria-label={item.label} /><p>{item.note}</p>{item.evidence.length > 0 && <details><summary>Evidence from your resume</summary>{item.evidence.map((line,index)=><blockquote key={index}>{line}</blockquote>)}</details>}</div>)}</div>
        <div className="resume-fields"><section><h3>Strengths</h3><p>{review.matched.length ? 'Relevant terms found: ' + review.matched.join(', ') : 'No target terms were detected. Check that you selected the right role.'}</p><p>{review.evidence} statements start from a detectable action. {review.headings} section headings were detected.</p></section>
          <section><h3>Where to improve</h3><p>{review.missing.length ? 'Consider these terms only if supported by your experience: ' + review.missing.join(', ') : 'Review the job description for specific evidence to include.'}</p><p>Describe what you did, what you produced and any result you can verify. {review.long ? 'Shorten ' + review.long + ' long lines for easier reading.' : ''}</p></section></div>
        {review.missingInfo.length > 0 && <section><h3>Missing information</h3><ul>{review.missingInfo.map(item=><li key={item}>{item}</li>)}</ul></section>}<h3>Review suggested edits</h3>
        {review.edits.length === 0 && <p className="muted">No automatic wording changes were found. You can still edit the draft below.</p>}
        {review.edits.map(edit => <article key={edit.id} className="resume-comparison"><div className="resume-fields"><p><strong>Original</strong><span>{edit.before}</span></p><p><strong>Suggested</strong><span>{edit.after}</span></p></div><p>{edit.reason}</p><div className="draft-toolbar"><button type="button" className="button button-secondary button-small" aria-pressed={accepted[edit.id] === true} onClick={() => setAccepted({ ...accepted, [edit.id]: true })}><Check size={15} /> Accept</button><button type="button" className="button button-secondary button-small" aria-pressed={accepted[edit.id] === false} onClick={() => setAccepted({ ...accepted, [edit.id]: false })}>Reject</button></div></article>)}
        <div className="draft-toolbar"><button type="button" className="button button-primary" onClick={() => setDraft({ id: draft?.id ?? crypto.randomUUID(), value: { title: 'Reviewed Resume', content: applyResumeEdits(source, review.edits, Object.keys(accepted).filter(id => accepted[Number(id)]).map(Number)), template: 'Classic Professional' } })}>Apply selected edits and open draft</button></div>
        {!demo && integration.gemini && integration.privateAI && <><label className="learning-check"><input type="checkbox" checked={share} onChange={event => setShare(event.target.checked)} /> Share resume text with Gemini for writing feedback</label><button type="button" className="button button-secondary" disabled={!share || !!loading} onClick={() => void aiReview()}><Sparkles size={15} /> Get Gemini feedback</button>{notes && <Markdown value={notes} />}</>}
      </>}
    </section>}
    {loading && <p role="status">{loading}</p>}
    {error && <p role="alert" className="field-error">{error}</p>}
    {draft && <section className="panel learning-card"><h2>Editable resume draft</h2><p className="muted">{library.demo ? 'Drafts save to this browser.' : 'Drafts save to your private account.'} Verify every claim before exporting.</p>
      <DraftEditor exportError={mode==='create' && Object.keys(issues).length ? 'Correct the resume form fields before exporting.' : undefined} validateExport={value=>validateResumeDocument(value.content)} key={draft.id + draft.value.content} draft={draft.value} onChange={recordDraft} onSave={async value => { const result = await library.save(draft.id,value); setSavedSnapshot(JSON.stringify({profile,source,draft:draft.value})); return result }} />
      {mode === 'create' && <div className="draft-toolbar"><label className="field">Resume section<select value={section} onChange={event => setSection(event.target.value)}><option value="">Choose a section</option>{Array.from(draft.value.content.matchAll(/^## (.+)$/gm), match => match[1]).map(title => <option key={title}>{title}</option>)}</select></label><button type="button" className="button button-secondary" disabled={!section} onClick={regenerateSection}>Regenerate selected section</button></div>}
      {mode === 'review' && <button type="button" className="button button-secondary" onClick={() => { const text = currentDraft.current?.content ?? draft.value.content; setSource(text); analyze(text) }}>Reanalyze current draft</button>}
    </section>}
  </div>
}
