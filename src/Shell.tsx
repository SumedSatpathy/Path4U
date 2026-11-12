import { lazy, Suspense, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Bell, BookOpen, CalendarDays, Check, ChevronDown, ChevronRight, ClipboardList, Compass, FolderOpen, LogIn, LogOut, Menu, PanelLeft, Route, Search, Settings, Sparkles, UserRound, UserRoundPlus, X } from 'lucide-react'
import { deadlineChange, formatDate } from './data'
import { href, navigate } from './routes'
import { PageContent } from './PageContent'
import { Dialog, Logo, SearchBox } from './ui'
import { useWorkspace } from './workspace'
import { useAccount } from './session'
import { useDemo } from './demo'
import { DisabledAccountActions } from './DemoAccess'
import {useIntegrationStatus} from './api'

const Assistant = lazy(() => import('./Assistant').then(module => ({ default: module.Assistant })))

type NavigationItem = { path: string; label: string; icon: typeof Compass; query?: Record<string, string>; short?: string }

const primary: NavigationItem[] = [
  { path: '/dashboard', label: 'Dashboard', short: 'Dashboard', icon: Compass },
  { path: '/discover', label: 'Discover Opportunities', short: 'Discover', icon: Search },
  { path: '/timeline', label: 'Opportunity Timeline', short: 'Timeline', icon: CalendarDays },
  { path: '/application', label: 'Application Tracker', short: 'Apply', icon: FolderOpen, query: { step: 'track' } },
]
const resumeNavigation: NavigationItem = { path:'/resume', label:'Resume Studio', icon:ClipboardList }
const sections = [
  {
    label: 'Atlas Index', icon: Compass, items: [
      { path: '/', label: 'Home', icon: Compass },
      primary[1],
      { path: '/news', label: 'Developer News', icon: BookOpen },
    ],
  },
  {
    label: 'Field Tools', icon: Route, items: [
      { path: '/roadmap', label: 'My Roadmap', icon: Route },
      { path: '/courses', label: 'Course Finder', icon: BookOpen },
      { path: '/flowchart', label: 'Flowcharts', icon: Route },
      { path: '/mind-map', label: 'Mind Maps', icon: Compass },
      { path: '/drafts', label: 'Draft Library', icon: FolderOpen },
      { path: '/application', label: 'AI Opportunity Matcher', icon: Search, query: { step: 'rank' } },
      primary[3],
      { path: '/path', label: 'AI Action Planner', icon: Route },
      primary[2],
      { path: '/deadlines', label: 'Deadline Monitor', icon: CalendarDays },
      { path: '/dashboard', label: 'Path4U AI', icon: Sparkles, query: { assistant: '1' } },
    ],
  },
  {
    label: 'Account', icon: UserRound, items: [
      { path: '/profile', label: 'My Profile', icon: UserRound },
      { path: '/onboarding', label: 'Edit Interests & Skills', icon: ClipboardList, query: { edit: '1' } },
      { path: '/discover', label: 'Saved Opportunities', icon: FolderOpen, query: { saved: '1' } },
      { path: '/activity', label: 'Notifications', icon: Bell },
      { path: '/settings', label: 'Connected Accounts', icon: Settings },
      { path: '/profile', label: 'Preferences', icon: Settings },
      { path: '/settings', label: 'Appearance Settings', icon: Settings },
      { path: '/contact', label: 'Help & Support', icon: BookOpen },
    ],
  },
] satisfies { label: string; icon: typeof Compass; items: NavigationItem[] }[]

function activePath(current: string, item: NavigationItem) {
  if (item.query && !Object.entries(item.query).every(([key, value]) => new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search).get(key) === value)) return false
  return current === item.path || (item.path === '/discover' && current.startsWith('/opportunity/'))
}

