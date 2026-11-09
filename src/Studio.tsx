import { useRef, useState } from 'react'
import { Activity, ArrowRight, Check, CircleAlert, Clipboard, FileText, ListFilter, Mail, ScanText, Sparkles, Table2, Upload } from 'lucide-react'
import { apiPost, failureMessage, useIntegrationStatus } from './api'
import { formatDate, opportunities, type Opportunity } from './data'
import { analyzeLocally, buildLocalDraft, rankOpportunity, sampleResume, type Analysis, type ApplicationDraft } from './engine'
import { href, navigate } from './routes'
import { EmptyState } from './ui'
import { applicationStatuses, useWorkspace, type ApplicationStatus, type TrackedApplication } from './workspace'
import './studio.css'

const steps = [
  { label: 'Analyze résumé', short: 'Analyze', icon: ScanText },
  { label: 'Rank matches', short: 'Rank', icon: ListFilter },
  { label: 'Prepare drafts', short: 'Draft', icon: FileText },
  { label: 'Track applications', short: 'Track', icon: Activity },
]

const emptyAnalysis: Analysis = { skills: [], evidence: [] }
const resumeLimit = 20_000

export function StudioPage({ params }: { params: URLSearchParams }) {
  const { state, setApplicationStatus, notify } = useWorkspace()
  const service = useIntegrationStatus()
  const role = opportunities.find(item => item.id === params.get('opportunity')) ?? opportunities[0]
  const initialStep = params.get('opportunity') ? 2 : 0
  const [step, setStep] = useState(initialStep)
  const [resume, setResume] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisMode, setAnalysisMode] = useState<'local' | 'gemini'>('local')
  const [sample, setSample] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, { content: ApplicationDraft; mode: 'local' | 'gemini' }>>({})
  const [draftTab, setDraftTab] = useState<'resume' | 'cover' | 'email'>('resume')
  const [recipient, setRecipient] = useState('')
  const [gmailResult, setGmailResult] = useState<{ id: string; requestId: string } | null>(null)
  const gmailRequests = useRef(new Map<string, string>())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [synced, setSynced] = useState<Record<string, string>>({})
  const resumeField = useRef<HTMLTextAreaElement>(null)
  const busyRef = useRef(false)
  const draft = drafts[role.id]
  const ranked = opportunities.map(item => rankOpportunity(item, analysis ?? emptyAnalysis, state.profile))
    .sort((a, b) => a.reviewCount - b.reviewCount || b.score - a.score || a.opportunity.title.localeCompare(b.opportunity.title))
  const tracked = Object.values(state.applications).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  function selectStep(next: number) {
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
      setError('Enter at least 25 characters of résumé text.')
      resumeField.current?.focus()
      return
    }
    void run('analysis', async () => {
      setAnalysis(remote ? await apiPost<Analysis>('analyze', { resume }) : analyzeLocally(resume))
      setAnalysisMode(remote ? 'gemini' : 'local')
    })
  }

  function generateDraft(remote: boolean) {
    void run('draft', async () => {
      const candidate = analysis ?? emptyAnalysis
      const content = remote ? await apiPost<ApplicationDraft>('draft', {
        title: role.title, organization: role.organization, requirements: role.requirements,
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

  return <div className="studio-page">
    <header className="studio-head">
      <div><p className="eyebrow"><Sparkles size={14} /> Candidate toolkit</p><h1>Application Studio</h1><p>Turn your résumé into a shortlist and prepare each application for your review.</p></div>
      <span className="pill"><span className="signal-dot" /> {service.gemini || service.gmail || service.sheets ? 'Connected demo workspace' : 'Local demo workspace'}</span>
    </header>
    <nav className="studio-steps" aria-label="Application workflow">
      {steps.map((item, index) => <button type="button" key={item.label} aria-current={index === step ? 'step' : undefined} aria-label={item.label} disabled={!!busy} onClick={() => selectStep(index)}>
        <span className="studio-step-icon"><item.icon size={17} /></span><span className="studio-step-long">{item.label}</span><span className="studio-step-short">{item.short}</span>
      </button>)}
    </nav>
    {error && <p className="studio-error" role="alert"><CircleAlert size={18} />{error}</p>}
    {step === 0 && <div className="studio-grid">
      <form className="panel studio-panel" noValidate onSubmit={event => submitAnalysis(event, false)}>
        <div><p className="eyebrow">01 / CV analyzer</p><h2>Start with your résumé</h2><p className="muted">Paste résumé text or open a plain-text file. Your text stays in this tab when you analyze locally.</p></div>
        <label className="field">Résumé text<textarea className="resize-none" ref={resumeField} value={resume} rows={8} maxLength={resumeLimit} disabled={!!busy}
          placeholder="Include skills, projects, and relevant work experience." onChange={event => changeResume(event.target.value)} /></label>
        <div className="choice-row">
          <label className="button button-secondary studio-upload"><Upload size={16} /> Open .txt or .md
            <input type="file" accept=".txt,.md,text/plain,text/markdown" aria-label="Open text résumé" disabled={!!busy} onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (!/\.(txt|md)$/i.test(file.name) || file.size > 80_000) { setError('Choose a .txt or .md file under 80 KB.'); return }
              void run('file', async () => {
                const text = await file.text()
                if (text.length > resumeLimit) throw new Error('Use a résumé with 20,000 characters or fewer.')
                changeResume(text)
              })
            }} />
          </label>
          <button className="button button-ghost" type="button" onClick={() => changeResume(sampleResume, true)} disabled={!!busy}>Use sample résumé</button>
        </div>
        <div className="choice-row">
          <button className="button button-primary" type="submit" disabled={!!busy}>{busy === 'analysis' ? 'Analyzing…' : 'Analyze locally'} <ArrowRight size={16} /></button>
          {service.gemini && <button className="button button-secondary" type="button" disabled={!!busy} onClick={event => submitAnalysis(event, true)}>Analyze with Gemini</button>}
        </div>
        {service.gemini && <p className="field-help">Analyze with Gemini sends the résumé text to the configured Google service.</p>}
      </form>
      <section className="panel studio-panel" aria-live="polite">
        <p className="eyebrow">Candidate profile</p><h2>Extracted skills</h2>
        {analysis ? <>
          <p className="muted">{sample ? 'Fictional résumé · ' : ''}{analysisMode === 'gemini' ? 'Gemini extraction' : 'Local skill matching'}</p>
          <div className="studio-pills">{analysis.skills.length ? analysis.skills.map(skill => <span className="pill" key={skill}>{skill}</span>) : <p className="muted">No supported skills were identified. Add specific tools or project details and try again.</p>}</div>
          {!!analysis.evidence.length && <><h3>Résumé evidence</h3><ul className="studio-evidence">{analysis.evidence.map((line, index) => <li key={index}>{line}</li>)}</ul></>}
          <button className="button button-secondary studio-start" type="button" onClick={() => selectStep(1)}>Rank my matches <ArrowRight size={16} /></button>
        </> : <p className="muted">Run an analysis to see the skills and evidence used to rank opportunities.</p>}
      </section>
    </div>}
    {step === 1 && <section className="panel studio-panel">
      <div><p className="eyebrow">02 / Opportunity finder and match scorer</p><h2>Ranked opportunities</h2><p className="muted">Profile checks sort first. Skill fit compares your résumé’s skill vector with the role’s requested skills. Verify final eligibility with the organizer.</p></div>
      <div className="choice-row"><a className="button button-secondary button-small" href={href('/discover')}>Search and filter opportunities</a><a className="button button-ghost button-small" href={href('/profile')}>Edit matching preferences</a></div>
      {!analysis ? <EmptyState title="Add résumé evidence to rank matches" description="Analyze your own text or use the fictional sample to see an explainable ranking."
        action={<button className="button button-primary" onClick={() => selectStep(0)}>Analyze résumé</button>} /> :
        <div className="studio-ranking">
          {ranked.map(({ opportunity, matched, gaps, score, requirements, reviewCount }) => <article className="studio-match" key={opportunity.id}>
            <div className="studio-match-head"><div><a href={href('/opportunity/' + opportunity.id)}><h3>{opportunity.title}</h3></a><p className="muted">{opportunity.organization} · {opportunity.location} · Fictional listing</p></div><span className="fit-pill">{score}% skill fit</span></div>
            <div className="studio-pills">{requirements.map(item => <span key={item.label} className={'pill ' + (item.pass ? 'studio-pass' : 'studio-review')}>{item.pass ? <Check size={13} /> : <CircleAlert size={13} />}{item.label} · {item.pass ? 'Matches' : 'Review'}</span>)}</div>
            <p><strong>Matching skills</strong> {matched.join(', ') || 'None identified'}</p>
            <p><strong>Skills to review</strong> {gaps.join(', ') || 'All listed skills detected'}</p>
            <button type="button" className="button button-secondary button-small studio-start" onClick={() => { selectRole(opportunity.id); selectStep(2) }}>{reviewCount ? 'Review and prepare draft' : 'Prepare application'} <ArrowRight size={15} /></button>
          </article>)}
        </div>}
    </section>}
    {step === 2 && <div className="studio-grid studio-draft-grid">
      <section className="panel studio-panel">
        <div><p className="eyebrow">03 / Application generator</p><h2>Choose an opportunity</h2></div>
        <label className="field">Opportunity<select value={role.id} onChange={event => selectRole(event.target.value)} disabled={!!busy}>
          {opportunities.map(item => <option key={item.id} value={item.id}>{item.title} · {item.organization}</option>)}
        </select></label>
        <p className="muted">{role.organization} · {role.location} · Fictional listing</p>
        <ul className="studio-evidence">{role.requirements.map(item => <li key={item}>{item}</li>)}</ul>
        <p className="muted">{analysis ? 'Drafts use your extracted résumé evidence.' : 'You can start with a template or analyze your résumé to personalize it.'}</p>
        <div className="choice-row">
          <button type="button" className="button button-primary" disabled={!!busy || !!draft} onClick={() => generateDraft(false)}>{busy === 'draft' ? 'Generating…' : 'Generate local draft'}</button>
          {service.gemini && <button type="button" className="button button-secondary" disabled={!!busy || !!draft || !analysis} onClick={() => generateDraft(true)}>Draft with Gemini</button>}
        </div>
        {service.gemini && <p className="field-help">Draft with Gemini shares extracted skills and résumé excerpts with the configured Google service.</p>}
        <a className="text-link studio-start" href={href('/opportunity/' + role.id)}>Read listing <ArrowRight size={15} /></a>
      </section>
      <section className="panel studio-panel">
        <div><p className="eyebrow">Review workspace</p><h2>Application drafts</h2><p className="muted">Check every claim and replace placeholders before using an authorized application channel.</p></div>
        {draft ? <>
          <div className="choice-row studio-draft-choices" role="group" aria-label="Draft type">
            {([{ id: 'resume', label: 'Résumé' }, { id: 'cover', label: 'Cover letter' }, { id: 'email', label: 'Email' }] as const).map(item =>
              <button className="button button-secondary button-small" type="button" aria-pressed={draftTab === item.id} key={item.id} onClick={() => setDraftTab(item.id)}>{item.label}</button>)}
          </div>
          <p className="field-help">{draft.mode === 'gemini' ? 'Gemini draft' : 'Local draft'} · Edits stay in this view until you leave or reload.</p>
          {draftTab === 'email' && <label className="field">Email subject<input value={draft.content.subject} maxLength={160} disabled={!!busy} onChange={event => editDraft('subject', event.target.value)} /></label>}
          <label className="field">{draftTab === 'resume' ? 'Tailoring suggestions' : draftTab === 'cover' ? 'Cover letter' : 'Email body'}
            <textarea className="resize-none" rows={9} value={draft.content[draftTab]} maxLength={12000} disabled={!!busy} onChange={event => editDraft(draftTab, event.target.value)} />
          </label>
          {draftTab === 'email' && service.gmail && <label className="field">Recipient <span className="field-help">Optional. Gmail will create an unsent draft.</span><input type="email" value={recipient} maxLength={254} disabled={!!busy} onChange={event => { setRecipient(event.target.value); setGmailResult(null) }} /></label>}
          <div className="choice-row">
            <button className="button button-secondary button-small" type="button" disabled={!!busy} onClick={() => void run('copy', async () => { await navigator.clipboard.writeText(draft.content[draftTab]); notify('Draft copied') })}><Clipboard size={15} /> Copy text</button>
            {draftTab === 'email' && service.gmail && <button className="button button-secondary button-small" type="button" disabled={!!busy || !!gmailResult} onClick={saveGmail}><Mail size={15} /> {busy === 'gmail' ? 'Saving draft…' : 'Save Gmail draft'}</button>}
            <button className="button button-primary button-small" type="button" disabled={!!busy} onClick={() => {
              if (state.applications[role.id] || setApplicationStatus(role.id, 'Preparing')) selectStep(3)
            }}>Track application <ArrowRight size={15} /></button>
          </div>
          {gmailResult && <p role="status" className="studio-pass"><Check size={16} /> Gmail confirmed the unsent draft.</p>}
        </> : <p className="muted">Generate a draft to edit résumé suggestions, a cover letter, and an email.</p>}
      </section>
    </div>}
    {step === 3 && <section className="panel studio-panel">
      <div><p className="eyebrow">04 / Tracker</p><h2>Application tracker</h2><p className="muted">Record progress after you take action through the organizer’s application channel.</p></div>
      <div className="studio-pills">{applicationStatuses.map(status => <span className="pill" key={status}>{status} · {tracked.filter(item => item.status === status).length}</span>)}</div>
      {tracked.length ? <div className="studio-tracker">
        {tracked.map(item => {
          const opportunity = opportunities.find(candidate => candidate.id === item.opportunityId)
          if (!opportunity) return null
          return <article className="studio-tracker-row" key={item.opportunityId}>
            <div><a href={href('/opportunity/' + opportunity.id)}><h3>{opportunity.title}</h3></a><p className="muted">{opportunity.organization} · Updated {formatDate(item.updatedAt)}</p></div>
            <label className="field studio-status">Status<select aria-label={'Status for ' + opportunity.title} value={item.status} disabled={!!busy} onChange={event => setApplicationStatus(item.opportunityId, event.target.value as ApplicationStatus)}>
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
}


