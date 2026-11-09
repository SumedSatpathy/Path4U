import { LoadingSkeleton, Logo } from './ui'

export function AccountPageFallback() {
  return <div className="app-main"><Logo /><main id="main-content" tabIndex={-1}><LoadingSkeleton /></main></div>
}
