import { useState, type FormEvent } from 'react'
import { ArrowLeft, CalendarDays, Monitor, Moon, Sun, UserRound } from 'lucide-react'
import { deadlineChange, formatDate, opportunities } from './data'
import { href } from './routes'
import { EmptyState } from './ui'
import { useWorkspace, type CandidateStage } from './workspace'

export function ProfilePage() {
  const { state, saveProfile } = useWorkspace()
  const [draft, setDraft] = useState(state.profile)
  const [error, setError] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.profile)
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
  const { state, setTheme } = useWorkspace()
  return <div className="simple-page">
    <header><p className="eyebrow">Account</p><h1>Settings</h1><p>Manage the appearance and review the connections for this workspace.</p></header>
    <section className="panel simple-panel"><span className="section-icon"><Monitor size={19} /></span><h2>Appearance</h2><p>Your theme preference is saved in this browser.</p>
      <div className="choice-row" role="group" aria-label="Theme">
        <button type="button" className="button button-secondary" aria-pressed={state.theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={17} /> Dark</button>
        <button type="button" className="button button-secondary" aria-pressed={state.theme === 'light'} onClick={() => setTheme('light')}><Sun size={17} /> Light</button>
      </div>
    </section>
    <section className="panel simple-panel"><span className="section-icon"><CalendarDays size={19} /></span><h2>Calendar</h2><p>Google Calendar is planned. Deadline reviews show a simulated update you can inspect from My Path.</p><a className="button button-secondary" href={href('/path')}>Open My Path</a></section>
  </div>
}

export function SourcePage({ id }: { id: string }) {
  const opportunity = opportunities.find(item => item.id === id)
  if (!opportunity) return <EmptyState title="Source unavailable" description="This sample listing may have moved." action={<a className="button button-primary" href={href('/discover')}>Browse opportunities</a>} />
  return <div className="simple-page">
    <a className="text-link" href={href('/opportunity/' + id)}><ArrowLeft size={17} /> Back to opportunity</a>
    <header><p className="eyebrow">Fictional source record</p><h1>{opportunity.title}</h1><p>{opportunity.organization} · {opportunity.location}</p></header>
    <section className="panel simple-panel"><h2>{opportunity.sourceName}</h2><p>{opportunity.description}</p>
      <div className="source-excerpt">{id === deadlineChange.opportunityId ? deadlineChange.after : 'Application deadline · ' + formatDate(opportunity.deadline, 'long') + ' UTC'}</div>
      <h3>Application requirements</h3><ul>{opportunity.requirements.map(item => <li key={item}>{item}</li>)}</ul>
    </section>
  </div>
}
