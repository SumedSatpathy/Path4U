import { useEffect, useState } from 'react'
import { Activity, ArrowRight, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Radar } from 'lucide-react'
import { calendarDate } from '../shared/age.mjs'
import { deadlineChange, formatDate, type Opportunity } from './data'
import { href } from './routes'
import { EmptyState } from './ui'
import { useAccount } from './session'
import { useWorkspace } from './workspace'
import { roadmapProgress } from '../shared/learning.mjs'
import './dashboard.css'

const dateFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' })
const monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' })
const shortMonth = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })
const firstTimelineYear = 2026

const categoryColors: Partial<Record<Opportunity['category'], string>> = {
  Internship: '#3B82F6', Hackathon: '#0F766E', Certification: '#10B981', Workshop: '#F59E0B', Scholarship: '#EC4899', Job: '#06B6D4',
}
const validTime = (value: string) => Number.isFinite(Date.parse(value))
const displayDeadline = (value: string) => value.length === 10 ? formatDate(value, 'long') + ' · Time unspecified' : dateFormatter.format(new Date(value))
const dayFor = (value: string) => validTime(value) ? calendarDate(new Date(value)) : ''
const monthDate = (year: number, month: number) => new Date(Date.UTC(year, month))
const iso = (year: number, month: number, day: number) => [year, month + 1, day].map(value => String(value).padStart(2, '0')).join('-')

function OpportunityRow({ item }: { item: Opportunity }) {
  const { state, toggleSaved } = useWorkspace()
  const saved = state.saved.includes(item.id)
  const external = /^https:\/\//i.test(item.sourceUrl)
  return <article className="dash-listing">
    <div><p className="eyebrow">{item.category} · {item.status ?? 'Status Unverified'}</p>
      <h3><a href={href('/opportunity/' + item.id)}>{item.title}</a></h3>
      <p>{item.organization} · {item.sourceName} · {validTime(item.deadline) ? displayDeadline(item.deadline) : 'Deadline not listed'}</p>
    </div>
    <button type="button" className="icon-button" aria-label={saved ? 'Remove ' + item.title + ' from saved opportunities' : 'Save ' + item.title} aria-pressed={saved} onClick={() => toggleSaved(item.id)}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /></button>
    <div className="dash-listing-links"><a className="text-link" href={href('/opportunity/' + item.id)}>View details <ArrowRight size={15} /></a>
      {external && <a className="text-link" href={item.sourceUrl} rel="noreferrer" target="_blank">Official listing <ExternalLink size={14} /></a>}</div>
  </article>
}

export function OpportunityTimeline() {
  const { catalog } = useWorkspace()
  const today = calendarDate()
  const [currentYear, currentMonth] = today.split('-').map(Number)
  const [year, setYear] = useState(Math.max(firstTimelineYear, currentYear))
  const [month, setMonth] = useState(currentYear < firstTimelineYear ? 0 : currentMonth - 1)
  const [picked, setPicked] = useState('')
  const [preview, setPreview] = useState('')
  const schedule = new Map<string, Opportunity[]>()
  for (const listing of catalog) {
    const day = dayFor(listing.deadline || listing.eventStart || '')
    if (day) schedule.set(day, [...(schedule.get(day) ?? []), listing])
  }
  const activeMonth = monthDate(year, month)
  const blanks = (activeMonth.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const selected = schedule.get(picked) ?? []
  const hovering = preview !== picked ? schedule.get(preview) ?? [] : []

  function changeYear(offset: -1 | 1) {
    setYear(previous => Math.max(firstTimelineYear, previous + offset))
    setPicked('')
    setPreview('')
  }

  function showMonth(index: number) {
    if (month === index) return
    setMonth(index)
    setPreview('')
    setPicked('')
  }

  return <section className="panel dash-timeline" aria-label="Opportunity timeline">
    <div className="dash-section-head"><div><p className="eyebrow">2026 onward · Malaysia time · Source-backed event dates and deadlines</p><h2>Opportunity Timeline</h2></div>
      <div className="dash-year"><button type="button" className="icon-button" aria-label="Previous year" disabled={year === firstTimelineYear} onClick={() => changeYear(-1)}><ChevronLeft size={18} /></button><strong aria-live="polite">{year}</strong><button type="button" className="icon-button" aria-label="Next year" onClick={() => changeYear(1)}><ChevronRight size={18} /></button></div></div>
    <div className="dash-months" role="group" aria-label="Months">{Array.from({length: 12}, (_, index) => (
      <button type="button" key={index} aria-label={monthFormatter.format(monthDate(year, index))} aria-pressed={month === index}
        onPointerEnter={event => { if (event.pointerType === 'mouse') showMonth(index) }} onClick={() => showMonth(index)}>{shortMonth.format(monthDate(year, index))}</button>
    ))}</div>
    <div className="dash-calendar-layout">
      <div><h3>{monthFormatter.format(activeMonth)} {year}</h3>
        <div className="dash-calendar" role="group" aria-label="Dates">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span key={day}>{day}</span>)}
          {Array.from({length: blanks}, (_, index) => <span key={'blank-' + index} />)}
          {Array.from({length: count}, (_, index) => {
            const day = iso(year, month, index + 1)
            const listings = schedule.get(day) ?? []
            return <button type="button" key={day} aria-label={day + (listings.length ? ' · ' + listings.length + ' opportunities' : '')} aria-current={day === today ? 'date' : undefined} aria-pressed={picked === day}
              onPointerEnter={() => setPreview(day)} onPointerLeave={() => setPreview('')} onFocus={() => setPreview(day)} onBlur={() => setPreview('')} onClick={() => { setPicked(day); setPreview('') }}>
              {index + 1}<span className="event-dots" aria-hidden="true">{[...new Set(listings.map(item => item.category))].slice(0, 6).map(category => <i key={category} style={{ background: categoryColors[category] ?? 'var(--primary)' }} />)}</span>
            </button>
          })}
        </div>
      </div>
      <aside className="dash-date-panel" aria-live="polite">
        {hovering.length ? <><h3>Date preview</h3>{hovering.slice(0, 3).map(item => <div key={item.id} className="dash-date-preview"><strong>{item.title}</strong><p>{item.category} · {item.organization}</p><p>{item.deadline?'Deadline: ':'Event: '}{displayDeadline(item.deadline || item.eventStart || '')} · {item.status ?? 'Status Unverified'}</p></div>)}</> : picked ? <><h3>Opportunities on {formatDate(picked, 'long')}</h3>{selected.length ? selected.map(item => <OpportunityRow key={item.id} item={item} />) : <p>No source-backed dates are recorded for this day.</p>}</> :
            <><h3>Explore a date</h3><p>Hover a marked date for a preview, or select a date to see recorded event dates and deadlines for that day.</p></>}
      </aside>
    </div>
    <div className="dash-legend">{Object.entries(categoryColors).map(([category, color]) => <span key={category}><i style={{ background: color }} />{category}</span>)}</div>
  </section>
}

