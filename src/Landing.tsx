import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Bookmark, CalendarDays,
  CalendarClock, Check, CheckCircle2, ChevronRight, ClipboardList, Code2, Compass,
  FileText, Github, Globe2, Layers3, ListChecks, LocateFixed, Mail, Orbit,
  Radar, Search, ShieldCheck, Sparkles, Target, Users,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { ApprovalModal } from './ApprovalModal'
import { useIntegrationStatus } from './api'
import type { IntegrationStatus } from './api'
import { deadlineChange, formatDate, opportunities } from './data'
import type { CalendarResolution } from './data'
import { href } from './routes'
import { Logo } from './ui'
import './landing.css'

const steps = [
  {
    name: 'Discover', title: 'Discover opportunities', icon: Radar, point: [13, 76],
    description: 'Find internships, hackathons, workshops, and roles in one place.',
    detail: 'Search a sample catalog by role, skill, or organizer. Save the opportunities you want to revisit.',
  },
  {
    name: 'Match', title: 'Check eligibility', icon: Target, point: [35, 57],
    description: 'See which requirements you meet and what to check with the organizer.',
    detail: 'Compare your profile to the listing and see the reasoning behind each match.',
  },
  {
    name: 'Prepare', title: 'Prepare your path', icon: ListChecks, point: [61, 39],
    description: 'Turn an application into a checklist you can work through.',
    detail: 'Make a plan, track your progress, and use Application Studio to prepare résumé edits and drafts.',
  },
  {
    name: 'Act', title: 'Stay updated', icon: LocateFixed, point: [86, 20],
    description: 'Review deadline changes and decide whether to update your plan.',
    detail: 'Inspect what changed at the source, see the task affected, and confirm or cancel the proposed update.',
  },
] as const

const problems = [
  { icon: Layers3, title: 'Scattered listings', detail: 'A promising role can be buried in a newsletter, form, or community post.' },
  { icon: FileText, title: 'Unclear eligibility', detail: 'Required qualifications and nice-to-haves often look the same.' },
  { icon: CalendarClock, title: 'Moving deadlines', detail: 'An organizer can change a date after you’ve put it on your calendar.' },
  { icon: Bell, title: 'Missed follow-ups', detail: 'A saved listing is easy to forget without a clear next step.' },
]

const integrations = [
  { icon: Sparkles, name: 'Gemini API', use: 'Résumé analysis and draft suggestions', service: 'gemini' },
  { icon: ListChecks, name: 'Google Sheets', use: 'Application tracking', service: 'sheets' },
  { icon: Mail, name: 'Gmail Drafts', use: 'Email draft handoff', service: 'gmail' },
  { icon: Sparkles, name: 'Gemini Enterprise', use: 'Requirements and fit analysis' },
  { icon: Layers3, name: 'Google Drive', use: 'Source files and documents' },
  { icon: CalendarDays, name: 'Google Calendar', use: 'Deadline reminders' },
  { icon: ClipboardList, name: 'Google Forms', use: 'Opportunity intake' },
  { icon: Code2, name: 'DEV Community', use: 'Community listings' },
  { icon: Globe2, name: 'Greenhouse', use: 'Approved job board listings', service: 'feed' },
] satisfies { icon: typeof Sparkles; name: string; use: string; service?: keyof IntegrationStatus }[]

const previewTabs = [
  { label: 'Discover', icon: Compass },
  { label: 'Match', icon: Target },
  { label: 'Checklist', icon: ListChecks },
  { label: 'Changes', icon: Bell },
]

const previewOpportunity = opportunities.find((item) => item.id === deadlineChange.opportunityId)
const previewTasks = ['Review eligibility', 'Tailor your résumé', deadlineChange.task]

const info = {
  contact: {
    title: 'Contact',
    text: 'A public contact channel is pending for the OpenPath AI demo.',
  },
  privacy: {
    title: 'Demo privacy',
    text: 'OpenPath AI stores workspace edits, including profile details, saved opportunities, tasks, and settings, in this browser. The interactive landing preview keeps its changes in memory for the current visit. Use fictional details when trying the demo.',
  },
  terms: {
    title: 'Demo terms',
    text: 'The sample listings and activity are fictional. Use them to explore the demo. For a real opportunity, check current requirements, deadlines, and application instructions with the organizer.',
  },
  github: {
    title: 'GitHub',
    text: 'An OpenPath AI source repository link is pending for this demo.',
  },
  demo: {
    title: 'About the demo',
    text: 'The OpenPath AI demo uses fictional opportunities, a browser-local workspace, and simulated agent activity. The Calendar review records a simulation. You review and decide what to submit in any application workflow.',
  },
}

