import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { mergeDemoBalance, utcQuotaWindow, type DemoBalance } from '../shared/aiQuota.mjs'
import type { LearningAction } from '../shared/learning.mjs'
import { apiPost, failureMessage } from './api'

interface DemoContext {
  liveAI: boolean
  credits: number | null
  ready: boolean
  error: string
  quota?: DemoBalance['quota']
  retry: () => void
  run: <T>(name: LearningAction, payload: object) => Promise<T>
}
const Demo = createContext<DemoContext | null>(null)
let inFlight: Promise<DemoBalance> | null = null

function begin() {
  inFlight ??= apiPost<DemoBalance>('demo/session', {}).finally(() => { inFlight = null })
  return inFlight
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [liveAI,setLiveAI]=useState(false)
  const [balance, setBalance] = useState<DemoBalance | null>(null)
  const credits = balance?.credits ?? null
  const quota = balance?.quota
  const updateBalance = (next: DemoBalance) => setBalance(current => mergeDemoBalance(current, next))
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const clockOffset = useRef(0)
  const pending = useRef(new Map<string, string>())
  useEffect(() => {
    let active = true
    begin().then(result => { if (active) { if(result.quota)clockOffset.current=Date.parse(result.quota.serverNow)-Date.now(); updateBalance(result); setLiveAI(result.liveAI===true); setReady(true); setError('') } })
      .catch(error => { if (active) {setError(failureMessage(error));setReady(false)} })
    return () => { active = false }
  }, [attempt])

  useEffect(() => {
    // Use the server's elapsed-to-reset interval; no dependence on a correct device clock.
    const period = quota ?? utcQuotaWindow()
    const remaining = Date.parse(period.resetAt) - (Date.now() + clockOffset.current)
    const timer = window.setTimeout(() => setAttempt(value => value + 1), remaining > 0 ? remaining + 300 : 60_000)
    return () => clearTimeout(timer)
  }, [quota, attempt])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setAttempt(value => value + 1) }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  async function run<T>(name: LearningAction, payload: object) {
    if (ready && credits === null) return (await apiPost<{ result: T }>('demo/' + name, payload)).result
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([name, payload])))
    const key = 'path4u.pending.' + Array.from(new Uint8Array(digest), part => part.toString(16).padStart(2, '0')).join('')
    let remembered: string | null = null
    try { remembered = sessionStorage.getItem(key) } catch { /* Keep the in-memory retry ID. */ }
    const requestId = pending.current.get(key) ?? remembered ?? crypto.randomUUID()
    if (pending.current.size >= 40) pending.current.clear()
    pending.current.set(key, requestId)
    try { sessionStorage.setItem(key, requestId) } catch { /* Keep the in-memory retry ID. */ }
    let data: DemoBalance & {result:T}
    try { data = await apiPost<DemoBalance & {result:T}>('demo/' + name, { ...payload, requestId }) } catch(error) {
      if(error && typeof error==='object' && 'status' in error && Number(error.status)>=400 && error.status!==409) {pending.current.delete(key);try{sessionStorage.removeItem(key)}catch{}}
      setAttempt(value => value + 1)
      throw error
    }
    pending.current.delete(key)
    try { sessionStorage.removeItem(key) } catch { /* The completed ID is safe to retry. */ }
    updateBalance(data)
    return data.result
  }
  return <Demo.Provider value={{ liveAI, credits, quota, ready, error, retry: () => setAttempt(value => value + 1), run }}>{children}</Demo.Provider>
}

export function useDemo() { return useContext(Demo) }