function NavLinks({ path, items, close, mobile = false }: { path: string; items: NavigationItem[]; close?: () => void; mobile?: boolean }) {
  const { session, demoOnly } = useAccount()
  return items.filter(item => !demoOnly || item.path !== '/onboarding').map(item => (
    <a key={item.label} className={mobile ? 'mobile-link' : 'sidebar-link'} href={href(item.path === '/' && session?.user ? '/dashboard' : item.path, item.query ? new URLSearchParams(item.query) : undefined)}
      aria-current={activePath(path, item) ? 'page' : undefined} title={item.label} onClick={close}>
      <item.icon size={17} strokeWidth={1.7} aria-hidden="true" /><span>{mobile ? item.short ?? item.label : item.label}</span>
    </a>
  ))
}

function SidebarAccount({ close, compact = false }: { close: () => void; compact?: boolean }) {
  const { session, action, demoOnly } = useAccount()
  const { notify } = useWorkspace()
  const [pending, setPending] = useState(false)
  if (demoOnly) return <div className="sidebar-account" data-compact={compact}><DisabledAccountActions compact /></div>
  return <div className="sidebar-account" data-compact={compact}>
    {session?.user ? <>
      <a className="button button-secondary" href={href('/profile')} title="Account / Profile" aria-label="Account / Profile" onClick={close}><UserRound size={17} /><span>Account / Profile</span></a>
      <button type="button" className="button button-secondary" title="Log Out" aria-label="Log Out" disabled={pending} onClick={async () => {
        setPending(true)
        try {
          await action('logout')
          try { sessionStorage.removeItem('path4u.demo') } catch { /* Storage may be blocked. */ }
          close()
          window.location.replace('/?signedOut=1')
        } catch { setPending(false); notify('Logout could not be completed. Try again.', 'error') }
      }}><LogOut size={17} /><span>{pending ? 'Logging out…' : 'Log Out'}</span></button>
    </> : <>
      <a className="button button-secondary" href={href('/login')} title="Log In" aria-label="Log In"><LogIn size={17} /><span>Log In</span></a>
      <a className="button button-primary sidebar-signup" href={href('/signup')} title="Sign Up" aria-label="Sign Up"><UserRoundPlus size={17} /><span>Sign Up</span></a>
    </>}
  </div>
}

