import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiPost } from './api'

export interface Location { country: string; region: string; city: string }

export interface Preferences {
  organization: string
  field: string
  stage: 'Student' | 'Graduate' | 'Professional'
  interests: string[]
  skills: string[]
  goals: string[]
  statuses?: string[]
  level?: string
  location?: Location
  workMode?: string
  relocate?: boolean
  weeklyHours?: string
  budget?: string
}

interface Session {
  mode: 'live' | 'demo' | 'unavailable'
  user: { id: string; email: string; name: string; location?: Location; eligible: boolean; preferences: Preferences | null } | null
  recovery?: boolean
}

interface AccountContextValue {
  demoOnly: boolean | null
  session: Session | null
  error: string
  refresh: () => Promise<void>
  action: <T>(name: string, input?: object) => Promise<T>
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const [demoOnly, setDemoOnly] = useState<boolean | null>(null)
  const demoFlag = useRef<boolean | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const request = useRef<Promise<void> | null>(null)
  const refresh = useCallback(() => {
    if (request.current) return request.current
    const version = generation.current
    const check = async () => {
    setError('')
    try {
      if (demoFlag.current === null) {
        const settings = await fetch('/api/app-config', { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
        const config = settings.ok && settings.headers.get('content-type')?.includes('application/json') ? await settings.json() : null
        if (typeof config?.demoOnly !== 'boolean') throw new Error('Website settings unavailable')
        demoFlag.current = config.demoOnly
        setDemoOnly(config.demoOnly)
      }
      if (demoFlag.current) {
        if (version === generation.current) setSession({ mode: 'demo', user: null })
        return
      }
      const response = await fetch('/api/auth/session', { cache: 'no-store', signal: AbortSignal.timeout(18_000) })
      if (import.meta.env.DEV && !response.headers.get('content-type')?.includes('application/json')) {
        if (version === generation.current) setSession({ mode: 'demo', user: null })
        return
      }
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error()
      const next = await response.json() as Session
      if (version === generation.current) setSession(next)
    } catch {
      if (version === generation.current) setError(demoFlag.current === null ? 'Website settings could not be loaded. Try again.' : 'The account service could not be reached. Try again.')
    }
    }
    request.current = check().finally(() => { request.current = null })
    return request.current
  }, [])
  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 20 * 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function action<T>(name: string, input: object = {}) {
    if (demoFlag.current && name !== 'logout') throw new Error('Account registration and sign-in are not available in this demo version.')
    const result = await apiPost<T>('auth/' + name, input)
    if (result && typeof result === 'object' && 'mode' in result) { generation.current++; setError(''); setSession(result as unknown as Session) }
    return result
  }
  return <AccountContext.Provider value={{ demoOnly, session, error, refresh, action }}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (!context) throw new Error('Account provider is required')
  return context
}
