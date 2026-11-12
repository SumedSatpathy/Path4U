import { useEffect, useState, type ReactNode } from 'react'
import { useAccount } from './session'
import { ErrorState, LoadingSkeleton } from './ui'
import { WorkspaceProvider, type CloudWorkspace, type Profile } from './workspace'

export function AccountWorkspace({ children, guest = false }: { children: ReactNode; guest?: boolean }) {
  const { session, refresh, demoOnly } = useAccount()
  const user = session?.user
  const [data, setData] = useState<CloudWorkspace | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (guest || !user) return
    const controller = new AbortController()
    fetch('/api/workspace', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (response.status === 401) void refresh()
      if (!response.ok) throw new Error()
      return response.json() as Promise<CloudWorkspace>
    }).then(setData).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [guest, user?.id, attempt, refresh])
  if (guest) return <WorkspaceProvider temporary={demoOnly === true}>{children}</WorkspaceProvider>
  if (error) return <ErrorState title="Workspace unavailable" description="Your account data could not be loaded." onRetry={() => { setError(false); setAttempt(value => value + 1) }} />
  if (!data || !user) return <LoadingSkeleton />
  const stage = user.preferences?.stage
  const profile: Profile = { name: user.name, stage: stage === 'Student' || stage === 'Graduate' ? stage : 'Other', location: user.preferences?.location?.city || 'Any location', months: 6 }
  return <WorkspaceProvider cloud={data} profile={profile}>{children}</WorkspaceProvider>
}
