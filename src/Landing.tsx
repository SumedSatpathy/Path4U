import { useEffect, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Compass, Route, Sparkles, TrendingUp } from 'lucide-react'
import { DisabledAccountActions } from './DemoAccess'
import { PageContent } from './PageContent'
import { href } from './routes'
import './landing.css'

const features = [
  { title: 'Discover', text: 'Find internships, jobs, hackathons, and scholarships worth pursuing.', icon: Compass, id: 'explore' },
  { title: 'Learn', text: 'Find courses and tutorials from their original providers.', icon: BookOpen, id: 'learn' },
  { title: 'Plan', text: 'Build a roadmap around your goals, skills, and schedule.', icon: Route, id: 'roadmaps' },
  { title: 'Grow', text: 'Track milestones, applications, and the skills you build.', icon: TrendingUp, id: 'grow' },
]

export function LandingPage({ signedOut = false, demoOnly = false, accountNotice = false }: { signedOut?: boolean; demoOnly?: boolean; accountNotice?: boolean }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    document.title = 'Path4U'
    const id = window.location.hash.slice(1)
    if (id && !id.startsWith('/')) document.getElementById(id)?.scrollIntoView()
  }, [])
  const preview = [
    { title: 'Build the foundation', detail: 'Choose a practical skill and complete one guided exercise.', index: '01' },
    { title: 'Make something real', detail: 'Turn what you learned into a small portfolio project.', index: '02' },
    { title: 'Find your next opportunity', detail: 'Compare your skills with roles you want to apply for.', index: '03' },
  ]
  return <div className="public-site">
    <a className="skip-link" href="#landing-main">Skip to content</a>
    <header className="public-header">
      <a href="/" className="public-brand"><img src="/mark-inverse.svg" width="33" height="33" alt="" />Path4U</a>
      <nav aria-label="Main navigation"><a href="/">Home</a><a href="#explore">Explore</a><a href="#roadmaps">Roadmaps</a><a href="#features">Features</a><a href="#about">About</a></nav>
      <div className="public-actions">{demoOnly ? <span className="pill">Hackathon demo</span> : <><a href="/login">Log In</a><a className="public-primary" href="/signup">Sign Up</a></>}</div>
    </header>
    <main id="landing-main"><PageContent className="public-page-content">
      {signedOut && <p className="landing-session-status" role="status">You’re logged out.</p>}
      <section className="public-hero">
        <div className="public-orbit" aria-hidden="true"><i /><i /><i /></div>
        <div className="public-hero-copy">
          {demoOnly ? <>
            <p className="public-kicker"><span /> Your career workspace</p>
            <h1 className="demo-welcome-heading">Welcome to<br /><em>Path4U.</em></h1>
            <p>Explore your future. Find your path.</p>
            <div className="demo-entry">
              <span className="demo-available"><span aria-hidden="true" /> Available Now</span>
              <a className="public-primary demo-entry-button" href={href('/dashboard', new URLSearchParams({ demo: '1' }))}><Sparkles size={21} aria-hidden="true" /> Explore Path4U Demo <ArrowRight size={19} aria-hidden="true" /></a>
              <p className="demo-entry-help">No account required. Start exploring instantly.</p>
              <DisabledAccountActions />
              <p className="demo-account-note" role={accountNotice ? 'status' : undefined}>Account registration and sign-in are not available in this demo version.</p>
            </div>
          </> : <>
          <p className="public-kicker"><span /> The career workspace</p>
          <h1>Your future.<br /><em>Your path.</em></h1>
          <p>Discover opportunities, learn new skills, and build your career with AI.</p>
          <div className="public-ctas"><a className="public-primary" href="/signup">Get Started <ArrowUpRight size={17} /></a><a className="public-secondary" href={href('/dashboard', new URLSearchParams({ demo: '1' }))}>Try Free Demo <ArrowRight size={17} /></a></div>
          </>}
        </div>
        <div className="public-preview">
          <div className="preview-top"><span><Route size={16} /> Roadmap preview</span><span>01 / Example</span></div>
          <div className="preview-body"><p className="public-kicker">Learning path</p><h2>From first skill<br />to first role.</h2>
            <ol>{preview.map((item, index) => <li key={item.index}><button type="button" aria-pressed={index === step} onClick={() => setStep(index)}><span>{item.index}</span>{item.title}{index === step && <ArrowUpRight size={15} />}</button></li>)}</ol>
            <p className="preview-detail" aria-live="polite">{preview[step].detail}</p>
          </div>
        </div>
        <a className="public-scroll" href="#features"><ArrowDown size={15} /> Explore Path4U</a>
      </section>
      <section id="features" className="public-section"><p className="public-kicker">Inside Path4U</p><h2>Make your next move.</h2><div className="public-features">{features.map(({ title, text, icon: Icon, id }) => <article id={id} key={id}><Icon size={22} strokeWidth={1.5} /><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section id="about" className="public-section public-about"><div><p className="public-kicker">How it works</p><h2>Start with a goal.</h2><p>Tell us what you want to do, turn it into a learning plan, and keep your next steps in one place.</p></div><a className="public-primary" href={demoOnly ? href('/dashboard', new URLSearchParams({ demo: '1' })) : '/signup'}>{demoOnly ? 'Explore the demo' : 'Create your account'} <ArrowUpRight size={17} /></a></section>
    </PageContent></main>
    <footer className="public-footer"><a className="public-brand" href="/"><img src="/mark-inverse.svg" width="27" height="27" alt="" />Path4U</a><div><a href={href('/privacy')}>Privacy</a><a href={href('/terms')}>Terms</a></div></footer>
  </div>
}

const info = {
  contact: { title: 'Contact', text: 'Public support contact details are pending.' },
  privacy: { title: 'Privacy', text: 'Path4U uses your self-declared date of birth to check age eligibility. It does not retain your birth date. Existing email sign-in uses Supabase Auth. The repaired Preview stores signed-in preferences, drafts and workspace records in Supabase PostgreSQL with account ownership policies. Older temporary Previews identify their storage expiry in the workspace notice. Guest quota records use a hashed network identifier, and duplicate replies may be retained for five minutes. Demo workspace edits stay in your browser. Optional provider actions explain what they share before you continue.' },
  terms: { title: 'Terms', text: 'Path4U has a minimum age of 15. Additional consent requirements apply to users under 18. Confirm opportunity requirements, deadlines, and application channels with the organizer.' },
  github: { title: 'Source information', text: 'The Path4U checkout includes the frontend, integration adapters, and setup instructions.' },
  demo: { title: 'About the demo', text: 'Explore live source-backed opportunities and local Resume Studio tools without an account. Live Gemini features have usage limits and require a working backend. Use sample information; demo progress and drafts stay in your browser and are not saved to an account.' },
}

export function InfoPage({ page }: { page: keyof typeof info }) {
  const content = info[page]
  return <div className="simple-page"><header><h1>{content.title}</h1><p>{content.text}</p></header></div>
}
