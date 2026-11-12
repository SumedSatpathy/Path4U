import { Component, lazy, StrictMode, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'
import './styles.css'
import './learning.css'
import { NavigationConfirmation, PageContent } from './PageContent'
import { AppShell } from './Shell'
import { deadlineChange } from './data'
import { authRoutes, href, navigate, useRoute } from './routes'
import { EmptyState, ErrorState, LoadingSkeleton } from './ui'
import { useWorkspace } from './workspace'
import { AccountProvider, useAccount } from './session'
import { AccountWorkspace } from './AccountWorkspace'
import { DemoProvider } from './demo'

const Roadmap = lazy(() => import('./Learning').then(module => ({ default: module.RoadmapPage })))
const Courses = lazy(() => import('./Learning').then(module => ({ default: module.CoursesPage })))
const MindMap = lazy(() => import('./Learning').then(module => ({ default: module.MindMapPage })))
const AuthPage = lazy(() => import('./Auth').then(module => ({ default: module.AuthPage })))
const DashboardPage = lazy(() => import('./Dashboard').then(module => ({ default: module.DashboardPage })))
const Timeline = lazy(() => import('./Dashboard').then(module => ({ default: module.OpportunityTimeline })))
const ActivityLog = lazy(() => import('./Dashboard').then(module => ({ default: module.ActivityLog })))
const DeadlineMonitor = lazy(() => import('./Dashboard').then(module => ({ default: module.DeadlineMonitor })))
const DeveloperNews = lazy(() => import('./Dashboard').then(module => ({ default: module.DeveloperNews })))
const LandingPage = lazy(() => import('./Landing').then(module => ({ default: module.LandingPage })))
const PlannerPage = lazy(() => import('./AtlasViews').then(module => ({ default: module.PlannerPage })))
const BriefingPage = lazy(() => import('./AtlasViews').then(module => ({ default: module.BriefingPage })))
const InfoPage = lazy(() => import('./Landing').then(module => ({ default: module.InfoPage })))
const DiscoverPage = lazy(() => import('./Discover').then(module => ({ default: module.DiscoverPage })))
const OpportunityDetailPage = lazy(() => import('./Discover').then(module => ({ default: module.OpportunityDetailPage })))
const PathPage = lazy(() => import('./Path').then(module => ({ default: module.PathPage })))
const AgentPage = lazy(() => import('./Path').then(module => ({ default: module.AgentPage })))
const ResumeStudio = lazy(() => import('./ResumeStudio').then(module => ({ default: module.ResumeStudio })))
const DraftLibrary = lazy(() => import('./DraftEditor').then(module => ({ default: module.DraftLibrary })))
const StudioPage = lazy(() => import('./Studio').then(module => ({ default: module.StudioPage })))
const ApprovalModal = lazy(() => import('./ApprovalModal').then(module => ({ default: module.ApprovalModal })))
const ProfilePage = lazy(() => import('./Account').then(module => ({ default: module.ProfilePage })))
const SettingsPage = lazy(() => import('./Account').then(module => ({ default: module.SettingsPage })))
const SourcePage = lazy(() => import('./Account').then(module => ({ default: module.SourcePage })))

const infoPages = ['contact', 'privacy', 'terms', 'github', 'demo'] as const
const titles: Record<string, string> = { '/dashboard': 'Dashboard', '/roadmap': 'My Roadmap', '/flowchart': 'Roadmap Flowchart', '/courses': 'Course Finder', '/mind-map': 'Mind Maps', '/map': 'Opportunity Timeline', '/planner': 'Pathway Planner', '/briefing': 'AI Weekly Briefing', '/discover': 'Opportunity Catalog', '/path': 'Preparation Plans', '/application': 'Application Command Center', '/resume': 'Resume Studio', '/drafts': 'Draft Library', '/activity': 'Activity Log', '/profile': 'Profile', '/settings': 'Settings', '/contact': 'Contact', '/privacy': 'Privacy', '/terms': 'Terms', '/github': 'GitHub', '/demo': 'Demo information' }

class ViewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <ErrorState onRetry={() => window.location.reload()} />
    return this.props.children
  }
}

