import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Activity, ArrowDownRight, ArrowRight, Bell, Bookmark, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Compass, FileText, LayoutDashboard, Map, Menu, Moon, Settings, Sparkles, Sun, UserRound, X } from 'lucide-react'
import { deadlineChange, formatDate, opportunities } from './data'
import { href, navigate } from './routes'
import { Dialog, Logo, SearchBox } from './ui'
import { useWorkspace } from './workspace'

const primary = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/discover', label: 'Discover', icon: Compass },
  { path: '/path', label: 'My Path', icon: Map },
  { path: '/application', label: 'Studio', icon: FileText },
  { path: '/activity', label: 'Agent activity', icon: Activity },
]
const secondary = [
  { path: '/profile', label: 'Profile', icon: UserRound },
  { path: '/settings', label: 'Settings', icon: Settings },
]

function activePath(current: string, item: string) {
  return current === item || (item === '/discover' && current.startsWith('/opportunity/'))
}

function NavLinks({ path, items, close, mobile = false }: { path: string; items: typeof primary; close?: () => void; mobile?: boolean }) {
  return items.map(item => {
    const selected = activePath(path, item.path)
    return <a key={item.path} className={mobile ? 'mobile-link' : 'sidebar-link'} href={href(item.path)} aria-label={item.label}
      aria-current={selected ? 'page' : undefined} title={item.label} onClick={close}>
      <item.icon size={19} strokeWidth={1.7} /><span>{item.label}</span>
    </a>
  })
}

export function Sidebar({ path, collapsed, onToggle }: { path: string; collapsed: boolean; onToggle: () => void }) {
  return <aside className="sidebar" aria-label="Workspace sidebar">
    <div className="sidebar-brand"><Logo compact={collapsed} /></div>
    <nav className="sidebar-nav" aria-label="Workspace">
      <p className="sidebar-caption">Workspace</p>
      <NavLinks path={path} items={primary} />
      <p className="sidebar-caption sidebar-caption-settings">Account</p>
      <NavLinks path={path} items={secondary} />
    </nav>
    <div className="sidebar-foot">
      <div className="workspace-mode"><span className="signal-dot" /><span>Demo workspace</span></div>
      <button type="button" className="sidebar-link sidebar-collapse" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}<span>Collapse sidebar</span>
      </button>
    </div>
  </aside>
}

export function NotificationCenter({ open, close, bell }: { open: boolean; close: () => void; bell: React.RefObject<HTMLButtonElement | null> }) {
  const { state, openReview, dismissNotice } = useWorkspace()
  if (!open) return null
  return <section className="header-popover notification-popover" aria-label="Notifications">
    <div className="popover-title"><h2>Notifications</h2>{!state.noticeRead && <span className="pill">1 new</span>}</div>
    <div className="notification-item">
      <span className="section-icon warning-icon"><CalendarDays size={17} /></span>
      <div>
        <strong>Orbit Labs moved its deadline</strong>
        <p><del>{formatDate(deadlineChange.oldDate)}</del> <ArrowRight size={13} /> <b>{formatDate(deadlineChange.newDate)}</b> · Sample listing</p>
        <div className="notification-actions">
          <button className="button button-secondary button-small" type="button" onClick={() => { close(); bell.current?.focus(); openReview() }}>
            {state.resolution ? 'View review' : 'Review change'}
          </button>
          {!state.noticeRead && <button className="button button-ghost button-small" type="button" onClick={dismissNotice}>Mark read</button>}
        </div>
      </div>
    </div>
  </section>
}

