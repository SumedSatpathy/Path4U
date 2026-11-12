import { useLayoutEffect, useRef, useState } from 'react'
import { Activity, ArrowRight, Check, CircleAlert, Clipboard, FileText, ListFilter, Mail, ScanText, Table2, Upload } from 'lucide-react'
import { apiPost, failureMessage, useIntegrationStatus } from './api'
import { formatDate, type Opportunity } from './data'
import { analyzeLocally, buildLocalDraft, rankOpportunity, sampleResume, type Analysis, type ApplicationDraft } from './engine'
import { href, navigate, useUnsavedChanges } from './routes'
import { Dialog, EmptyState } from './ui'
import { applicationStatuses, useWorkspace, type ApplicationStatus, type TrackedApplication } from './workspace'
import { EmailActions, emailTemplate, emailTones, emailTypes } from './EmailActions'
import './studio.css'
import './documents.css'

const steps = [
  { label: 'Analyze resume', short: 'Analyze', icon: ScanText },
  { label: 'Rank matches', short: 'Rank', icon: ListFilter },
  { label: 'Prepare drafts', short: 'Draft', icon: FileText },
  { label: 'Track applications', short: 'Track', icon: Activity },
]

const emptyAnalysis: Analysis = { skills: [], evidence: [] }
const resumeLimit = 20_000
const minimumResumeMessage = 'Enter at least 25 characters of resume text.'