type InfoRoute = keyof typeof info

function jumpTo(id: string) {
  const section = document.getElementById(id)
  section?.focus({ preventScroll: true })
  section?.scrollIntoView({
    block: 'start',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}

function PublicHeader({ home = false }: { home?: boolean }) {
  return (
    <header className="public-header">
      <div className="landing-wrap public-header-inner">
        <div className="public-brand"><Logo /></div>
        {home && (
          <nav className="public-nav" aria-label="Product navigation">
            <button type="button" onClick={() => jumpTo('product-preview')}>Product</button>
            <button type="button" onClick={() => jumpTo('how-it-works')}>How it works</button>
            <button type="button" onClick={() => jumpTo('integrations')}>Integrations</button>
          </nav>
        )}
        <a className="button button-secondary public-open" href={href('/dashboard')}>
          Open workspace <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
    </header>
  )
}

function RouteChart() {
  const [active, setActive] = useState(0)
  const reduced = useReducedMotion()
  const id = useId()
  const route = 'M 78 304 C 141 304 157 228 210 228 S 313 216 366 156 S 454 80 516 80'

  return (
    <motion.figure
      className="route-chart"
      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: reduced ? 0 : 0.08 }}
      aria-labelledby="chart-label"
    >
      <div className="route-chart-top">
        <span id="chart-label"><Orbit size={17} aria-hidden="true" /> Opportunity route</span>
        <span className="route-chart-code">MAP / 01</span>
      </div>
      <div className="route-canvas" role="group" aria-label="Select a journey step">
        <svg viewBox="0 0 600 400" preserveAspectRatio="none" className="route-svg" aria-hidden="true">
          <defs>
            <pattern id={id + '-grid'} width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="#8590bb" strokeOpacity=".15" />
            </pattern>
            <linearGradient id={id + '-line'} x1="0" y1="1" x2="1" y2="0" gradientUnits="objectBoundingBox">
              <stop stopColor="#8b5cf6" />
              <stop offset=".6" stopColor="#bc9bff" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
            <radialGradient id={id + '-halo'}>
              <stop stopColor="#7446e4" stopOpacity=".31" />
              <stop offset="1" stopColor="#7446e4" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="600" height="400" fill={'url(#' + id + '-grid)'} />
          <ellipse cx="350" cy="176" rx="283" ry="188" fill={'url(#' + id + '-halo)'} />
          <g fill="none" stroke="#8881cd" strokeOpacity=".18" strokeWidth="1">
            <path d="M -20 198 C 90 247 158 152 217 157 S 319 95 365 69 S 473 36 621 52" />
            <path d="M -20 164 C 94 214 148 127 215 127 S 301 65 357 41 S 467 10 621 27" />
            <path d="M -20 229 C 90 278 167 182 225 185 S 332 128 382 97 S 496 58 621 80" />
            <path d="M -20 341 C 97 370 157 309 247 292 S 402 198 459 181 S 558 137 621 155" />
            <path d="M -20 373 C 110 403 185 338 258 321 S 410 235 474 213 S 558 170 621 182" />
            <path d="M -20 404 C 116 434 186 375 268 352 S 425 271 487 242 S 565 209 621 211" />
          </g>
          <g className="route-crosshairs" fill="none" stroke="#9ea8d5" strokeOpacity=".45" strokeWidth="1">
            <path d="M64 95h12m-6-6v12m93 5h12m-6-6v12m278 162h12m-6-6v12m66 38h12m-6-6v12m-284-15h12m-6-6v12m310-188h12m-6-6v12" />
            <circle cx="516" cy="80" r="51" strokeDasharray="2 6" />
            <circle cx="516" cy="80" r="65" strokeOpacity=".24" />
          </g>
          <path d="M0 328H78m438-248h84M78 304v96m438-320V0" fill="none" stroke="#a89de6" strokeOpacity=".3" strokeDasharray="2 7" />
          <path d={route} fill="none" stroke="#9e80ff" strokeOpacity=".18" strokeWidth="9" strokeLinecap="round" />
          <motion.path
            className="route-line"
            d={route}
            fill="none"
            stroke={'url(#' + id + '-line)'}
            strokeWidth="2.6"
            strokeLinecap="round"
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduced ? 0 : 0.58, ease: 'easeOut' }}
          />
        </svg>
        <span className="route-coordinate route-coordinate-north" aria-hidden="true">N <span>↑</span></span>
        <span className="route-coordinate route-coordinate-origin" aria-hidden="true">WP. 01—04</span>
        {steps.map((step, index) => (
          <button
            className="route-node"
            key={step.name}
            type="button"
            aria-pressed={active === index}
            style={{ '--node-x': step.point[0] + '%', '--node-y': step.point[1] + '%' } as CSSProperties}
            onClick={() => setActive(index)}
          >
            <span className="route-node-core"><step.icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
            <span className="route-node-name">{step.name}</span>
          </button>
        ))}
      </div>
      <figcaption className="route-chart-caption" aria-live="polite">
        <span className="route-counter">{String(active + 1).padStart(2, '0')} <span>/</span> 04</span>
        <span className="route-caption-copy">
          <strong>{steps[active].title}</strong>
          <span>{steps[active].description}</span>
        </span>
      </figcaption>
    </motion.figure>
  )
}

