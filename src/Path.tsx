import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, BellRing, Bookmark, CalendarClock, Check, CheckCheck, CircleAlert, Clock3, FileSearch, GitCompareArrows, ListChecks, Pencil, Plus, Radar, ScanLine, Workflow } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { deadlineChange, formatDate, type CalendarResolution, type DeadlineChange, type Task } from './data'
import { href } from './routes'
import { EmptyState } from './ui'
import { useWorkspace } from './workspace'
import './path.css'

export function TaskProgress({ done, total, label = 'Tasks completed' }: { done: number; total: number; label?: string }) {
  const reduced = useReducedMotion()
  const percent = total ? Math.round((done / total) * 100) : 0
  return <div className="task-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
    aria-valuetext={`${done} of ${total} tasks complete`}>
    <motion.span initial={false} animate={{ width: `${percent}%` }} transition={{ duration: reduced ? 0 : 0.24 }} />
  </div>
}

interface ChecklistProps {
  tasks: Task[]
  onToggle: (id: string, done: boolean) => boolean
  onAdd?: (title: string) => boolean
  onEdit?: (id: string, title: string) => boolean
}

function TaskEditor({ initial, onSave, onClose }: { initial?: string; onSave: (title: string) => boolean; onClose: () => void }) {
  const [value, setValue] = useState(initial ?? '')
  const [error, setError] = useState('')
  const id = useId()
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => {
    field.current?.focus()
    if (initial) field.current?.select()
  }, [initial])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = value.trim()
    if (!title) {
      setError('Enter a task name.')
      field.current?.focus()
      return
    }
    if (onSave(title)) onClose()
    else setError('The task could not be saved. Try saving again.')
  }

  return <form className="task-editor" noValidate onSubmit={submit}>
    <label htmlFor={id}>{initial ? 'Task name' : 'New task'}</label>
    <input className="field" ref={field} id={id} value={value} maxLength={120} required
      aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      onKeyDown={event => {
        if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault()
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) onClose()
      }} onChange={event => { setValue(event.target.value); setError('') }} />
    {error && <p id={`${id}-error`} className="task-editor-error" role="alert">{error}</p>}
    <div className="task-editor-actions">
      <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" className="button button-primary">{initial ? 'Save changes' : 'Add task'}</button>
    </div>
  </form>
}

export function Checklist({ tasks, onToggle, onAdd, onEdit }: ChecklistProps) {
  const [editor, setEditor] = useState<{ id: string | null; trigger: HTMLButtonElement } | null>(null)
  const editorId = useId()
  function close() {
    editor?.trigger.focus()
    setEditor(null)
  }

  return <div className="checklist">
    {tasks.length ? <ul className="task-list">
      {tasks.map(task => <li key={task.id}>
        <div className="task-row">
          <label className={task.done ? 'task-done' : undefined}>
            <input type="checkbox" checked={task.done} onChange={event => onToggle(task.id, event.target.checked)} />
            <span>{task.title}</span>
          </label>
          {onEdit && <button type="button" className="icon-button task-edit" aria-label={`Edit task: ${task.title}`} title="Edit task"
            aria-expanded={editor?.id === task.id} aria-controls={editor?.id === task.id ? editorId : undefined}
            onClick={event => editor?.id === task.id ? close() : setEditor({ id: task.id, trigger: event.currentTarget })}><Pencil size={15} aria-hidden="true" /></button>}
        </div>
        {onEdit && editor?.id === task.id && <div id={editorId}><TaskEditor initial={task.title} onSave={title => onEdit(task.id, title)} onClose={close} /></div>}
      </li>)}
    </ul> : <p className="muted">Add a task to start this plan.</p>}
    {onAdd && <button type="button" className="button button-ghost task-add" aria-expanded={editor?.id === null}
      aria-controls={editor?.id === null ? editorId : undefined}
      onClick={event => editor?.id === null ? close() : setEditor({ id: null, trigger: event.currentTarget })}>
      <Plus size={16} aria-hidden="true" /> Add task
    </button>}
    {onAdd && editor?.id === null && <div id={editorId}><TaskEditor onSave={onAdd} onClose={close} /></div>}
  </div>
}

interface TimelineItem { id: string; title: string; description: string; date?: string; done?: boolean }

export function ProgressTimeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <p className="muted path-timeline-empty">Create a plan to see its deadline here.</p>
  return <ol className="path-timeline">
    {items.map(item => <li key={item.id}>
      <span className={`path-timeline-marker${item.done ? ' is-complete' : ''}`}>{item.done ? <Check size={12} aria-hidden="true" /> : <Clock3 size={12} aria-hidden="true" />}</span>
      <div><strong>{item.title}</strong><p>{item.description}</p></div>
      {item.date && <time dateTime={item.date}>{formatDate(item.date)}</time>}
    </li>)}
  </ol>
}