export function StudioPage({ params }: { params: URLSearchParams }) {
  const { state, setApplicationStatus, notify, demo, catalog: opportunities } = useWorkspace()
  const configured = useIntegrationStatus()
  const service = demo ? { gemini: false, gmail: false, sheets: false, privateAI: false } : configured
  const [privateConsent,setPrivateConsent] = useState(false)
  const role = opportunities.find(item => item.id === params.get('opportunity')) ?? opportunities[0]
  const initialStep = params.get('step') === 'track' ? 3 : params.get('step') === 'rank' ? 1 : params.get('opportunity') ? 2 : 0
  const [step, setStep] = useState(initialStep)
  const [resume, setResume] = useState(demo ? sampleResume : '')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisMode, setAnalysisMode] = useState<'local' | 'gemini'>('local')
  const [sample, setSample] = useState(demo)
  const [confirmApplied, setConfirmApplied] = useState<Opportunity | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { content: ApplicationDraft; mode: 'local' | 'gemini' }>>({})
  const [draftTab, setDraftTab] = useState<'resume' | 'cover' | 'email'>('resume')
  const [emailType, setEmailType] = useState<typeof emailTypes[number]>('Professional email')
  const [emailTone, setEmailTone] = useState<typeof emailTones[number]>('Professional')
  const [recipient, setRecipient] = useState('')
  const [gmailResult, setGmailResult] = useState<{ id: string; requestId: string } | null>(null)
  const gmailRequests = useRef(new Map<string, string>())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [synced, setSynced] = useState<Record<string, string>>({})
  const resumeField = useRef<HTMLTextAreaElement>(null)
  const stepContent = useRef<HTMLDivElement>(null)
  const moveStepFocus = useRef(false)
  const busyRef = useRef(false)
  useUnsavedChanges(resume !== (demo ? sampleResume : '') || Object.keys(drafts).length > 0 || Boolean(recipient))
  const draft = drafts[role?.id ?? '']
  const ranked = opportunities.map(item => rankOpportunity(item, analysis ?? emptyAnalysis, state.profile))
    .sort((a, b) => a.reviewCount - b.reviewCount || b.score - a.score || a.opportunity.title.localeCompare(b.opportunity.title))
  const tracked = Object.values(state.applications).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  useLayoutEffect(() => {
    if (moveStepFocus.current) {
      moveStepFocus.current = false
      stepContent.current?.focus()
    }
  }, [step])

  function selectStep(next: number, focusContent = true) {
    moveStepFocus.current = focusContent && next !== step
    setStep(next)
    setError('')
  }

  function selectRole(id: string) {
    navigate('/application', new URLSearchParams({ opportunity: id }), { replace: true })
    setGmailResult(null)
    setError('')
  }

  async function run(action: string, job: () => void | Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(action)
    setError('')
    try { await job() } catch (failure) { setError(failureMessage(failure)) }
    finally { busyRef.current = false; setBusy(null) }
  }

  function changeResume(text: string, isSample = false) {
    setResume(text)
    setSample(isSample)
    setAnalysis(null)
    setError('')
  }

  function submitAnalysis(event: { preventDefault: () => void }, remote: boolean) {
    event.preventDefault()
    if (resume.trim().length < 25) {
      setError(minimumResumeMessage)
      resumeField.current?.focus()
      return
    }
    void run('analysis', async () => {
      setAnalysis(remote ? await apiPost<Analysis>('analyze', { resume, privateDataConsent: privateConsent }) : analyzeLocally(resume, opportunities))
      setAnalysisMode(remote ? 'gemini' : 'local')
    })
  }

  function generateDraft(remote: boolean) {
    void run('draft', async () => {
      const candidate = analysis ?? emptyAnalysis
      const content = remote ? await apiPost<ApplicationDraft>('draft', {
        privateDataConsent: privateConsent, title: role.title, organization: role.organization, requirements: role.requirements,
        skills: candidate.skills, evidence: candidate.evidence, name: state.profile.name,
      }) : buildLocalDraft(role, candidate, state.profile)
      setDrafts(current => ({ ...current, [role.id]: { content, mode: remote ? 'gemini' : 'local' } }))
      setGmailResult(null)
    })
  }

  function editDraft(key: keyof ApplicationDraft, value: string) {
    if (!draft) return
    setDrafts(current => ({ ...current, [role.id]: { ...draft, content: { ...draft.content, [key]: value } } }))
    setGmailResult(null)
  }

  function saveGmail() {
    if (!draft) return
    const payload = { subject: draft.content.subject.trim(), body: draft.content.email.trim(), recipient: recipient.trim() }
    if (!payload.subject || !payload.body || (payload.recipient && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(payload.recipient))) {
      setError('Enter a subject, message, and a valid email address if adding a recipient.')
      return
    }
    const key = JSON.stringify(payload)
    const requestId = gmailRequests.current.get(key) ?? crypto.randomUUID()
    gmailRequests.current.set(key, requestId)
    void run('gmail', async () => {
      const response = await apiPost<{ id: string }>('gmail-draft', { ...payload, requestId })
      setGmailResult({ id: response.id, requestId })
    })
  }

  function syncTracker(item: TrackedApplication, opportunity: Opportunity) {
    void run('sheets-' + item.opportunityId, async () => {
      await apiPost<{ synced: true }>('tracker', { ...item, title: opportunity.title, organization: opportunity.organization })
      setSynced(previous => ({ ...previous, [item.opportunityId]: item.updatedAt }))
    })
  }

  if (!role) return <EmptyState title="No opportunities yet" description="A catalog listing is required to prepare an application." />

  return <div className="studio-page">
    <header className="studio-head">
      <div className="studio-head-copy">
        <p className="eyebrow">Career Atlas <span aria-hidden="true">/</span> Application desk</p>
        <h1>Application Command Center</h1>
        <p>Build a shortlist from your resume, prepare each application, and keep track of what you send.</p>
      </div>
      <dl className="studio-index">
        <div><dt>Workspace</dt><dd>{demo ? 'Fictional demo' : 'Private workspace'}</dd></div>
        <div><dt>Applications tracked</dt><dd>{tracked.length}</dd></div>
      </dl>
    </header>
    <nav className="studio-steps" aria-label="Application workflow">
      {steps.map((item, index) => <button type="button" key={item.label} aria-current={index === step ? 'step' : undefined} aria-label={item.label} disabled={!!busy} onClick={() => selectStep(index, false)}>
        <span className="studio-step-number" aria-hidden="true">0{index + 1}</span>
        <item.icon className="studio-step-icon" size={17} aria-hidden="true" />
        <span className="studio-step-long">{item.label}</span><span className="studio-step-short">{item.short}</span>
      </button>)}
    </nav>
    {error && <p id="studio-error" className="studio-error" role="alert"><CircleAlert size={18} aria-hidden="true" />{error}</p>}
    <div className="studio-step-content" ref={stepContent} tabIndex={-1} role="region" aria-label={steps[step].label}>
    {step === 0 && <div className="studio-grid">
      <form className="panel studio-panel" noValidate onSubmit={event => submitAnalysis(event, false)}>
        <div className="studio-panel-heading"><p className="eyebrow">01 / Candidate material</p><h2>Start with your resume</h2><p className="muted" id="studio-resume-help">{demo ? 'The demo uses a fictional resume.' : 'Paste resume text or open a plain-text file. Your text stays in this tab when you analyze locally.'}</p></div>
        <label className="field">Resume text<textarea className="resize-none" ref={resumeField} value={resume} rows={8} maxLength={resumeLimit} readOnly={demo} disabled={!!busy}
          aria-invalid={error === minimumResumeMessage || undefined} aria-describedby={error === minimumResumeMessage ? 'studio-resume-help studio-error' : 'studio-resume-help'}
          placeholder="Include skills, projects, and relevant work experience." onChange={event => changeResume(event.target.value)} /></label>
        <div className="choice-row">
          {!demo && <label className="button button-secondary studio-upload"><Upload size={16} /> Open .txt or .md
            <input type="file" accept=".txt,.md,text/plain,text/markdown" aria-label="Open text resume" disabled={!!busy} onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (!/\.(txt|md)$/i.test(file.name) || file.size > 80_000) { setError('Choose a .txt or .md file under 80 KB.'); return }
              void run('file', async () => {
                const text = await file.text()
                if (text.length > resumeLimit) throw new Error('Use a resume with 20,000 characters or fewer.')
                changeResume(text)
              })
            }} />
          </label>}
          <button className="button button-ghost" type="button" onClick={() => changeResume(sampleResume, true)} disabled={!!busy}>Use sample resume</button>
        </div>
        <div className="choice-row">
          <button className="button button-primary" type="submit" disabled={!!busy}>{busy === 'analysis' ? 'Analyzing…' : 'Analyze locally'} <ArrowRight size={16} /></button>
          {service.gemini && service.privateAI && <button className="button button-secondary" type="button" disabled={!!busy || !privateConsent} onClick={event => submitAnalysis(event, true)}>Analyze with Gemini</button>}
        </div>
        {service.gemini && service.privateAI && <label className="learning-check"><input type="checkbox" checked={privateConsent} onChange={event=>setPrivateConsent(event.target.checked)} /> I consent to sharing these resume details with the approved Gemini service for analysis and drafting.</label>}
      </form>
      <section className="panel studio-panel studio-evidence-panel" aria-live="polite" aria-busy={busy === 'analysis'}>
        <div className="studio-panel-heading"><p className="eyebrow">Review notes</p><h2>Skills and evidence</h2></div>
        {analysis ? <>
          <p className="muted">{sample ? 'Fictional resume · ' : ''}{analysisMode === 'gemini' ? 'Gemini extraction' : 'Local skill matching'}</p>
          <div className="studio-pills">{analysis.skills.length ? analysis.skills.map(skill => <span className="pill" key={skill}>{skill}</span>) : <p className="muted">No supported skills were identified. Add specific tools or project details and try again.</p>}</div>
          {!!analysis.evidence.length && <><h3>Resume evidence</h3><ul className="studio-evidence">{analysis.evidence.map((line, index) => <li key={index}>{line}</li>)}</ul></>}
          <button className="button button-secondary studio-start" type="button" onClick={() => selectStep(1)}>Rank my matches <ArrowRight size={16} /></button>
        </> : <div className="studio-evidence-empty">
          <FileText size={21} aria-hidden="true" />
          <p>Analyze your resume to see the skills and excerpts that will inform your shortlist.</p>
        </div>}
      </section>
    </div>}
    {step === 1 && <section className="panel studio-panel">
      <div className="studio-panel-heading"><p className="eyebrow">02 / Role comparison</p><h2>Ranked opportunities</h2><p className="muted">Profile checks set the order, followed by how closely your resume matches each role’s requested skills. Confirm eligibility with the organizer.</p></div>
      <div className="choice-row"><a className="button button-secondary button-small" href={href('/discover')}>Search and filter opportunities</a><a className="button button-ghost button-small" href={href('/profile')}>Edit matching preferences</a></div>
      {!analysis ? <EmptyState title="Add resume evidence to rank matches" description="Analyze your own text or use the fictional sample to see an explainable ranking."
        action={<button className="button button-primary" onClick={() => selectStep(0)}>Analyze resume</button>} /> :
        <div className="studio-ranking">
          {ranked.map(({ opportunity, matched, gaps, score, requirements, reviewCount }, index) => <article className="studio-match" key={opportunity.id}>
            <div className="studio-match-head"><span className="studio-rank-number" aria-label={'Rank ' + (index + 1)}>{String(index + 1).padStart(2, '0')}</span><div><h3><a href={href('/opportunity/' + opportunity.id)}>{opportunity.title}</a></h3><p className="muted">{opportunity.organization} · {opportunity.location}{demo && ' · Fictional listing'}</p></div><span className="fit-pill">{score}% skill fit</span></div>
            <div className="studio-pills">{requirements.map(item => <span key={item.label} className={'pill ' + (item.pass ? 'studio-pass' : 'studio-review')}>{item.pass ? <Check size={13} /> : <CircleAlert size={13} />}{item.label} · {item.pass ? 'Matches' : 'Review'}</span>)}</div>
            <p><strong>Matching skills</strong> {matched.join(', ') || 'None identified'}</p>
            <p><strong>Skills to review</strong> {gaps.join(', ') || 'All listed skills detected'}</p>
            <button type="button" className="button button-secondary button-small studio-start" onClick={() => { selectRole(opportunity.id); selectStep(2) }}>{reviewCount ? 'Review and prepare draft' : 'Prepare application'} <ArrowRight size={15} /></button>
          </article>)}
        </div>}
    </section>}
    {step === 2 && <div className="studio-grid studio-draft-grid">
      <section className="panel studio-panel">
        <div className="studio-panel-heading"><p className="eyebrow">03 / Role brief</p><h2>Choose an opportunity</h2></div>
        <label className="field">Opportunity<select value={role.id} onChange={event => selectRole(event.target.value)} disabled={!!busy}>
          {opportunities.map(item => <option key={item.id} value={item.id}>{item.title} · {item.organization}</option>)}
        </select></label>
        <p className="muted">{role.organization} · {role.location}{demo && ' · Fictional listing'}</p>
        <ul className="studio-evidence">{role.requirements.map(item => <li key={item}>{item}</li>)}</ul>
        <p className="muted">{analysis ? 'Drafts use your extracted resume evidence.' : 'You can start with a template or analyze your resume to personalize it.'}</p>
        <div className="choice-row">
          <button type="button" className="button button-primary" disabled={!!busy || !!draft} onClick={() => generateDraft(false)}>{busy === 'draft' ? 'Generating…' : 'Generate local draft'}</button>
          {service.gemini && service.privateAI && <button type="button" className="button button-secondary" disabled={!!busy || !!draft || !analysis || !privateConsent} onClick={() => generateDraft(true)}>Draft with Gemini</button>}
        </div>
        {service.gemini && service.privateAI && <p className="field-help">Draft with Gemini shares extracted skills and resume excerpts with the configured Google service.</p>}
        <a className="text-link studio-start" href={href('/opportunity/' + role.id)}>Read listing <ArrowRight size={15} /></a>
      </section>
      <section className="panel studio-panel">
        <div className="studio-panel-heading"><p className="eyebrow">Review desk</p><h2>Application drafts</h2><p className="muted">Verify each claim and replace placeholders before submitting through the organizer’s application channel.</p></div>
        {draft ? <>
          <div className="choice-row studio-draft-choices" role="group" aria-label="Draft type">
            {([{ id: 'resume', label: 'Resume' }, { id: 'cover', label: 'Cover letter' }, { id: 'email', label: 'Email' }] as const).map(item =>
              <button className="button button-secondary button-small" type="button" aria-pressed={draftTab === item.id} key={item.id} onClick={() => setDraftTab(item.id)}>{item.label}</button>)}
          </div>
          <p className="field-help">{draft.mode === 'gemini' ? 'Gemini draft' : 'Local draft'} · Edits stay in this view until you leave or reload.</p>
          {draftTab === 'email' && <label className="field">Email subject<input value={draft.content.subject} maxLength={160} disabled={!!busy} onChange={event => editDraft('subject', event.target.value)} /></label>}
          <label className="field">{draftTab === 'resume' ? 'Tailoring suggestions' : draftTab === 'cover' ? 'Cover letter' : 'Email body'}
            <textarea className="resize-none" rows={9} value={draft.content[draftTab]} maxLength={12000} disabled={!!busy} onChange={event => editDraft(draftTab, event.target.value)} />
          </label>
          {draftTab === 'email' && <label className="field">Recipient <span className="field-help">Optional.</span><input type="email" value={recipient} maxLength={254} disabled={!!busy} onChange={event => { setRecipient(event.target.value); setGmailResult(null) }} /></label>}
          {draftTab === 'email' && <>
            <div className="draft-fields"><label className="field">Email type<select value={emailType} onChange={event => setEmailType(event.target.value as typeof emailType)}>{emailTypes.map(item => <option key={item}>{item}</option>)}</select></label><label className="field">Tone<select value={emailTone} onChange={event => setEmailTone(event.target.value as typeof emailTone)}>{emailTones.map(item => <option key={item}>{item}</option>)}</select></label></div>
            <button type="button" className="button button-secondary button-small" onClick={() => {
              const email = emailTemplate(emailType, emailTone, state.profile.name)
              setDrafts(current => ({ ...current, [role.id]: { mode: 'local', content: { ...draft.content, email: email.body, subject: email.subject } } }))
              setGmailResult(null)
            }}>Replace with selected template</button>
            <EmailActions recipient={recipient} subject={draft.content.subject} body={draft.content.email} />
          </>}
          <div className="choice-row">
            {draftTab !== 'email' && <button className="button button-secondary button-small" type="button" disabled={!!busy} onClick={() => void run('copy', async () => { await navigator.clipboard.writeText(draft.content[draftTab]); notify('Draft copied') })}><Clipboard size={15} /> Copy text</button>}
            {draftTab === 'email' && service.gmail && <button className="button button-secondary button-small" type="button" disabled={!!busy || !!gmailResult} onClick={saveGmail}><Mail size={15} /> {busy === 'gmail' ? 'Saving draft…' : 'Save Gmail draft'}</button>}
            <button className="button button-primary button-small" type="button" disabled={!!busy} onClick={() => {
              if (state.applications[role.id] || setApplicationStatus(role.id, 'Preparing')) selectStep(3)
            }}>Track application <ArrowRight size={15} /></button>
          </div>
          {gmailResult && <p role="status" className="studio-pass"><Check size={16} /> Gmail confirmed the unsent draft. <a className="text-link" href="https://mail.google.com/mail/#drafts" target="_blank" rel="noreferrer">Open Gmail Drafts</a></p>}
        </> : <p className="muted">Generate a draft to edit resume suggestions, a cover letter, and an email.</p>}
      </section>
    </div>}
    {step === 3 && <section className="panel studio-panel">
      <div className="studio-panel-heading"><p className="eyebrow">04 / Application record</p><h2>Application tracker</h2><p className="muted">Record progress after you take action through the organizer’s application channel.</p></div>
      <div className="studio-pills">{applicationStatuses.map(status => <span className="pill" key={status}>{status} · {tracked.filter(item => item.status === status).length}</span>)}</div>
      {tracked.length ? <div className="studio-tracker">
        {tracked.map(item => {
          const opportunity = opportunities.find(candidate => candidate.id === item.opportunityId)
          if (!opportunity) return null
          return <article className="studio-tracker-row" key={item.opportunityId}>
            <div><h3><a href={href('/opportunity/' + opportunity.id)}>{opportunity.title}</a></h3><p className="muted">{opportunity.organization} · Updated {formatDate(item.updatedAt)}</p></div>
            <label className="field studio-status">Status<select aria-label={'Status for ' + opportunity.title} value={item.status} disabled={!!busy} onChange={event => {
              const status = event.target.value as ApplicationStatus
              if (status === 'Applied') setConfirmApplied(opportunity)
              else setApplicationStatus(item.opportunityId, status)
            }}>
              {applicationStatuses.map(status => <option key={status}>{status}</option>)}
            </select></label>
            {service.sheets && <button className="button button-secondary button-small" type="button" disabled={!!busy || synced[item.opportunityId] === item.updatedAt} onClick={() => syncTracker(item, opportunity)}><Table2 size={15} />{synced[item.opportunityId] === item.updatedAt ? 'Synced to Sheets' : 'Sync to Sheets'}</button>}
          </article>
        })}
      </div> : <EmptyState title="No applications tracked yet" description="Prepare an application and add it to this tracker to record your progress."
        action={<button className="button button-primary" onClick={() => selectStep(2)}>Prepare a draft</button>} />}
      <p className="field-help">{service.sheets ? 'Sync sends the role, status, and update date to the configured Google Sheet.' : 'Tracker entries are stored in this browser. Google Sheets sync is available on a configured local server.'}</p>
    </section>}
    </div>
    <Dialog open={Boolean(confirmApplied)} onClose={() => setConfirmApplied(null)} title="Confirm application status"
      description="Mark this opportunity as applied after you have submitted it through the organizer’s channel.">
      <div className="choice-row">
        <button className="button button-secondary" type="button" onClick={() => setConfirmApplied(null)}>Cancel</button>
        <button className="button button-primary" type="button" onClick={() => {
          if (confirmApplied && setApplicationStatus(confirmApplied.id, 'Applied')) setConfirmApplied(null)
        }}>Confirm submitted</button>
      </div>
    </Dialog>
  </div>
}