export function Header({ path, onMenu }: { path: string; onMenu: () => void }) {
  const [query, setQuery] = useState('')
  const [popup, setPopup] = useState<'notifications' | 'profile' | null>(null)
  const { state, setTheme } = useWorkspace()
  const actions = useRef<HTMLDivElement>(null)
  const bell = useRef<HTMLButtonElement>(null)
  const user = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!popup) return
    function outside(event: PointerEvent) {
      if (!actions.current?.contains(event.target as Node)) setPopup(null)
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setPopup(null)
      ;(popup === 'notifications' ? bell.current : user.current)?.focus()
    }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', outside)
      window.removeEventListener('keydown', escape)
    }
  }, [popup])

  const pageName = [...primary, ...secondary].find(item => activePath(path, item.path))?.label ?? 'Workspace'
  const initials = state.profile.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
  return <header className="app-header">
    <button type="button" className="icon-button mobile-menu-trigger" aria-label="Open workspace menu" onClick={onMenu}><Menu size={21} /></button>
    <div className="header-breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{pageName}</strong></div>
    <div className="mobile-header-logo"><Logo /></div>
    <SearchBox className="header-search" value={query} onChange={setQuery} label="Search from workspace header" placeholder="Search opportunities"
      onSubmit={value => navigate('/discover', new URLSearchParams(value ? { q: value } : {}))} />
    <div className="header-actions" ref={actions}>
      <button className="icon-button theme-shortcut" type="button" onClick={() => setTheme(state.theme === 'dark' ? 'light' : 'dark')} aria-label={state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Switch appearance">
        {state.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      <button ref={bell} className="icon-button bell-button" type="button" aria-label={state.noticeRead ? 'Notifications' : 'Notifications, 1 unread'} aria-expanded={popup === 'notifications'}
        onClick={() => setPopup(popup === 'notifications' ? null : 'notifications')} title="Notifications">
        <Bell size={19} />{!state.noticeRead && <span className="bell-dot" />}
      </button>
      <NotificationCenter open={popup === 'notifications'} close={() => setPopup(null)} bell={bell} />
      <button ref={user} type="button" className="header-user" aria-label="Profile options" aria-expanded={popup === 'profile'} onClick={() => setPopup(popup === 'profile' ? null : 'profile')}>
        <span className="avatar">{initials}</span><ChevronDown size={14} />
      </button>
      {popup === 'profile' && <div className="header-popover profile-popover">
        <div className="popover-title"><h2>{state.profile.name}</h2></div>
        <NavLinks items={secondary} path={path} close={() => setPopup(null)} />
        <a className="sidebar-link" href={href('/')} onClick={() => setPopup(null)}><Compass size={19} />Public site</a>
      </div>}
    </div>
  </header>
}

export function AppShell({ path, children }: { path: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [menu, setMenu] = useState(false)
  const { feedback, clearFeedback, storageError, retry } = useWorkspace()
  return <div className={'app-shell' + (collapsed ? ' sidebar-collapsed' : '')}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
    <Sidebar path={path} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
    <div className="app-column">
      <Header path={path} onMenu={() => setMenu(true)} />
      <main id="main-content" className="app-main" tabIndex={-1}>
        {storageError && <div className="storage-banner" role="alert"><span>Browser storage is unavailable. The workspace is showing sample defaults.</span><button className="button button-secondary button-small" onClick={retry}>Try again</button></div>}
        {children}
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Quick navigation"><NavLinks path={path} items={primary} mobile /></nav>
    <Dialog open={menu} onClose={() => setMenu(false)} title="Workspace menu" className="mobile-dialog">
      <nav aria-label="Workspace menu"><NavLinks path={path} items={[...primary, ...secondary]} close={() => setMenu(false)} /><a className="sidebar-link" href={href('/')} onClick={() => setMenu(false)}><Compass size={19} /> Public site</a></nav>
    </Dialog>
    <div className="toast-container">
      {feedback && <div className={'toast toast-' + feedback.tone} key={feedback.id} role={feedback.tone === 'error' ? 'alert' : 'status'}>
        {feedback.tone === 'success' ? <Check size={18} /> : <X size={18} />}<span>{feedback.message}</span>
        <button className="icon-button" aria-label="Dismiss message" onClick={clearFeedback}><X size={16} /></button>
      </div>}
    </div>
  </div>
}

function DashboardMetric({ icon, label, number, detail, link }: { icon: ReactNode; label: string; number: number; detail: string; link: string }) {
  return <a className="panel dash-metric" href={href(link)}>
    <span className="section-icon">{icon}</span><ArrowDownRight size={16} className="dash-metric-arrow" />
    <span className="dash-metric-number">{number}</span><strong>{label}</strong><span className="muted">{detail}</span>
  </a>
}

export function Dashboard() {
  const { state, toggleSaved, openReview } = useWorkspace()
  const [query, setQuery] = useState('')
  const tasks = Object.values(state.plans).flat()
  const done = tasks.filter(task => task.done).length
  const upcoming = [...opportunities].sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3)
  const recommended = [...opportunities].sort((a, b) => b.match.score - a.match.score).slice(0, 3)
  const firstName = state.profile.name.trim().split(/\s+/)[0] || 'there'
  return <div className="dashboard">
    <div className="dashboard-mast">
      <div><p className="eyebrow"><span className="signal-dot" /> Opportunity desk</p><h1>Welcome, {firstName}.</h1><p>Find your next move and keep the work to get there in view.</p></div>
      <div className="dash-mast-links"><span className="pill demo-pill"><span className="signal-dot" /> Fictional demo data</span><a className="button button-primary" href={href('/discover')}>Explore opportunities <ArrowRight size={17} /></a></div>
    </div>
    <SearchBox className="dashboard-search" value={query} onChange={setQuery} label="Search the opportunity catalog" placeholder="Try “AI internship” or “Kuala Lumpur”"
      onSubmit={value => navigate('/discover', new URLSearchParams(value ? { q: value } : {}))} />
    <div className="dash-metrics">
      <DashboardMetric icon={<Bookmark size={18} />} label="Saved opportunities" number={state.saved.length} detail="In your shortlist" link="/path" />
      <DashboardMetric icon={<Check size={18} />} label="Tasks completed" number={done} detail={'Out of ' + tasks.length + ' preparation tasks'} link="/path" />
      <DashboardMetric icon={<FileText size={18} />} label="Applications tracked" number={Object.keys(state.applications).length} detail="In Application Studio" link="/application" />
    </div>
    <div className="dashboard-grid">
      <section className="panel dash-section">
        <div className="section-head"><div><p className="eyebrow">Sample profile matches</p><h2>Recommended for you</h2></div><a className="text-link" href={href('/discover')}>View all <ArrowRight size={15} /></a></div>
        <div className="dash-recommendations">
          {recommended.map(item => <div className="dash-opportunity" key={item.id}>
            <span className={'org-mark org-' + item.color}>{item.initials}</span>
            <a className="dash-opportunity-name" href={href('/opportunity/' + item.id)}><strong>{item.title}</strong><small>{item.organization} · {item.location}</small></a>
            <span className="fit-pill">{item.match.score}% <span>sample fit</span></span>
            <button className="icon-button" type="button" aria-label={'Save ' + item.title} aria-pressed={state.saved.includes(item.id)} onClick={() => toggleSaved(item.id)} title="Toggle saved opportunity"><Bookmark size={18} fill={state.saved.includes(item.id) ? 'currentColor' : 'none'} /></button>
          </div>)}
        </div>
      </section>
      <section className="panel dash-section">
        <div className="section-head"><div><p className="eyebrow">Dates in UTC</p><h2>Upcoming deadlines</h2></div><CalendarDays size={21} className="muted" /></div>
        <div className="dash-deadlines">
          {upcoming.map(item => <a href={href('/opportunity/' + item.id)} key={item.id}><time dateTime={item.deadline}>{formatDate(item.deadline)}</time><span>{item.title}</span><ChevronRight size={16} /></a>)}
        </div>
      </section>
      <section className="panel dash-section">
        <div className="section-head"><div><p className="eyebrow">My Path</p><h2>Preparation progress</h2></div><a className="text-link" href={href('/path')}>Open My Path <ArrowRight size={15} /></a></div>
        <label className="progress-caption"><span>{done} of {tasks.length} tasks complete</span><progress value={done} max={Math.max(1, tasks.length)} /></label>
        <h3 className="saved-heading">Saved opportunities</h3>
        <div className="dash-saved">{state.saved.length ? opportunities.filter(item => state.saved.includes(item.id)).slice(0, 3).map(item => <a key={item.id} href={href('/opportunity/' + item.id)}><Bookmark size={15} />{item.title}</a>) : <span className="muted">Save an opportunity to build your shortlist.</span>}</div>
      </section>
      <section className="panel dash-section recent-section">
        <div className="section-head"><div><p className="eyebrow">Recent changes</p><h2>Deadline moved</h2></div><span className="section-icon warning-icon"><Bell size={19} /></span></div>
        <p>Orbit Labs moved the Product Engineering Internship deadline forward by one week.</p>
        <div className="recent-dates"><del>{formatDate(deadlineChange.oldDate)}</del><ArrowRight size={16} /><b>{formatDate(deadlineChange.newDate)}</b></div>
        <button className="button button-secondary button-small" type="button" onClick={openReview}>{state.resolution ? 'View simulated result' : 'Review deadline change'} <ArrowRight size={15} /></button>
      </section>
    </div>
    <a className="studio-strip panel" href={href('/application')}><span className="section-icon"><Sparkles size={20} /></span><span><strong>Application Studio</strong><small>Analyze your résumé, rank matches, and prepare drafts.</small></span><ArrowRight size={20} /></a>
  </div>
}