export function DeadlineMonitor({ compact = false }: { compact?: boolean }) {
  const { catalog, state, demo, openReview } = useWorkspace()
  const now = Date.now()
  const upcoming = catalog.filter(item => validTime(item.deadline) && Date.parse(item.deadline) >= now).sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline))
  const tasks = Object.entries(state.plans).flatMap(([id, items]) => items.filter(item => !item.done).map(item => ({ ...item, opportunity: catalog.find(listing => listing.id === id)?.title })))
  return <section className="panel dash-panel"><p className="eyebrow">Closing dates and follow-ups</p><h2>Upcoming Deadlines</h2>
    {!upcoming.length ? <p className="muted">No upcoming deadlines are recorded.</p> : compact ?
      <ul className="dash-deadline-summary">{upcoming.slice(0, 3).map(item => <li key={item.id}><a href={href('/opportunity/' + item.id)}>{item.title}</a><time dateTime={item.deadline}>{formatDate(item.deadline.slice(0, 10))}</time></li>)}</ul> :
      upcoming.slice(0, 5).map(item => <OpportunityRow key={item.id} item={item} />)}
    {!compact && tasks.length > 0 && <div className="dash-task-list"><h3>Tasks requiring attention</h3>{tasks.slice(0, 4).map(item => <a key={item.id + item.opportunity} className="text-link" href={href('/path')}>{item.title}{item.opportunity ? ' · ' + item.opportunity : ''}</a>)}</div>}
    {compact ? <a className="text-link" href={href('/deadlines')}>View all deadlines <ArrowRight size={15} /></a> :
      demo && <button type="button" className="button button-secondary" onClick={openReview}>Review sample deadline change · {formatDate(deadlineChange.newDate)}</button>}
  </section>
}

type Story = { id: number; title: string; url: string; author: string; published: string }
export function DeveloperNews({ compact = false }: { compact?: boolean }) {
  const [stories, setStories] = useState<Story[] | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/news', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error()
      return response.json() as Promise<Story[]>
    }).then(setStories).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [retry])
  return <section className="panel dash-panel"><p className="eyebrow">Hacker News · Source feed</p><h2>Developer News</h2>
    {error ? <p role="status">The feed is unavailable. <button className="button button-ghost button-small" onClick={() => { setError(false); setRetry(retry + 1) }}>Retry</button></p> :
      !stories ? <p role="status">Loading headlines…</p> : !stories.length ? <p>No headlines were returned.</p> :
        stories.slice(0, compact ? 4 : 10).map(story => <article key={story.id} className="dash-news"><h3><a href={story.url} target="_blank" rel="noreferrer">{story.title} <ExternalLink size={14} /></a></h3><p>Hacker News · {story.author} · {formatDate(story.published)}</p></article>)}
  </section>
}

export function ActivityLog({ compact = false }: { compact?: boolean }) {
  const { state, catalog } = useWorkspace()
  const activity = state.activity ?? []
  return <section className="panel dash-panel"><p className="eyebrow"><Activity size={14} /> Workspace activity</p><h2>AI Agent Activity</h2>
    {activity.length ? activity.slice(0, compact ? 4 : 30).map(item => <article className="dash-news" key={item.id}>
      <CheckCircle2 size={16} /> <strong>{item.action}</strong><p>{catalog.find(listing => listing.id === item.opportunityId)?.title ?? 'Opportunity'} · {validTime(item.time) ? dateFormatter.format(new Date(item.time)) : 'Time unavailable'}</p>
    </article>) : <p className="muted">No workspace actions have been recorded.</p>}
    {compact && <a className="text-link" href={href('/activity')}>Open activity log <ArrowRight size={15} /></a>}
  </section>
}