export function PathPage() {
  const { state, setTask, addTask, editTask, openReview, demo, catalog: opportunities } = useWorkspace()
  const plans = opportunities.filter(item => state.plans[item.id]).sort((a, b) => a.deadline.localeCompare(b.deadline))
  const saved = opportunities.filter(item => state.saved.includes(item.id))
  const tasks = plans.flatMap(item => state.plans[item.id])
  const done = tasks.filter(task => task.done).length
  const calendar = state.resolution
  const milestones = plans.map(item => ({ id: item.id, title: item.title, description: 'Application deadline', date: item.deadline }))

  return <div className="path-page">
    <div className="path-page-heading">
      <div><p className="eyebrow"><Workflow size={14} aria-hidden="true" /> Your preparation workspace</p><h1>Preparation plans</h1><p>Turn the opportunities you’ve saved into a plan you can follow.</p></div>
      <a className="button button-secondary" href={href('/application')}>Command Center <ArrowRight size={16} aria-hidden="true" /></a>
    </div>

    <section className="panel path-overview" aria-label="Preparation overview">
      <div className="path-overview-main">
        <div className="path-progress-heading"><ListChecks size={17} aria-hidden="true" /><h2>Task progress</h2><strong>{done}<span> / {tasks.length}</span></strong></div>
        <TaskProgress done={done} total={tasks.length} />
      </div>
      <div className="path-overview-stat"><strong>{plans.length}</strong><span>{plans.length === 1 ? 'Active plan' : 'Active plans'}</span></div>
      <div className="path-overview-stat"><strong>{saved.length}</strong><span>Saved opportunities</span></div>
    </section>

    <div className="path-columns">
      <div className="path-stack">
        <section aria-labelledby="path-plans-heading">
          <div className="path-section-heading"><h2 id="path-plans-heading">Preparation plans</h2></div>
          <div className="path-stack">
            {plans.map(item => {
              const plan = state.plans[item.id]
              return <article key={item.id} className="panel path-plan">
                <div className="path-plan-heading">
                  <div><p className="muted">{item.organization} · {item.category}</p><h3><a href={href('/opportunity/' + item.id)}>{item.title}</a></h3></div>
                  <span>{plan.filter(task => task.done).length}/{plan.length} complete</span>
                </div>
                <Checklist tasks={plan} onToggle={(id, checked) => setTask(item.id, id, checked)} onAdd={title => addTask(item.id, title)} onEdit={(id, title) => editTask(item.id, id, title)} />
              </article>
            })}
            {!plans.length && <EmptyState title="Start a preparation plan" description="Open an opportunity and turn its requirements into a checklist."
              action={<a className="button button-secondary" href={href('/discover')}>Explore opportunities</a>} />}
          </div>
        </section>

        <section aria-labelledby="path-saved-heading">
          <div className="path-section-heading"><h2 id="path-saved-heading">Saved opportunities</h2><a href={href('/discover')}>Discover <ArrowRight size={15} aria-hidden="true" /></a></div>
          {saved.length ? <ul className="panel path-saved-list">{saved.map(item => <li key={item.id}>
            <a href={href('/opportunity/' + item.id)}>
              <span className="path-icon"><Bookmark size={17} aria-hidden="true" /></span>
              <span className="path-saved-copy"><strong>{item.title}</strong><span>{item.organization} · {item.category}</span></span>
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </li>)}</ul> : <EmptyState icon={<Bookmark size={22} aria-hidden="true" />} title="Nothing saved yet" description="Save an opportunity to find it again here."
            action={<a className="button button-secondary" href={href('/discover')}>Explore opportunities</a>} />}
        </section>
      </div>

      <aside className="path-stack" aria-label="Milestones and reminders">
        <section className="panel path-side-panel">
          <div className="path-side-heading"><Clock3 size={17} aria-hidden="true" /><h2>Milestones</h2></div>
          <ProgressTimeline items={milestones} />
        </section>
        {demo && <section className="panel path-side-panel path-reminder">
          <div className="path-side-heading"><BellRing size={17} aria-hidden="true" /><h2>Deadline reminder</h2></div>
          <p>{calendar ? 'Demo Calendar reminder recorded for' : 'The Orbit Labs application deadline moved to'} <strong><time dateTime={deadlineChange.newDate}>{formatDate(deadlineChange.newDate, 'long')}</time></strong>.</p>
          <button type="button" className="button button-secondary" onClick={openReview}>{calendar ? 'View Calendar result' : 'Review deadline change'} <ArrowRight size={15} aria-hidden="true" /></button>
        </section>}
        <section className="panel path-side-panel">
          <div className="path-side-heading"><CalendarClock size={17} aria-hidden="true" /><h2>Google Calendar</h2><span className="path-status" data-status="pending">Planned</span></div>
          <p className="muted">Calendar changes use a demo reminder in this browser.</p>
          <a className="path-text-link" href={href('/settings')}>Integration settings <ArrowRight size={15} aria-hidden="true" /></a>
        </section>
      </aside>
    </div>
  </div>
}