function Sidebar({ path }: { path: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState<number | null>(null)
  const dock = useRef<HTMLElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const groupTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function close() {
    clearTimeout(timer.current)
    clearTimeout(groupTimer.current)
    setGroup(null)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return
      if (group !== null) {
        clearTimeout(groupTimer.current)
        if (dock.current?.contains(document.activeElement)) document.getElementById(id + '-group-' + group)?.focus()
        setGroup(null)
      } else {
        if (dock.current?.contains(document.activeElement)) document.getElementById(id + '-toggle')?.focus()
        close()
      }
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open, group, id])
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(groupTimer.current) }, [])

  return <aside ref={dock} className="sidebar-dock" data-open={open} aria-label="Workspace sidebar"
    onPointerEnter={event => { if (event.pointerType === 'mouse' && !document.querySelector('dialog[open]')) { clearTimeout(timer.current); setOpen(true) } }}
    onPointerLeave={event => {
      if (event.pointerType !== 'mouse') return
      timer.current = setTimeout(() => {
        if (!dock.current?.querySelector(':focus-visible')) close()
      }, 240)
    }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(':hover')) close() }}>
    <button id={id + '-toggle'} type="button" className="sidebar-toggle icon-button" title={open ? 'Close navigation' : 'Open navigation'}
      aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls={id} onClick={() => open ? close() : setOpen(true)}><PanelLeft size={21} /></button>
    <div className="sidebar-dock-brand"><Logo compact={!open} /></div>
    <nav id={id} className="sidebar-nav" aria-label="Workspace" inert={!open}>
      <NavLinks path={path} items={[primary[0]]} close={close} />
      {sections.map(({ label, icon: Icon, items }, index) => (
        <div key={label + '-slot'}>{index === 1 && <NavLinks path={path} items={[resumeNavigation]} close={close} />}
        <div className="sidebar-section" key={label} onPointerEnter={event => {
          if (event.pointerType === 'mouse') { clearTimeout(groupTimer.current); setGroup(index) }
        }} onPointerLeave={event => {
          if (event.pointerType !== 'mouse') return
          const section = event.currentTarget
          groupTimer.current = setTimeout(() => {
            if (!section.querySelector(':focus-visible')) setGroup(current => current === index ? null : current)
          }, 180)
        }} onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(':hover')) setGroup(current => current === index ? null : current)
        }}>
          <button id={id + '-group-' + index} className="sidebar-group" type="button" aria-expanded={group === index}
            aria-controls={id + '-links-' + index} onClick={event => {
              clearTimeout(groupTimer.current)
              const pointerClick = event.nativeEvent instanceof PointerEvent && event.nativeEvent.pointerType === 'mouse'
              setGroup(current => current === index && !pointerClick ? null : index)
            }}>
            <Icon size={19} /><span>{label}</span><ChevronRight size={15} />
          </button>
          <div id={id + '-links-' + index} className="sidebar-flyout-wrap" hidden={group !== index}>
            <div className="sidebar-flyout">
              <NavLinks path={path} items={items} close={close} />
            </div>
          </div>
        </div></div>
      ))}
    </nav>
    {!open && <div className="sidebar-rail-icons"><NavLinks path={path} items={[primary[0]]} close={close}/>{sections.map(({ label, icon: Icon }, index) => (
      <div key={label+'-rail'}>{index === 1 && <NavLinks path={path} items={[resumeNavigation]} close={close}/>}<button type="button" className="icon-button" title={label} aria-label={label} onClick={() => {
        setOpen(true); setGroup(index); requestAnimationFrame(() => document.getElementById(id + '-group-' + index)?.focus())
      }}><Icon size={20} /></button></div>
    ))}</div>}
    <SidebarAccount close={close} compact={!open} />
  </aside>
}
export function NotificationCenter({ open, close, bell }: { open: boolean; close: () => void; bell: React.RefObject<HTMLButtonElement | null> }) {
  const { state, openReview, dismissNotice, demo } = useWorkspace()
  if (!open) return null
  return <section className="header-popover notification-popover" aria-label="Notifications">
    <div className="popover-title"><h2>Notifications</h2>{!state.noticeRead && <span className="pill">1 new</span>}</div>
    {!demo ? <p className="muted">No new notifications.</p> : <div className="notification-item">
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
    </div>}
  </section>
}

export function Header({ path, onMenu }: { path: string; onMenu: () => void }) {
  const [query, setQuery] = useState('')
  const [popup, setPopup] = useState<'notifications' | 'profile' | null>(null)
  const { state } = useWorkspace()
  const demo = useDemo()
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

  const pageName = [...primary, ...sections.flatMap(section => section.items)].find(item => activePath(path, item))?.label ?? 'Workspace'
  const initials = state.profile.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
  return <header className="app-header">
    <button type="button" className="icon-button mobile-menu-trigger" aria-label="Open workspace menu" onClick={onMenu}><Menu size={21} /></button>
    <div className="header-breadcrumb"><span>Path4U</span><ChevronRight size={14} /><strong>{pageName}</strong></div>
    <div className="mobile-header-logo"><Logo /></div>
    <SearchBox className="header-search" value={query} onChange={setQuery} label="Search from workspace header" placeholder="Search opportunities"
      onSubmit={value => navigate('/discover', new URLSearchParams(value ? { q: value } : {}))} />
    <div className="header-actions" ref={actions}>
      {demo && <span title={demo.quota ? 'Shared across AI tools. Renews daily at 00:00 UTC (08:00 Malaysia). Global and Gemini limits also apply.' : undefined} className="header-demo-credit pill" aria-live="polite">{demo.credits === null ? (demo.ready ? 'Free demo' : 'Demo workspace') : (demo.liveAI ? 'AI interactions: ' : 'Demo credits: ') + demo.credits}</span>}
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
        <NavLinks items={sections[2].items.slice(0, 1)} path={path} close={() => setPopup(null)} />
        <a className="sidebar-link" href={href('/demo')} onClick={() => setPopup(null)}><BookOpen size={19} />About Path4U</a>
      </div>}
    </div>
  </header>
}

