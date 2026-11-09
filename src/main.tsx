import { Component, lazy, StrictMode, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'
import './styles.css'
import { AccountPageFallback } from './routeFallback'
import { AppShell, Dashboard } from './Shell'
import { deadlineChange } from './data'
import { href, useRoute } from './routes'
import { EmptyState, ErrorState, LoadingSkeleton } from './ui'
import { useWorkspace, WorkspaceProvider } from './workspace'

const LandingPage = lazy(() => import('./Landing').then(module => ({ default: module.LandingPage })))
const InfoPage = lazy(() => import('./Landing').then(module => ({ default: module.InfoPage })))
const DiscoverPage = lazy(() => import('./Discover').then(module => ({ default: module.DiscoverPage })))
const OpportunityDetailPage = lazy(() => import('./Discover').then(module => ({ default: module.OpportunityDetailPage })))
const PathPage = lazy(() => import('./Path').then(module => ({ default: module.PathPage })))
const AgentPage = lazy(() => import('./Path').then(module => ({ default: module.AgentPage })))
const StudioPage = lazy(() => import('./Studio').then(module => ({ default: module.StudioPage })))
const ApprovalModal = lazy(() => import('./ApprovalModal').then(module => ({ default: module.ApprovalModal })))
const ProfilePage = lazy(() => import('./Account').then(module => ({ default: module.ProfilePage })))
const SettingsPage = lazy(() => import('./Account').then(module => ({ default: module.SettingsPage })))
const SourcePage = lazy(() => import('./Account').then(module => ({ default: module.SourcePage })))

const infoPages = ['contact', 'privacy', 'terms', 'github', 'demo'] as const
const titles: Record<string, string> = { '/dashboard': 'Overview', '/discover': 'Discover', '/path': 'My Path', '/application': 'Application Studio', '/activity': 'Agent activity', '/profile': 'Profile', '/settings': 'Settings', '/contact': 'Contact', '/privacy': 'Privacy', '/terms': 'Terms', '/github': 'GitHub', '/demo': 'Demo information' }

class ViewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <ErrorState onRetry={() => window.location.reload()} />
    return this.props.children
  }
}

function App() {
  const { path, params } = useRoute()
  const workspace = useWorkspace()
  const previousPath = useRef(path)
  useEffect(() => {
    document.title = path === '/' ? 'OpenPath AI · From Opportunity to Achievement' :
      (titles[path] ?? (path.startsWith('/opportunity/') ? 'Opportunity details' : path.startsWith('/source/') ? 'Sample source' : 'Page unavailable')) + ' · OpenPath AI'
    if (previousPath.current !== path) {
      previousPath.current = path
      window.scrollTo(0, 0)
      document.getElementById('main-content')?.focus({ preventScroll: true })
    }
  }, [path])

  const info = infoPages.find(page => path === '/' + page)
  if (path === '/' || info) return <ViewErrorBoundary key={path}>
    <Suspense fallback={<AccountPageFallback />}>{info ? <InfoPage page={info} /> : <LandingPage />}</Suspense>
  </ViewErrorBoundary>

  let screen: ReactNode
  switch (path) {
    case '/dashboard': screen = <Dashboard />; break
    case '/discover': screen = <DiscoverPage params={params} />; break
    case '/path': screen = <PathPage />; break
    case '/activity': screen = <AgentPage />; break
    case '/application': screen = <StudioPage params={params} />; break
    case '/profile': screen = <ProfilePage />; break
    case '/settings': screen = <SettingsPage />; break
    default:
      if (path.startsWith('/opportunity/')) screen = <OpportunityDetailPage id={path.slice('/opportunity/'.length)} params={params} />
      else if (path.startsWith('/source/')) screen = <SourcePage id={path.slice('/source/'.length)} />
      else screen = <EmptyState title="Page unavailable" description="The link doesn’t match a page in this workspace." action={<a className="button button-primary" href={href('/dashboard')}>Back to overview</a>} />
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

createRoot(document.getElementById('root')!).render(
  <StrictMode><MotionConfig reducedMotion="user"><WorkspaceProvider><App /></WorkspaceProvider></MotionConfig></StrictMode>,
)
