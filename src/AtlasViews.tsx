import { useId, useState } from 'react'
import {
  ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Compass, GraduationCap,
  Flag, GitBranch, NotebookPen, Route, ScanLine, Sparkles,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { milestones, waypoints } from './atlasData'
import { formatDate, opportunities } from './data'
import { href } from './routes'
import { useWorkspace } from './workspace'
import './atlas-views.css'

const timelineHref = href('/timeline')

export function JourneyTimeline({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState<string | null>(compact ? null : milestones[0]?.id ?? null)
  const reduced = useReducedMotion()
  const detailsId = useId()
  const milestone = milestones.find(item => item.id === active)
  const waypoint = waypoints.find(item => item.id === milestone?.waypointId)
  const { state } = useWorkspace()

  return <div className={'atlas-journey' + (compact ? ' atlas-journey-compact' : '')}>
    <ol className="atlas-journey-list" aria-label="Career milestones in chronological order">
      {milestones.map((item, index) => {
        const selected = item.id === active
        return <li key={item.id}>
          <button type="button" className="atlas-journey-stop" aria-expanded={selected}
            aria-controls={selected ? detailsId : undefined} onClick={() => setActive(selected ? null : item.id)}>
            <span className="atlas-journey-date">
              <strong>{item.month.slice(0, 3)}</strong>
              <span>{item.year}</span>
            </span>
            <span className="atlas-journey-pin" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span className="atlas-journey-label">{item.id === 'internship-applications' ? 'Internship applications' : item.label}<ChevronDown size={13} aria-hidden="true" /></span>
          </button>
        </li>
      })}
    </ol>
    {milestone && <motion.div id={detailsId} key={milestone.id} className="atlas-journey-details"
      initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <div className="atlas-journey-detail-icon"><Flag size={21} aria-hidden="true" /></div>
      <div>
        <p className="eyebrow atlas-view-label">{milestone.month} {milestone.year} · {milestone.label}</p>
        <h3>{milestone.title}</h3>
        <p>{milestone.description}</p>
      </div>
      <div className="atlas-journey-actions">
        <a className="button button-secondary button-small" href={timelineHref}><CalendarDays size={15} aria-hidden="true" /> View timeline</a>
        {!compact && (waypoint?.opportunityId && !state.plans[waypoint.opportunityId]
          ? <a className="atlas-inline-link" href={href('/opportunity/' + waypoint.opportunityId)}>Build a sample plan <ArrowRight size={14} aria-hidden="true" /></a>
          : <a className="atlas-inline-link" href={href('/path')}>Open editable plans <ArrowRight size={14} aria-hidden="true" /></a>)}
      </div>
    </motion.div>}
  </div>
}

const constellations = [
  {
    id: 'build', name: 'Build', icon: GitBranch, waypoint: 'solution-challenge',
    skills: ['Prototyping', 'Git', 'Product thinking'],
    description: 'Make a small, testable product with a team and document what you learned.',
  },
  {
    id: 'analyse', name: 'Analyse', icon: ScanLine, waypoint: 'kaggle',
    skills: ['Python', 'Data literacy', 'Experiment design'],
    description: 'Turn a question into a benchmark, then communicate which changes improved it.',
  },
  {
    id: 'apply', name: 'Apply', icon: Compass, waypoint: 'google-internship',
    skills: ['Portfolio storytelling', 'Interview prep', 'Communication'],
    description: 'Translate your project evidence into a clear application and interview story.',
  },
]

function SkillsConstellation() {
  const [active, setActive] = useState(constellations[0].id)
  const selected = constellations.find(item => item.id === active) ?? constellations[0]
  const details = useId()
  return <section className="atlas-constellation atlas-editorial-panel" aria-labelledby="constellation-title">
    <div className="atlas-constellation-header">
      <div><p className="eyebrow atlas-view-label">Field notes · 02</p><h2 id="constellation-title">Skills constellation</h2></div>
      <p>Follow a skill cluster to see where to practise it.</p>
    </div>
    <div className="atlas-constellation-grid">
      <div className="atlas-constellation-graph" role="group" aria-label="Skill clusters">
        <svg className="atlas-constellation-lines" viewBox="0 0 560 250" preserveAspectRatio="none" aria-hidden="true">
          <path d="M20 157C72 204 142 217 206 199C266 182 286 114 361 110C426 107 461 147 541 116M16 177C85 228 153 238 216 218C282 197 301 135 365 132C431 129 468 169 549 132M13 196C85 245 166 252 230 236C296 220 318 155 373 154C439 153 476 187 551 154" />
          <path d="M34 97C88 58 147 73 181 96C224 125 270 124 300 90C336 49 414 30 526 60M38 76C100 32 154 51 199 77C236 98 266 94 287 71C336 20 423 11 531 38" />
          <path className="atlas-constellation-route" d="M106 164 280 82 454 150" />
          <path className="atlas-constellation-route atlas-constellation-route-faint" d="M106 164 454 150" />
        </svg>
        {constellations.map(({ id, name, icon: Icon }) => <button key={id} type="button"
          className={'atlas-cluster-node atlas-cluster-' + id} aria-pressed={active === id} aria-controls={details}
          onClick={() => setActive(id)}>
          <span><Icon size={20} aria-hidden="true" /></span><strong>{name}</strong>
        </button>)}
      </div>
      <div className="atlas-constellation-copy" id={details}>
        <p className="eyebrow atlas-view-label">Selected cluster</p>
        <h3>{selected.name}</h3>
        <p>{selected.description}</p>
        <ul className="atlas-skill-tags">{selected.skills.map(skill => <li key={skill}>{skill}</li>)}</ul>
        <a className="atlas-inline-link" href={timelineHref}>View opportunity timeline <ArrowRight size={15} aria-hidden="true" /></a>
      </div>
    </div>
  </section>
}

export function PlannerPage() {
  const first = milestones[0]
  const last = milestones[milestones.length - 1]
  return <div className="atlas-view atlas-planner">
    <header className="atlas-view-heading">
      <div>
        <p className="eyebrow atlas-view-label"><Route size={14} aria-hidden="true" /> Career Atlas / Planner</p>
        <h1>Pathway Planner</h1>
        <p>Connect this month’s preparation to the opportunities you want next year.</p>
      </div>
      <a className="button button-secondary" href={href('/path')}><NotebookPen size={17} aria-hidden="true" /> My preparation plans</a>
    </header>

    <section className="atlas-roadmap atlas-editorial-panel" aria-labelledby="planner-roadmap-title">
      <div className="atlas-roadmap-intro">
        <div>
          <p className="eyebrow atlas-view-label">Route 01 · Illustrative roadmap</p>
          <h2 id="planner-roadmap-title">From hackathon to internship.</h2>
          <p>Open a milestone to see what to prepare and where it fits into your learning path.</p>
        </div>
        <div className="atlas-roadmap-legend">
          <strong>{String(milestones.length).padStart(2, '0')}</strong>
          <span>Milestones</span>
          <span>{first?.month.slice(0, 3)} {first?.year} – {last?.month.slice(0, 3)} {last?.year}</span>
        </div>
      </div>
      <JourneyTimeline />
    </section>

    <SkillsConstellation />
  </div>
}


export function BriefingPage() {
  const { state } = useWorkspace()
  const firstName = state.profile.name.trim().split(/\s+/)[0] || 'Ahmad'
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const priority = opportunities.find(item => item.id === 'orbit-summer')!
  const briefingDate = '2026-11-16'
  const daysUntil = (Date.parse(priority.deadline) - Date.parse(briefingDate)) / 86_400_000
  const planCount = Object.keys(state.plans).length
  const tasks = Object.values(state.plans).flat()
  const tasksDone = tasks.filter(task => task.done).length
  const profileFits = state.profile.stage === 'Student' && state.profile.location === priority.location && state.profile.months >= priority.durationMonths
  const tracked = state.applications[priority.id]
  const applicationHref = href('/application', new URLSearchParams({ opportunity: priority.id }))

  return <div className="atlas-view atlas-briefing">
    <header className="atlas-view-heading atlas-briefing-heading">
      <div>
        <p className="eyebrow atlas-view-label"><BookOpen size={15} aria-hidden="true" /> AI weekly briefing · Sample edition</p>
        <h1>{greeting}, {firstName}.</h1>
        <p>16–22 November 2026 · Your priorities and the evidence behind them.</p>
      </div>
      <a className="button button-secondary" href={href('/profile')}>Edit profile <ArrowRight size={15} aria-hidden="true" /></a>
    </header>

    <div className="atlas-briefing-columns">
      <div className="atlas-briefing-main">
        <section className="atlas-briefing-feature atlas-editorial-panel" aria-labelledby="briefing-recommendation">
          <div className="atlas-briefing-feature-top">
            <p className="eyebrow atlas-view-label"><Sparkles size={14} aria-hidden="true" /> Recommended action</p>
            <span className="atlas-briefing-badge">Fictional opportunity</span>
          </div>
          <h2 id="briefing-recommendation">{tracked ? 'Review your Orbit Labs application.' : 'Prepare your Orbit Labs application.'}</h2>
          <p>{priority.title} · {priority.location}. Use one strong project to show what you built and how you worked with a team.</p>
          <div className="atlas-briefing-deadline">
            <CalendarDays size={17} aria-hidden="true" />
            <strong>Deadline in {daysUntil} days</strong>
            <time dateTime={priority.deadline}>{formatDate(priority.deadline, 'long')}</time>
          </div>
          <div className="atlas-briefing-actions">
            <a className="button button-primary" href={applicationHref}>Open application workspace <ArrowRight size={16} aria-hidden="true" /></a>
            <a className="atlas-inline-link" href={href('/opportunity/' + priority.id)}>Read requirements <ArrowRight size={15} aria-hidden="true" /></a>
          </div>
        </section>

        <section className="atlas-briefing-priorities" aria-labelledby="briefing-priorities-title">
          <div className="atlas-priority-heading">
            <p className="eyebrow atlas-view-label">Sample opportunity watch</p>
            <h2 id="briefing-priorities-title">This week</h2>
          </div>
          <ol>
            <li><a href={href('/discover', new URLSearchParams({ category: 'Internship' }))}>
              <span className="atlas-priority-index" aria-hidden="true">02</span>
              <div><p className="eyebrow atlas-view-label">Applications</p><h3>2 high-priority internships</h3><p>Orbit Labs and Lumen Studio both build on the sample AI engineering path.</p></div>
              <span className="atlas-priority-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
            </a></li>
            <li><div className="atlas-priority-static">
              <span className="atlas-priority-index" aria-hidden="true">01</span>
              <div><p className="eyebrow atlas-view-label">Funding</p><h3>1 scholarship closing soon</h3><p>Sample Meridian Study Grant closes 22 November. Prepare a transcript and a short statement of purpose.</p></div>
              <span className="atlas-priority-arrow" aria-hidden="true"><GraduationCap size={18} /></span>
            </div></li>
            <li><a href={timelineHref}>
              <span className="atlas-priority-index" aria-hidden="true">01</span>
              <div><p className="eyebrow atlas-view-label">Skill practice</p><h3>1 hackathon on your route</h3><p>The sample Google Solution Challenge milestone builds on Python and prototyping.</p></div>
              <span className="atlas-priority-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
            </a></li>
          </ol>
        </section>
      </div>

      <aside className="atlas-briefing-aside" aria-label="Briefing evidence and progress">
        <section className="atlas-editorial-panel atlas-evidence" aria-labelledby="evidence-title">
          <p className="eyebrow atlas-view-label">Recommendation evidence</p>
          <h2 id="evidence-title">Why this move</h2>
          <div className="atlas-confidence">
            <div aria-hidden="true"><span /><span /><span className={profileFits ? undefined : 'atlas-confidence-inactive'} /></div>
            <strong>{profileFits ? 'High' : 'Moderate'} confidence</strong>
          </div>
          <p>Illustrative confidence uses your saved preferences and sample role requirements.</p>
          <ul>
            <li><Check size={15} aria-hidden="true" /><span>Orbit Labs has the earliest internship deadline in this sample briefing.</span></li>
            <li><Check size={15} aria-hidden="true" /><span>{profileFits ? 'Your profile matches the student, location, and duration requirements.' : 'Check the student, location, and duration requirements before preparing.'}</span></li>
            <li><Check size={15} aria-hidden="true" /><span>A finished team project supplies evidence for the portfolio requirement.</span></li>
          </ul>
        </section>

        <section className="atlas-editorial-panel atlas-briefing-progress" aria-labelledby="briefing-progress-title">
          <p className="eyebrow atlas-view-label">From your workspace</p>
          <h2 id="briefing-progress-title">Preparation progress</h2>
          <div><strong>{planCount}</strong><span>{planCount === 1 ? 'Active plan' : 'Active plans'}</span><strong>{tasksDone}/{tasks.length}</strong><span>Tasks complete</span></div>
          <a className="atlas-inline-link" href={href('/path')}>Open editable plans <ArrowRight size={14} aria-hidden="true" /></a>
        </section>
      </aside>
    </div>
  </div>
}