export function DashboardPage() {
  const { state, catalog, demo } = useWorkspace()
  const { session } = useAccount()
  const now = Date.now()
  const currentHour = new Date().getHours()
  const greet = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening'
  const roadmaps = state.roadmaps ?? []
  const roadmap = roadmaps[0]
  const progress = roadmapProgress(roadmap)
  const next = roadmap?.milestones.find(item => !item.done)
  const preferences = session?.user?.preferences
  const skills = new Set((preferences?.skills ?? []).map(skill => skill.toLowerCase()))
  const interests = (preferences?.interests ?? []).map(interest => interest.toLowerCase().replace('artificial intelligence', 'ai'))
  const city = preferences?.location?.city.toLowerCase()
  const matches = catalog.map(item => {
    const overlap = (item.skills ?? []).filter(skill => skills.has(skill.toLowerCase()))
    const discipline = item.discipline?.toLowerCase() ?? ''
    const interest = discipline && interests.find(value => value === discipline || value.startsWith(discipline + ' '))
    const nearby = Boolean(city && item.location?.toLowerCase().includes(city))
    const audience = item.audience === 'Open to all' || (item.audience === 'Students' && preferences?.stage === 'Student') || (item.audience === 'Graduates' && preferences?.stage === 'Graduate')
    const explanation = [overlap.length ? 'Matching skills: ' + overlap.join(', ') : '', interest ? 'Interest: ' + item.discipline : '', nearby ? 'In your city' : ''].filter(Boolean).join(' · ')
    return { item, explanation, score: (audience ? 1 : 0) + overlap.length * 3 + (interest ? 2 : 0) + (nearby ? 1 : 0) }
  })
    .filter(({ item, explanation }) => (demo ? item.match.score >= 75 : Boolean(explanation)) && (!item.deadline || Date.parse(item.deadline) >= now))
    .sort((a, b) => demo ? b.item.match.score - a.item.match.score : b.score - a.score)
  const stats = [
    ['Saved opportunities', state.saved.length], ['New matches', matches.filter(({ item }) => Date.parse(item.published) >= now - 7 * 86400000 && Date.parse(item.published) <= now).length],
    ['Upcoming deadlines', catalog.filter(item => Date.parse(item.deadline) >= now).length],
    ['Applications in progress', Object.values(state.applications).filter(item => ['Preparing','Applied','Interview'].includes(item.status)).length],
    ['Active roadmaps', roadmaps.filter(item => item.milestones.some(step => !step.done)).length],
    ['Completed milestones', roadmaps.reduce((total, item) => total + item.milestones.filter(step => step.done).length, 0)],
  ]
  return <div className="openpath-dashboard">
    <header className="dash-hero"><div><p className="eyebrow"><Radar size={16} /> {demo ? 'Guest workspace · Live source-backed listings' : 'Your workspace'}</p><h1>{greet}, {state.profile.name.trim().split(/\s+/)[0]}.</h1><p>Here’s what’s next on your path.</p></div>
      <a href={href('/discover')} className="button button-primary">Discover opportunities <ArrowRight size={16} /></a></header>
    <div className="dash-stats">{stats.map(([label, value]) => <div className="panel dash-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <div className="dash-columns dash-overview">
      <section className="panel dash-panel dash-roadmap"><p className="eyebrow">Learning progress</p><h2>My Roadmap</h2>
        {roadmap ? <><h3>{roadmap.goal}</h3><progress value={progress.complete} max={progress.total} aria-label="Roadmap learning progress" /><p className="muted">{progress.complete} of {progress.total} {progress.unit} complete</p>{next && <p><strong>Next</strong> · {next.title}</p>}</> : <p className="muted">Turn a career goal into milestones and practical next steps.</p>}
        <a className="text-link" href={href('/roadmap')}>{roadmap ? 'Continue roadmap' : 'Build a roadmap'} <ArrowRight size={16} /></a>
      </section>
      <DeadlineMonitor compact />
    </div>
    <OpportunityTimeline />
    <div className="dash-columns">
      <section className="panel dash-panel"><p className="eyebrow">Personalized shortlist</p><h2>Recommended Opportunities</h2>
        {matches.length ? matches.slice(0, 4).map(({ item, explanation }) => <div key={item.id}><OpportunityRow item={item} /><p className="dash-match">{demo ? item.match.reasons[0] : explanation}</p></div>) :
          <EmptyState title="No matches yet" description="Update your skills or browse the catalog for more opportunities." action={<a href={href('/onboarding', new URLSearchParams({edit:'1'}))} className="button button-secondary">Edit interests and skills</a>} />}
      </section>
      <ActivityLog compact />
    </div>
    <DeveloperNews compact />
  </div>
}
