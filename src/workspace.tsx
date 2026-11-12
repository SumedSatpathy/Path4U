import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { deadlineChange, type Opportunity, type CalendarResolution, type Task } from './data'
import type { MindNode, SavedRoadmap } from '../shared/learning.mjs'
import { apiPost, failureMessage } from './api'

export type ApplicationStatus = 'Preparing' | 'Applied' | 'Interview' | 'Rejected' | 'Offer'
export const applicationStatuses: ApplicationStatus[] = ['Preparing', 'Applied', 'Interview', 'Rejected', 'Offer']
export type CandidateStage = 'Student' | 'Graduate' | 'Other'
export interface Profile { name: string; stage: CandidateStage; location: string; months: number }
export interface TrackedApplication { opportunityId: string; status: ApplicationStatus; updatedAt: string }
export interface ActivityRecord { id: string; action: string; opportunityId: string; time: string }
export interface DemoState {
  roadmaps?: SavedRoadmap[]
  mindMap?: MindNode[]
  activity?: ActivityRecord[]
  theme?: 'light' | 'dark'
  profile: Profile
  saved: string[]
  plans: Record<string, Task[]>
  resolution: CalendarResolution | null
  noticeRead: boolean
  applications: Record<string, TrackedApplication>
}

export interface OpportunityAdapter {
  read(): DemoState
  update(change: (state: DemoState) => DemoState): DemoState
  subscribe(listener: (result: DemoState) => void, onError: () => void): () => void
}

export const STORAGE_KEY = 'openpath.demo.v1'
const starter: DemoState = {
  profile: { name: 'Ahmad Rahman', stage: 'Student', location: 'Kuala Lumpur', months: 6 },
  saved: [],
  plans: {},
  resolution: null,
  noticeRead: false,
  applications: {},
}

function makeBrowserAdapter(temporary = false): OpportunityAdapter {
  const key = temporary ? 'path4u.demo.session.v1' : STORAGE_KEY
  const getStorage = () => temporary ? sessionStorage : localStorage
  const defaultState = temporary ? { ...starter, profile: { ...starter.profile, name: 'Guest Explorer' }, noticeRead: true } : starter
  return {
  read() {
    const raw = getStorage().getItem(key)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as Partial<DemoState> | null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid workspace')
    return {
      profile: { ...defaultState.profile, ...parsed.profile },
      roadmaps: Array.isArray(parsed.roadmaps) ? parsed.roadmaps : [],
      mindMap: Array.isArray(parsed.mindMap) ? parsed.mindMap : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      saved: Array.isArray(parsed.saved) ? parsed.saved : starter.saved,
      plans: parsed.plans && typeof parsed.plans === 'object' ? parsed.plans : starter.plans,
      resolution: parsed.resolution?.changeId === deadlineChange.id ? parsed.resolution : null,
      noticeRead: parsed.noticeRead === true,
      applications: parsed.applications && typeof parsed.applications === 'object' ? parsed.applications : {},
    }
  },
  update(change) {
    const previous = this.read()
    const next = change(previous)
    if (next !== previous) getStorage().setItem(key, JSON.stringify(next))
    return next
  },
  subscribe(listener, onError) {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return
      try { listener(this.read()) } catch { onError() }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  },
}

}
const browserAdapter = makeBrowserAdapter()
const temporaryAdapter = makeBrowserAdapter(true)

type Feedback = { message: string; tone: 'success' | 'error'; id: number }
interface Workspace {
  catalog: Opportunity[]
  catalogLoading: boolean
  catalogError: boolean
  catalogSources: {name: string; count: number; stale: boolean; checkedAt?: string; storage?: string; error?: string}[]
  refreshCatalog: () => void
  demo: boolean
  setTheme: (theme: 'light' | 'dark') => boolean
  state: DemoState
  feedback: Feedback | null
  clearFeedback: () => void
  notify: (message: string, tone?: Feedback['tone']) => void
  storageError: boolean
  retry: () => void
  reviewOpen: boolean
  openReview: () => void
  closeReview: () => void
  confirmReview: () => boolean
  dismissNotice: () => boolean
  toggleSaved: (id: string) => boolean
  createPlan: (id: string) => boolean
  setTask: (id: string, taskId: string, done: boolean) => boolean
  addTask: (id: string, title: string) => boolean
  editTask: (id: string, taskId: string, title: string) => boolean
  saveRoadmap: (roadmap: SavedRoadmap) => boolean
  saveMindMap: (nodes: MindNode[]) => boolean
  saveProfile: (profile: Profile) => boolean
  setApplicationStatus: (id: string, status: ApplicationStatus) => boolean
}

