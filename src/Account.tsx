import { useState, type FormEvent } from 'react'
import { CalendarDays, Compass, UserRound } from 'lucide-react'
import { deadlineChange, formatDate, opportunities } from './data'
import { href, useUnsavedChanges } from './routes'
import { EmptyState } from './ui'
import { apiPost, failureMessage } from './api'
import { useWorkspace, type CandidateStage } from './workspace'

export function ProfilePage() {
  const { state, saveProfile } = useWorkspace()
  const [draft, setDraft] = useState(state.profile)
  const [error, setError] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.profile)
  useUnsavedChanges(dirty)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.name.trim()) {
      setError(true)
      event.currentTarget.querySelector<HTMLInputElement>('input[name="name"]')?.focus()
      return
    }
    if (saveProfile({ ...draft, name: draft.name.trim() })) setDraft({ ...draft, name: draft.name.trim() })
  }
  return <div className="simple-page">
    <header><p className="eyebrow">Account</p><h1>Profile</h1><p>Set the preferences used by your application match scores.</p></header>
    <form className="panel simple-panel" noValidate onSubmit={submit}>
      <span className="section-icon"><UserRound size={19} /></span><h2>Candidate preferences</h2>
      <label className="field">Display name<input name="name" autoComplete="name" value={draft.name} maxLength={70} aria-invalid={error} aria-describedby={error ? 'profile-name-error' : undefined}
        onChange={event => { setDraft({ ...draft, name: event.target.value }); setError(false) }} />{error && <span id="profile-name-error" className="field-error">Enter a display name.</span>}</label>
      <div className="simple-fields">
        <label className="field">Career stage<select value={draft.stage} onChange={event => setDraft({ ...draft, stage: event.target.value as CandidateStage })}><option>Student</option><option>Graduate</option><option>Other</option></select></label>
        <label className="field">Preferred location<select value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })}><option>Kuala Lumpur</option><option>Riyadh</option><option>Remote</option><option>Any location</option></select></label>
      </div>
      <label className="field">Maximum availability<select value={draft.months} onChange={event => setDraft({ ...draft, months: Number(event.target.value) })}>
        {[3, 4, 5, 6, 12].map(months => <option key={months} value={months}>{months} months</option>)}</select></label>
      <div className="choice-row"><button type="submit" className="button button-primary" disabled={!dirty}>Save profile</button>{dirty && <button type="button" className="button button-secondary" onClick={() => { setDraft(state.profile); setError(false) }}>Reset changes</button>}</div>
    </form>
  </div>
}

export function SettingsPage() {
  const { state, setTheme, demo, notify } = useWorkspace()
  const [clearing, setClearing] = useState(false)
  return <div className="simple-page">
    <header><p className="eyebrow">Account</p><h1>Settings</h1><p>Review your workspace preferences and connections.</p></header>
    {!demo && <section className="panel simple-panel"><h2>Assistant uploads</h2><p>Files are removed after processing. Clear any uploads left by a connection failure.</p><button type="button" className="button button-secondary" disabled={clearing} onClick={async () => {
      setClearing(true)
      try { const result = await apiPost<{ removed: number }>('assistant/clear-uploads', {}); notify(result.removed ? 'Remaining uploads removed.' : 'No remaining uploads.') }
      catch (failure) { notify(failureMessage(failure), 'error') } finally { setClearing(false) }
    }}>{clearing ? 'Clearing…' : 'Clear remaining uploads'}</button></section>}
    {!demo && <section className="panel simple-panel"><h2>Public website</h2><a className="button button-secondary" href="/?view=public">View Public Website</a></section>}
    <section className="panel simple-panel"><h2>Appearance</h2><label className="field">Color theme<select value={state.theme ?? 'dark'} onChange={event => setTheme(event.target.value as 'light' | 'dark')}><option value="light">Light</option><option value="dark">Dark</option></select></label></section>
<section className="panel simple-panel"><span className="section-icon"><Compass size={19} /></span><h2>Workspace</h2><p>{demo ? 'Sample preferences are stored in this browser.' : 'Your settings, saved opportunities and plans are stored with your account.'}</p><a className="button button-secondary" href={href('/profile')}>Edit profile</a></section>
    <section className="panel simple-panel"><span className="section-icon"><CalendarDays size={19} /></span><h2>Calendar</h2><p>Google Calendar is planned. Deadline reviews show a simulated update you can inspect from Preparation Plans.</p><a className="button button-secondary" href={href('/path')}>Open preparation plans</a></section>
  </div>
}

export function SourcePage({ id }: { id: string }) {
  const { demo } = useWorkspace()
  const opportunity = demo ? opportunities.find(item => item.id === id) : undefined
  if (!opportunity) return <EmptyState title="Source unavailable" description="This sample listing may have moved." action={<a className="button button-primary" href={href('/discover')}>Browse opportunities</a>} />
  return <div className="simple-page">
    <a className="text-link" href={href('/opportunity/' + id)}>View opportunity</a>
    <header><p className="eyebrow">Fictional source record</p><h1>{opportunity.title}</h1><p>{opportunity.organization} · {opportunity.location}</p></header>
    <section className="panel simple-panel"><h2>{opportunity.sourceName}</h2><p>{opportunity.description}</p>
      <div className="source-excerpt">{id === deadlineChange.opportunityId ? deadlineChange.after : 'Application deadline · ' + formatDate(opportunity.deadline, 'long') + ' UTC'}</div>
      <h3>Application requirements</h3><ul>{opportunity.requirements.map(item => <li key={item}>{item}</li>)}</ul>
    </section>
  </div>
}
