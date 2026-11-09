import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { deadlineChange, opportunities, type CalendarResolution, type Task } from './data'

export type Theme = 'dark' | 'light'
export type ApplicationStatus = 'Preparing' | 'Applied' | 'Interview' | 'Rejected' | 'Offer'
export const applicationStatuses: ApplicationStatus[] = ['Preparing', 'Applied', 'Interview', 'Rejected', 'Offer']
export type CandidateStage = 'Student' | 'Graduate' | 'Other'
export interface Profile { name: string; stage: CandidateStage; location: string; months: number }
export interface TrackedApplication { opportunityId: string; status: ApplicationStatus; updatedAt: string }
export interface DemoState {
  theme: Theme
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
  theme: 'dark',
  profile: { name: 'Alex Morgan', stage: 'Student', location: 'Kuala Lumpur', months: 6 },
  saved: ['orbit-summer', 'atlas-data'],
  plans: {
    'orbit-summer': [
      { id: 'read', title: 'Read the eligibility and application requirements', done: true },
      { id: 'portfolio', title: 'Choose a portfolio project', done: true },
      { id: 'resume', title: 'Tailor your résumé to the role', done: false },
      { id: 'submit', title: deadlineChange.task, done: false },
    ],
  },
  resolution: null,
  noticeRead: false,
  applications: {},
}

const browserAdapter: OpportunityAdapter = {
  read() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return starter
    const parsed = JSON.parse(raw) as Partial<DemoState> | null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid workspace')
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      profile: { ...starter.profile, ...parsed.profile },
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
    if (next !== previous) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  },
  subscribe(listener, onError) {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return
      try { listener(this.read()) } catch { onError() }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  },
}

type Feedback = { message: string; tone: 'success' | 'error'; id: number }
interface Workspace {
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
  saveProfile: (profile: Profile) => boolean
  setTheme: (theme: Theme) => boolean
  setApplicationStatus: (id: string, status: ApplicationStatus) => boolean
}

const WorkspaceContext = createContext<Workspace | null>(null)

export function WorkspaceProvider({ children, adapter = browserAdapter }: { children: ReactNode; adapter?: OpportunityAdapter }) {
  const [initial] = useState(() => {
    try { return { state: adapter.read(), error: false } } catch { return { state: starter, error: true } }
  })
  const [state, setState] = useState(initial.state)
  const [storageError, setStorageError] = useState(initial.error)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const feedbackId = useRef(0)

  useEffect(() => adapter.subscribe(next => { setState(next); setStorageError(false) }, () => setStorageError(true)), [adapter])
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.theme === 'light' ? '#f5f5fc' : '#080b16')
  }, [state.theme])
  useEffect(() => {
    if (!feedback || feedback.tone === 'error') return
    const timer = window.setTimeout(() => setFeedback(null), 4000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const notify = useCallback((message: string, tone: Feedback['tone'] = 'success') => {
    setFeedback({ message, tone, id: ++feedbackId.current })
  }, [])

  function retry() {
    try { setState(adapter.read()); setStorageError(false) }
    catch { setStorageError(true) }
  }

  function commit(change: (previous: DemoState) => DemoState, message?: string) {
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

  const value: Workspace = {
    state, feedback, notify, storageError, retry,
    clearFeedback: () => setFeedback(null),
    reviewOpen,
    openReview: () => setReviewOpen(true),
    closeReview: () => setReviewOpen(false),
    dismissNotice: () => commit(previous => ({ ...previous, noticeRead: true }), 'Notification marked read'),
    confirmReview: () => commit(previous => previous.resolution ? previous : {
      ...previous,
      noticeRead: true,
      resolution: { changeId: deadlineChange.id, confirmedAt: new Date().toISOString(), date: deadlineChange.newDate, simulated: true },
    }),
    toggleSaved: id => commit(previous => {
      const saved = previous.saved.includes(id) ? previous.saved.filter(value => value !== id) : [...previous.saved, id]
      return { ...previous, saved }
    }),
    createPlan: id => {
      const opportunity = opportunities.find(item => item.id === id)
      if (!opportunity) return false
      return commit(previous => {
        if (previous.plans[id]) return previous
        const titles = ['Review the eligibility criteria', ...opportunity.requirements.map(item => 'Prepare ' + item.charAt(0).toLowerCase() + item.slice(1)), 'Review and submit on the organizer’s site']
        return {
          ...previous,
          saved: previous.saved.includes(id) ? previous.saved : [...previous.saved, id],
          plans: { ...previous.plans, [id]: titles.map((title, index) => ({ id: 'plan-' + index, title, done: false })) },
        }
      }, 'Preparation plan ready in My Path')
    },
    setTask: (id, taskId, done) => changeTasks(id, tasks => tasks.map(task => task.id === taskId ? { ...task, done } : task)),
    addTask: (id, title) => changeTasks(id, tasks => [...tasks, { id: crypto.randomUUID(), title: title.trim(), done: false }], 'Task added'),
    editTask: (id, taskId, title) => changeTasks(id, tasks => tasks.map(task => task.id === taskId ? { ...task, title: title.trim() } : task), 'Task updated'),
    saveProfile: profile => commit(previous => ({ ...previous, profile }), 'Profile saved'),
    setTheme: theme => commit(previous => ({ ...previous, theme })),
    setApplicationStatus: (id, status) => commit(previous => ({
      ...previous,
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