function WorkspaceRoutes() {
  const { path, params } = useRoute()
  const workspace = useWorkspace()
  const previousPath = useRef(path)
  useEffect(() => {
    document.title = (titles[path] ?? (path.startsWith('/opportunity/') ? 'Opportunity details' : path.startsWith('/source/') ? 'Sample source' : 'Page unavailable')) + ' | Path4U'
    if (previousPath.current !== path) {
      previousPath.current = path
      window.scrollTo(0, 0)
      document.getElementById('main-content')?.focus({ preventScroll: true })
    }
  }, [path])

  const info = infoPages.find(page => path === '/' + page)
  let screen: ReactNode
  switch (path) {
    case '/':
    case '/dashboard': screen = <DashboardPage />; break
    case '/roadmap': screen = <Roadmap initialHours={params.get('hours') ?? ''} initialWeeks={params.get('weeks') ?? ''} initialLevel={params.get('level') ?? ''} proposedGoal={params.get('goal') ?? ''} initialPlan={params.get('plan') ?? ''} />; break
    case '/flowchart': screen = <Roadmap initialHours={params.get('hours') ?? ''} initialWeeks={params.get('weeks') ?? ''} initialLevel={params.get('level') ?? ''} flowchart proposedGoal={params.get('goal') ?? ''} initialPlan={params.get('plan') ?? ''} />; break
    case '/courses': screen = <Courses />; break
    case '/mind-map': screen = <MindMap initialTopic={params.get('goal') ?? ''} />; break
    case '/timeline': screen = <Timeline />; break
    case '/deadlines': screen = <DeadlineMonitor />; break
    case '/news': screen = <DeveloperNews />; break
    case '/map': screen = <Timeline />; break
    case '/planner': screen = workspace.demo ? <PlannerPage /> : <PathPage />; break
    case '/briefing': screen = workspace.demo ? <BriefingPage /> : <DashboardPage />; break
    case '/discover': screen = <DiscoverPage params={params} />; break
    case '/path': screen = <PathPage />; break
    case '/activity': screen = workspace.demo ? <AgentPage /> : <ActivityLog />; break
    case '/resume': screen = <ResumeStudio />; break
    case '/drafts': screen = <DraftLibrary />; break
    case '/application': screen = <StudioPage params={params} />; break
    case '/profile': screen = <ProfilePage />; break
    case '/settings': screen = <SettingsPage />; break
    default:
      if (info) screen = <InfoPage page={info} />
      else if (path.startsWith('/opportunity/')) screen = <OpportunityDetailPage id={path.slice('/opportunity/'.length)} params={params} />
      else if (path.startsWith('/source/')) screen = <SourcePage id={path.slice('/source/'.length)} />
      else screen = <EmptyState title="Page unavailable" description="The link doesn’t match a page in this workspace." action={<a className="button button-primary" href={href('/dashboard')}>Open dashboard</a>} />
  }
  return <AppShell path={path}>
    <ViewErrorBoundary key={path}>
      <Suspense fallback={<LoadingSkeleton />}>{screen}</Suspense>
    </ViewErrorBoundary>
    {workspace.reviewOpen && <Suspense fallback={null}>
      <ApprovalModal open change={deadlineChange} resolution={workspace.state.resolution} onClose={workspace.closeReview} onConfirm={workspace.confirmReview} />
    </Suspense>}
  </AppShell>
}

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, undefined, { replace: true }), [to])
  return <LoadingSkeleton />
}

function App() {
  const { path, params } = useRoute()
  const { session, error, refresh, demoOnly } = useAccount()
  const startDemo = params.get('demo') === '1'
  let previousDemo = false
  try { previousDemo = sessionStorage.getItem('path4u.demo') === '1' } catch { /* Storage may be disabled. */ }
  const [activeDemo, setActiveDemo] = useState(previousDemo)
  const guest = !session?.user && (startDemo || activeDemo || session?.mode === 'demo')
  useEffect(() => {
    if (!startDemo) return
    setActiveDemo(true)
    try { sessionStorage.setItem('path4u.demo', '1') } catch { /* Keep the demo active in this tab. */ }
  }, [startDemo])
  if (demoOnly === null) return error ? <ErrorState title="Website settings unavailable" description={error} onRetry={() => void refresh()} /> : <LoadingSkeleton />
  if (demoOnly) {
    if (authRoutes.has(path) || (path === '/' && (params.has('code') || params.has('token_hash')))) return <Redirect to="/?accounts=coming-soon" />
    if (path === '/') return <Suspense fallback={<LoadingSkeleton />}><LandingPage demoOnly accountNotice={params.get('accounts') === 'coming-soon'} /></Suspense>
    if (path === '/terms' || path === '/privacy') return <Suspense fallback={<LoadingSkeleton />}><main className="app-main"><PageContent><InfoPage page={path === '/terms' ? 'terms' : 'privacy'} /></PageContent></main></Suspense>
    return <DemoProvider><AccountWorkspace key="hackathon-demo" guest><WorkspaceRoutes /></AccountWorkspace></DemoProvider>
  }
  if (path === '/') {
    if(params.has('code') || params.has('token_hash'))return <Redirect to={'/auth/callback?'+params.toString()} />
    if (params.get('view') !== 'public' && session?.user) return <Redirect to={session.user.eligible && session.user.preferences ? '/dashboard' : '/onboarding'} />
    return <Suspense fallback={<LoadingSkeleton />}><LandingPage signedOut={params.get('signedOut') === '1'} /></Suspense>
  }
  if (path === '/terms' || path === '/privacy') return <Suspense fallback={<LoadingSkeleton />}><main className="app-main"><PageContent><InfoPage page={path === '/terms' ? 'terms' : 'privacy'} /></PageContent></main></Suspense>
  if ((session || error) && guest && !session?.recovery && !authRoutes.has(path)) return <DemoProvider><AccountWorkspace key="demo" guest><WorkspaceRoutes /></AccountWorkspace></DemoProvider>
  if (error) return <ErrorState description={error} onRetry={() => void refresh()} />
  if (!session) return <LoadingSkeleton />
  if (authRoutes.has(path)) return <Suspense fallback={<LoadingSkeleton />}><AuthPage path={path} params={params} /></Suspense>
  if (session.mode === 'unavailable') return <Redirect to='/login' />
  if (session.mode === 'live' && !session.user) return <Redirect to={session.recovery ? '/reset-password' : '/login'} />
  if (session.mode === 'live' && (!session.user?.eligible || !session.user.preferences)) return <Redirect to="/onboarding" />
  return <AccountWorkspace key={session.user?.id ?? 'demo'}><WorkspaceRoutes /></AccountWorkspace>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><MotionConfig reducedMotion="user"><AccountProvider><App /><NavigationConfirmation /></AccountProvider></MotionConfig></StrictMode>,
)