function Hero() {
  const reduced = useReducedMotion()

  return (
    <section className="landing-wrap landing-hero" aria-labelledby="hero-title">
      <motion.div
        className="hero-copy"
        initial={{ opacity: 0, y: reduced ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.27 }}
      >
        <p className="landing-kicker"><span className="landing-signal" /> From opportunity to achievement</p>
        <h1 id="hero-title">Your next opportunity is <span>closer than you think.</span></h1>
        <p className="hero-lede">Discover internships, hackathons, workshops, and career opportunities — then let AI help you take the next step.</p>
        <div className="hero-actions">
          <a className="button button-primary" href={href('/discover')}>
            Explore Opportunities <ArrowRight size={18} aria-hidden="true" />
          </a>
          <button className="button button-secondary" type="button" onClick={() => jumpTo('how-it-works')}>
            See How It Works <ArrowDown size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="hero-note"><ShieldCheck size={16} aria-hidden="true" /> Interactive demo with fictional listings</p>
      </motion.div>
      <RouteChart />
    </section>
  )
}

function SocialProof() {
  return (
    <section className="landing-proof" aria-labelledby="proof-title">
      <div className="landing-wrap landing-proof-inner">
        <h2 id="proof-title">Social proof <span>Reserved for verified submissions</span></h2>
        <div className="proof-slot"><Globe2 size={19} aria-hidden="true" /><strong>Partner logos</strong><span>Placeholder</span></div>
        <div className="proof-slot"><Users size={19} aria-hidden="true" /><strong>Testimonials</strong><span>Placeholder</span></div>
      </div>
    </section>
  )
}