type ActivityStatus = 'Pending' | 'Running' | 'Needs review' | 'Completed' | 'Failed'

const activityLabels: Record<ActivityStatus, string> = { Pending: 'pending', Running: 'running', 'Needs review': 'review', Completed: 'completed', Failed: 'failed' }

interface AgentActivityPanelProps { change: DeadlineChange; resolution: CalendarResolution | null; onReview: () => void; compact?: boolean }

export function AgentActivityPanel({ change, resolution, onReview, compact }: AgentActivityPanelProps) {
  const recorded = resolution?.changeId === change.id ? resolution : null
  const events: { id: string; title: string; description: string; status: ActivityStatus; icon: typeof Check; date?: string }[] = [
    { id: 'source', title: 'Source received', description: 'Sample careers listing loaded into the demo.', status: 'Completed', icon: FileSearch },
    { id: 'requirements', title: 'Requirements extracted', description: 'Sample application materials, eligibility criteria, and cutoff are available.', status: 'Completed', icon: ScanLine },
    { id: 'eligibility', title: 'Eligibility checked', description: 'The sample match explains the qualifying criteria and gaps.', status: 'Completed', icon: CheckCheck },
    { id: 'plan', title: 'Action plan generated', description: 'A four-task preparation checklist is included in the demo.', status: 'Completed', icon: ListChecks },
    { id: 'change', title: 'Deadline change detected', description: `The sample listing moved the cutoff from ${formatDate(change.oldDate)} to ${formatDate(change.newDate)}.`, status: 'Completed', icon: GitCompareArrows, date: change.detectedAt },
    { id: 'approval', title: 'User approval requested', description: recorded ? 'The proposed demo Calendar change was reviewed.' : 'Review the source excerpt and the proposed reminder date.', status: recorded ? 'Completed' : 'Needs review', icon: BellRing },
    { id: 'result', title: 'External action confirmation', description: recorded ? `Simulated Calendar update recorded for ${formatDate(recorded.date, 'long')}.` : 'Awaiting approval of the simulated Calendar update.', status: recorded ? 'Completed' : 'Pending', icon: CalendarClock, date: recorded?.confirmedAt },
  ]

  return <div className={`panel agent-panel${compact ? ' agent-panel-compact' : ''}`}>
    <div className="agent-panel-heading"><div><h2>{compact ? 'Agent activity' : 'Activity timeline'}</h2><p>Sample workflow · UTC</p></div><span className="path-status" data-status={recorded ? 'completed' : 'review'}>{recorded ? 'Review complete' : 'Review requested'}</span></div>
    <ol className="agent-events">
      {(compact ? events.slice(-3) : events).map(({ id, title, description, status, icon: Icon, date }) => <li key={id}>
        <span className="agent-event-icon" data-status={activityLabels[status]}><Icon size={17} aria-hidden="true" /></span>
        <div className="agent-event-copy">
          <div className="agent-event-heading"><h3>{title}</h3><span className="path-status" data-status={activityLabels[status]}>{status}</span></div>
          <p>{description}</p>
          {date && <time dateTime={date}>{formatDate(date, 'long')} UTC</time>}
          {id === 'approval' && <button type="button" className="button button-secondary" onClick={onReview}>{recorded ? 'View Calendar result' : 'Review deadline change'} <ArrowRight size={15} aria-hidden="true" /></button>}
        </div>
      </li>)}
    </ol>
  </div>
}

export function AgentPage() {
  const { state, openReview } = useWorkspace()
  return <div className="path-page">
    <div className="path-page-heading">
      <div><p className="eyebrow"><Radar size={14} aria-hidden="true" /> Workspace activity</p><h1>Agent activity</h1><p>Follow the source, the decision, and the recorded outcome.</p></div>
    </div>
    <div className="path-columns">
      <AgentActivityPanel change={deadlineChange} resolution={state.resolution} onReview={openReview} />
      <aside className="path-stack" aria-label="Activity context">
        <section className="panel path-side-panel">
          <div className="path-side-heading"><FileSearch size={17} aria-hidden="true" /><h2>Source record</h2></div>
          <p>{deadlineChange.sourceName}</p>
          <a className="path-text-link" href={href('/source/' + deadlineChange.opportunityId)}>View fictional listing <ArrowRight size={15} aria-hidden="true" /></a>
        </section>
        <section className="panel path-side-panel">
          <div className="path-side-heading"><CircleAlert size={17} aria-hidden="true" /><h2>Demo workflow</h2></div>
          <p className="muted">The early stages describe a fictional run. Your confirmation records a simulated Calendar update in this browser.</p>
        </section>
      </aside>
    </div>
  </div>
}