export function AppShell({ path, children }: { path: string; children: ReactNode }) {
  const services=useIntegrationStatus()
  const [menu, setMenu] = useState(false)
  const [assistant, setAssistant] = useState(false)
  const [assistantPrompt, setAssistantPrompt] = useState('')
  const [assistantLoaded, setAssistantLoaded] = useState(false)
  const assistantButton = useRef<HTMLButtonElement>(null)
  function openAssistant() { setAssistantLoaded(true); setAssistant(true) }
  function closeAssistant() { setAssistant(false); assistantButton.current?.focus() }
  useEffect(() => {
    function checkAssistantLink() {
      const params = new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search)
      if (params.get('assistant') !== '1') return
      openAssistant()
      params.delete('assistant')
      navigate(window.location.pathname === '/dashboard' ? '/dashboard' : window.location.hash.split('?')[0].slice(1) || '/dashboard', params, { replace: true })
    }
    function ask(event: Event) {
      setAssistantPrompt((event as CustomEvent<string>).detail || '')
      openAssistant()
    }
    checkAssistantLink()
    window.addEventListener('path4u:ask', ask)
    window.addEventListener('hashchange', checkAssistantLink)
    return () => { window.removeEventListener('hashchange', checkAssistantLink); window.removeEventListener('path4u:ask', ask) }
  }, [])
  const { feedback, clearFeedback, storageError, retry } = useWorkspace()
  const { demoOnly } = useAccount()
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
    <Sidebar path={path} />
    <div className="app-column">
      <Header path={path} onMenu={() => setMenu(true)} />
      <main id="main-content" className="app-main" tabIndex={-1}>
        <PageContent>
        {demoOnly && <p className="storage-banner" role="note">Public demo · Progress and sample drafts stay in this tab, not in an account. Use sample details. AI usage is limited.</p>}
        {services.temporaryStorageExpires && <p className="storage-banner" role="status">Temporary demo · cloud data expires {services.temporaryStorageExpires}. Use sample information.</p>}
        {storageError && <div className="storage-banner" role="alert"><span>Workspace changes could not be synchronized. Reload before editing again.</span><button className="button button-secondary button-small" onClick={retry}>Try again</button></div>}
        {children}
        </PageContent>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Quick navigation"><NavLinks path={path} items={primary} mobile /></nav>
    <Dialog open={menu} onClose={() => setMenu(false)} title="Workspace menu" className="mobile-dialog">
      <nav aria-label="Workspace menu" className="mobile-menu-groups"><NavLinks path={path} items={[primary[0]]} close={()=>setMenu(false)}/>{sections.map(({label,items},index) => <div key={label}>{index===1 && <NavLinks path={path} items={[resumeNavigation]} close={()=>setMenu(false)}/>}<details><summary>{label}</summary><NavLinks path={path} items={items} close={() => setMenu(false)} /></details></div>)}</nav>
      <SidebarAccount close={() => setMenu(false)} />
    </Dialog>
    <button ref={assistantButton} className="button button-primary assistant-launch" type="button" aria-expanded={assistant} onClick={() => assistant ? closeAssistant() : openAssistant()}><Sparkles size={17} /> Path4U AI</button>
    {assistantLoaded && <Suspense fallback={null}><Assistant open={assistant} close={closeAssistant} prompt={assistantPrompt} /></Suspense>}
    <div className="toast-container">
      {feedback && <div className={'toast toast-' + feedback.tone} key={feedback.id} role={feedback.tone === 'error' ? 'alert' : 'status'}>
        {feedback.tone === 'success' ? <Check size={18} /> : <X size={18} />}<span>{feedback.message}</span>
        <button className="icon-button" aria-label="Dismiss message" onClick={clearFeedback}><X size={16} /></button>
      </div>}
    </div>
  </div>
}