function Problem() {
  return (
    <section className="landing-wrap landing-section problem-section" aria-labelledby="problem-title">
      <div className="landing-section-intro">
        <p className="landing-kicker">The problem</p>
        <h2 id="problem-title">Finding it is only<br className="wide-break" /> the first step.</h2>
        <p>Once you spot an opportunity, you still need to check your fit, keep track of changes, and make time to apply.</p>
      </div>
      <div className="problem-grid">
        {problems.map((problem) => (
          <article className="problem-item" key={problem.title}>
            <problem.icon size={22} strokeWidth={1.65} aria-hidden="true" />
            <div><h3>{problem.title}</h3><p>{problem.detail}</p></div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Workflow({ tryStep }: { tryStep: (step: number) => void }) {
  const [step, setStep] = useState(0)
  const reduced = useReducedMotion()
  const selected = steps[step]

  return (
    <section className="landing-wrap landing-section workflow-section" id="how-it-works" tabIndex={-1} aria-labelledby="workflow-title">
      <div className="landing-section-intro">
        <p className="landing-kicker">How it works</p>
        <h2 id="workflow-title">A clear path to your next step.</h2>
        <p>Find a role, understand its requirements, build a plan, and act when you’re ready.</p>
      </div>
      <div className="workflow-grid" role="group" aria-label="Explore workflow steps">
        {steps.map((item, index) => (
          <motion.button
            className="workflow-card"
            key={item.name}
            type="button"
            aria-pressed={index === step}
            onClick={() => setStep(index)}
            whileHover={reduced ? undefined : { y: -3 }}
            transition={{ duration: 0.18 }}
          >
            <span className="workflow-card-top"><item.icon size={23} strokeWidth={1.7} aria-hidden="true" /><span>0{index + 1}</span></span>
            <strong>{item.title}</strong>
            <span className="workflow-card-copy">{item.description}</span>
          </motion.button>
        ))}
      </div>
      <div className="workflow-detail">
        <p aria-live="polite"><strong>{selected.name}</strong> {selected.detail}</p>
        <button type="button" className="button button-ghost" onClick={() => tryStep(step)}>Try this step <ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </section>
  )
}

function ProductPreview({ view, onView }: { view: number; onView: (view: number) => void }) {
  const [saved, setSaved] = useState(false)
  const [checked, setChecked] = useState([true, false, false])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [resolution, setResolution] = useState<CalendarResolution | null>(null)
  const screen = useRef<HTMLDivElement>(null)
  const moveFocus = useRef(false)
  const reduced = useReducedMotion()
  const completed = checked.filter(Boolean).length
  const oldDate = formatDate(deadlineChange.oldDate)
  const newDate = formatDate(deadlineChange.newDate)
  const title = previewOpportunity?.title ?? 'Product Engineering Internship'
  const organizer = previewOpportunity?.organization ?? 'Orbit Labs'

  useLayoutEffect(() => {
    if (moveFocus.current) {
      moveFocus.current = false
      screen.current?.focus()
    }
  }, [view])

  function openPreviewView(nextView: number) {
    moveFocus.current = true
    onView(nextView)
  }

  function confirmPreview() {
    setResolution({
      changeId: deadlineChange.id, date: deadlineChange.newDate,
      confirmedAt: new Date().toISOString(), simulated: true,
    })
    return true
  }

  return (
    <section className="landing-preview-section" id="product-preview" tabIndex={-1} aria-labelledby="preview-title">
      <div className="landing-wrap landing-section">
        <div className="landing-section-intro preview-section-intro">
          <div><p className="landing-kicker">Product preview</p><h2 id="preview-title">Take it for a spin.</h2></div>
          <p>Explore a fictional internship from first discovery through a deadline change. Your actions here stay in the preview.</p>
        </div>
        <div className="preview-frame">
          <div className="preview-frame-bar">
            <span><span className="preview-frame-mark"><Compass size={16} aria-hidden="true" /></span> OpenPath workspace</span>
            <span className="preview-sample"><span className="landing-signal" /> Fictional demo</span>
          </div>
          <div className="preview-layout">
            <nav className="preview-rail" aria-label="Demo workspace views">
              <span className="preview-rail-label">Workspace</span>
              {previewTabs.map((item, index) => (
                <button type="button" aria-pressed={view === index} key={item.label} onClick={() => onView(index)}>
                  <item.icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span>
                </button>
              ))}
            </nav>
            <motion.div
              className="preview-screen"
              ref={screen}
              tabIndex={-1}
              aria-label={previewTabs[view].label + ' preview'}
              key={view}
              initial={{ opacity: 0, y: reduced ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.19 }}
            >
              {view === 0 && (
                <>
                  <div className="preview-screen-heading"><div><p className="preview-label">Opportunity discovery</p><h3>Discover</h3></div><span className="preview-chip">1 sample listing</span></div>
                  <article className="preview-opportunity">
                    <div className="preview-org-row">
                      <span className="preview-org-icon"><Orbit size={22} aria-hidden="true" /></span>
                      <span><strong>{organizer}</strong><small>Fictional organizer</small></span>
                      <button
                        className="icon-button preview-bookmark"
                        type="button"
                        aria-label="Save sample opportunity"
                        aria-pressed={saved}
                        title="Save sample opportunity"
                        onClick={() => setSaved(!saved)}
                      ><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /></button>
                    </div>
                    <h4>{title}</h4>
                    <p>{previewOpportunity?.summary}</p>
                    <div className="preview-chip-row">
                      <span className="preview-chip">{previewOpportunity?.category}</span>
                      {previewOpportunity?.skills.slice(0, 2).map((skill) => <span className="preview-chip" key={skill}>{skill}</span>)}
                    </div>
                    <button className="button button-secondary" type="button" onClick={() => openPreviewView(1)}>Check sample fit <ChevronRight size={16} aria-hidden="true" /></button>
                  </article>
                </>
              )}
              {view === 1 && (
                <>
                  <div className="preview-screen-heading"><div><p className="preview-label">Eligibility</p><h3>Match explanation</h3></div><span className="preview-chip">Sample profile</span></div>
                  <article className="preview-opportunity">
                    <h4>{title}</h4>
                    <ul className="preview-reasons">
                      <li><CheckCircle2 size={18} aria-hidden="true" /><span><strong>Skill match</strong> {previewOpportunity?.match.reasons[0]}</span></li>
                      <li><Search size={18} aria-hidden="true" /><span><strong>Preparation gap</strong> {previewOpportunity?.match.gaps[0]}</span></li>
                    </ul>
                    <button className="button button-secondary" type="button" onClick={() => openPreviewView(2)}>Open checklist <ChevronRight size={16} aria-hidden="true" /></button>
                  </article>
                </>
              )}
              {view === 2 && (
                <>
                  <div className="preview-screen-heading"><div><p className="preview-label">Preparation plan</p><h3>Application checklist</h3></div><span className="preview-chip" aria-live="polite">{completed} of {previewTasks.length} complete</span></div>
                  <article className="preview-opportunity">
                    <h4>{title}</h4>
                    <progress className="preview-progress" aria-label="Application checklist progress" max={previewTasks.length} value={completed} />
                    <div className="preview-tasks">
                      {previewTasks.map((task, index) => (
                        <label key={task}><input type="checkbox" checked={checked[index]} onChange={(event) => setChecked(checked.map((value, i) => i === index ? event.target.checked : value))} />{task}</label>
                      ))}
                    </div>
                  </article>
                </>
              )}
              {view === 3 && (
                <>
                  <div className="preview-screen-heading"><div><p className="preview-label">Source monitoring</p><h3>Recent changes</h3></div><span className="preview-chip">1 sample change</span></div>
                  <article className="preview-opportunity">
                    <h4>{organizer} moved its deadline</h4>
                    <p>The {title} now closes one week earlier.</p>
                    <div className="preview-date-row"><time dateTime={deadlineChange.oldDate}>{oldDate}</time><ArrowRight size={15} aria-hidden="true" /><time dateTime={deadlineChange.newDate}>{newDate}</time></div>
                  </article>
                </>
              )}
            </motion.div>
            <aside className="preview-side" aria-label="Sample deadline notification">
              <span className={resolution ? 'preview-alert-tag is-resolved' : 'preview-alert-tag'}>
                {resolution ? <Check size={14} aria-hidden="true" /> : <Bell size={14} aria-hidden="true" />}
                {resolution ? 'Simulation confirmed' : 'Needs review'}
              </span>
              <h3>Deadline changed</h3>
              <p>{organizer} · {title}</p>
              <div className="preview-date-row"><time dateTime={deadlineChange.oldDate}>{oldDate}</time><ArrowRight size={15} aria-hidden="true" /><time dateTime={deadlineChange.newDate}>{newDate}</time></div>
              <button className="button button-secondary" type="button" onClick={() => setReviewOpen(true)}>
                {resolution ? 'View simulation result' : 'Review change'} <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            </aside>
          </div>
        </div>
        <div className="preview-footer"><span><ShieldCheck size={16} aria-hidden="true" /> Uses sample records and a simulated Calendar update</span><a href={href('/dashboard')}>Open the full workspace <ArrowRight size={16} aria-hidden="true" /></a></div>
      </div>
      <ApprovalModal
        open={reviewOpen}
        change={deadlineChange}
        resolution={resolution}
        onClose={() => setReviewOpen(false)}
        onConfirm={confirmPreview}
      />
    </section>
  )
}

function Integrations() {
  const status = useIntegrationStatus()

  return (
    <section className="landing-wrap landing-section integrations-section" id="integrations" tabIndex={-1} aria-labelledby="integrations-title">
      <div className="landing-section-intro">
        <p className="landing-kicker">Integration roadmap</p>
        <h2 id="integrations-title">Connect the tools you use.</h2>
        <p>Optional integrations become available when configured. The demo uses fictional listings and browser-local data.</p>
      </div>
      <div className="integrations-grid">
        {integrations.map((integration) => {
          const service = 'service' in integration ? integration.service : undefined
          const label = service ? (status[service] ? 'Configured' : 'Optional') : 'Planned'
          return (
            <article key={integration.name} className="integration-item">
              <span className="integration-icon"><integration.icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
              <div><h3>{integration.name}</h3><p>{integration.use}</p></div>
              <span className="integration-status">{label}</span>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function StudioCallout() {
  return (
    <section className="landing-wrap studio-callout" aria-labelledby="studio-callout-title">
      <div className="studio-callout-card">
        <span className="studio-callout-icon"><FileText size={25} strokeWidth={1.7} aria-hidden="true" /></span>
        <div>
          <p className="landing-kicker">Application Studio</p>
          <h2 id="studio-callout-title">Make the application yours.</h2>
          <p>Compare a CV with role requirements, rank fit, review suggested résumé edits, and track applications. You decide what to send from any cover letter or email draft.</p>
        </div>
        <a className="button button-secondary" href={href('/application')}>Open Application Studio <ArrowUpRight size={16} aria-hidden="true" /></a>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="landing-wrap landing-section final-section" aria-labelledby="final-title">
      <div className="final-card">
        <p className="landing-kicker"><span className="landing-signal" /> The next waypoint</p>
        <h2 id="final-title">Don't just find your next opportunity. <span>Be ready for it.</span></h2>
        <a className="button button-primary" href={href('/discover')}>Explore Opportunities <ArrowRight size={18} aria-hidden="true" /></a>
      </div>
    </section>
  )
}

function PublicFooter({ home = false }: { home?: boolean }) {
  return (
    <footer className="public-footer">
      <div className="landing-wrap public-footer-inner">
        <div className="footer-brand">
          <div className="public-brand"><Logo /></div>
          <p>From opportunity to achievement.</p>
        </div>
        <nav className="footer-group" aria-label="Product links">
          <h2>Product</h2>
          <a href={href('/discover')}>Discover</a>
          <a href={href('/path')}>My Path</a>
          <a href={href('/application')}>Application Studio</a>
        </nav>
        <nav className="footer-group" aria-label="Demo links">
          <h2>Resources</h2>
          {home && <button type="button" onClick={() => jumpTo('product-preview')}>Interactive preview</button>}
          <a href={href('/demo')}>Demo information</a>
          <a href={href('/github')}><Github size={15} aria-hidden="true" /> GitHub</a>
        </nav>
        <nav className="footer-group" aria-label="Company links">
          <h2>OpenPath AI</h2>
          <a href={href('/contact')}>Contact</a>
          <a href={href('/privacy')}>Privacy</a>
          <a href={href('/terms')}>Terms</a>
        </nav>
      </div>
      <div className="landing-wrap footer-bottom"><span>OpenPath AI</span><span>Product demo · Fictional data</span></div>
    </footer>
  )
}

export function LandingPage() {
  const [previewView, setPreviewView] = useState(0)

  return (
    <div className="landing">
      <button className="landing-skip" type="button" onClick={() => jumpTo('main-content')}>Skip to content</button>
      <PublicHeader home />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <SocialProof />
        <Problem />
        <Workflow tryStep={(step) => { setPreviewView(step); jumpTo('product-preview') }} />
        <ProductPreview view={previewView} onView={setPreviewView} />
        <StudioCallout />
        <Integrations />
        <FinalCta />
      </main>
      <PublicFooter home />
    </div>
  )
}

export function InfoPage({ page }: { page: InfoRoute }) {
  const details = info[page]
  return (
    <div className="landing">
      <PublicHeader />
      <main className="landing-wrap public-info" id="main-content" tabIndex={-1}>
        <a className="public-back" href={href('/')}><ArrowLeft size={16} aria-hidden="true" /> Back to OpenPath AI</a>
        <p className="landing-kicker">OpenPath AI demo</p>
        <h1>{details.title}</h1>
        <p>{details.text}</p>
        <a className="button button-primary" href={href('/dashboard')}>Open workspace <ArrowRight size={16} aria-hidden="true" /></a>
      </main>
      <PublicFooter />
    </div>
  )
}