const WorkspaceContext = createContext<Workspace | null>(null)

export interface CloudWorkspace {
  state: Partial<DemoState>
  revision: number
  catalog: Opportunity[]
}

export function WorkspaceProvider({ children, adapter: suppliedAdapter, cloud, profile, temporary = false }: { children: ReactNode; adapter?: OpportunityAdapter; cloud?: CloudWorkspace; profile?: Profile; temporary?: boolean }) {
  const adapter = suppliedAdapter ?? (temporary ? temporaryAdapter : browserAdapter)
  const [initial] = useState(() => {
    if (cloud) return { state: { ...starter, ...cloud.state, profile: cloud.state.profile ?? profile ?? starter.profile }, error: false }
    try { return { state: adapter.read(), error: false } } catch { return { state: starter, error: true } }
  })
  const [state, setState] = useState(initial.state)
  const [storageError, setStorageError] = useState(initial.error)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const feedbackId = useRef(0)
  const [catalog,setCatalog]=useState<Opportunity[]>(cloud?.catalog ?? [])
  const [catalogLoading,setCatalogLoading]=useState(true)
  const [catalogError,setCatalogError]=useState(false)
  const [catalogSources,setCatalogSources]=useState<Workspace['catalogSources']>([])
  const [catalogAttempt,setCatalogAttempt]=useState(0)
  useEffect(()=>{
    const controller=new AbortController()
    setCatalogLoading(true)
    fetch('/api/opportunities',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)])}).then(async response=>{
      if(!response.ok || !response.headers.get('content-type')?.includes('application/json'))throw Error('Feed unavailable')
      const result=await response.json()
      if(!Array.isArray(result.opportunities) || !result.opportunities.every((x:Opportunity)=>typeof x.id==='string' && /^https:\/\//.test(x.sourceUrl) && Array.isArray(x.skills) && typeof x.title==='string'))throw Error('Invalid feed')
      if(!controller.signal.aborted){setCatalog(result.opportunities);setCatalogSources(result.providers ?? []);setCatalogError(false)}
    }).catch(()=>{if(!controller.signal.aborted)setCatalogError(true)}).finally(()=>{if(!controller.signal.aborted)setCatalogLoading(false)})
    return ()=>controller.abort()
  },[catalogAttempt])
  const snapshot = useRef(initial.state)
  const committed = useRef(initial.state)
  const revision = useRef(cloud?.revision ?? -1)
  const queue = useRef(Promise.resolve())
  const generation = useRef(0)
  useEffect(() => { document.documentElement.dataset.theme = state.theme ?? 'dark' }, [state.theme])

  useEffect(() => cloud ? undefined : adapter.subscribe(next => { setState(next); setStorageError(false) }, () => setStorageError(true)), [adapter, cloud])
  useEffect(() => {
    if (!feedback || feedback.tone === 'error') return
    const timer = window.setTimeout(() => setFeedback(null), 4000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const notify = useCallback((message: string, tone: Feedback['tone'] = 'success') => {
    setFeedback({ message, tone, id: ++feedbackId.current })
  }, [])

  function retry() {
    if (cloud) { window.location.reload(); return }
    try { setState(adapter.read()); setStorageError(false) }
    catch { setStorageError(true) }
  }

  function commit(change: (previous: DemoState) => DemoState, message?: string) {
    if (cloud) {
      if (storageError) return false
      const next = change(snapshot.current)
      if (next === snapshot.current) return true
      snapshot.current = next
      setState(next)
      const version = generation.current
      queue.current = queue.current.then(async () => {
        if (generation.current !== version) return
        try {
          const result = await apiPost<{revision: number}>('workspace', { state: next, revision: revision.current })
          revision.current = result.revision
          committed.current = next
          if (message) notify(message)
        } catch (failure) {
          generation.current++
          snapshot.current = committed.current
          setState(committed.current)
          setStorageError(true)
          notify(failureMessage(failure), 'error')
        }
      })
      return true
    }
    try {
      setState(adapter.update(change))
      setStorageError(false)
      if (message) notify(message)
      return true
    } catch {
      notify('Couldn’t save in this browser. Check storage access and try again.', 'error')
      return false
    }
  }

  function changeTasks(id: string, change: (tasks: Task[]) => Task[], message?: string) {
    return commit(previous => {
      const tasks = previous.plans[id]
      return tasks ? { ...previous, plans: { ...previous.plans, [id]: change(tasks) } } : previous
    }, message)
  }

  function recorded(previous: DemoState, action: string, opportunityId: string) {
    return [{ id: crypto.randomUUID(), action, opportunityId, time: new Date().toISOString() }, ...(previous.activity ?? [])].slice(0, 100)
  }

  const value: Workspace = {
    state, feedback, notify, storageError, retry, catalog, catalogLoading, catalogError, catalogSources, refreshCatalog:()=>setCatalogAttempt(x=>x+1), demo: !cloud,
    setTheme: theme => commit(previous => ({ ...previous, theme })),
    clearFeedback: () => setFeedback(null),
    reviewOpen,
    openReview: () => { if (!cloud) setReviewOpen(true) },
    closeReview: () => setReviewOpen(false),
    dismissNotice: () => commit(previous => ({ ...previous, noticeRead: true }), 'Notification marked read'),
    confirmReview: () => commit(previous => previous.resolution ? previous : {
      ...previous,
      noticeRead: true,
      resolution: { changeId: deadlineChange.id, confirmedAt: new Date().toISOString(), date: deadlineChange.newDate, simulated: true },
    }),
    toggleSaved: id => commit(previous => {
      const saved = previous.saved.includes(id) ? previous.saved.filter(value => value !== id) : [...previous.saved, id]
      return { ...previous, saved, activity: recorded(previous, saved.includes(id) ? 'Opportunity saved' : 'Opportunity removed from saved', id) }
    }),
    createPlan: id => {
      const opportunity = catalog.find(item => item.id === id)
      if (!opportunity) return false
      return commit(previous => {
        if (previous.plans[id]) return previous
        const titles = ['Review the eligibility criteria', ...opportunity.requirements.map(item => 'Prepare ' + item.charAt(0).toLowerCase() + item.slice(1)), 'Review and submit on the organizer’s site']
        return {
          ...previous,
          activity: recorded(previous, 'Preparation plan generated', id),
          saved: previous.saved.includes(id) ? previous.saved : [...previous.saved, id],
          plans: { ...previous.plans, [id]: titles.map((title, index) => ({ id: 'plan-' + index, title, done: false })) },
        }
      }, 'Preparation plan ready')
    },
    setTask: (id, taskId, done) => changeTasks(id, tasks => tasks.map(task => task.id === taskId ? { ...task, done } : task)),
    addTask: (id, title) => changeTasks(id, tasks => [...tasks, { id: crypto.randomUUID(), title: title.trim(), done: false }], 'Task added'),
    editTask: (id, taskId, title) => changeTasks(id, tasks => tasks.map(task => task.id === taskId ? { ...task, title: title.trim() } : task), 'Task updated'),
    saveRoadmap: roadmap => commit(previous => {
      const items = previous.roadmaps ?? []
      const existing = items.some(item => item.id === roadmap.id)
      return { ...previous, roadmaps: existing ? items.map(item => item.id === roadmap.id ? roadmap : item) : [roadmap, ...items] }
    }, 'Roadmap saved'),
    saveMindMap: mindMap => commit(previous => ({ ...previous, mindMap }), 'Mind map saved'),
    saveProfile: profile => commit(previous => ({ ...previous, profile }), 'Profile saved'),
    setApplicationStatus: (id, status) => commit(previous => ({
      ...previous,
      activity: recorded(previous, 'Application status recorded · ' + status, id),
      applications: { ...previous.applications, [id]: { opportunityId: id, status, updatedAt: new Date().toISOString() } },
    }), 'Application status saved'),
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('Workspace provider is required')
  return workspace
}
