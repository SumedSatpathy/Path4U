import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Download, Sparkles, ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, ExternalLink, Network, Plus, Route } from 'lucide-react'
import { courses, demoCosts, roadmapProgress, type Course, type LearningAction, type Milestone, type MindNode, type Roadmap, type RoadmapInput, type SavedRoadmap } from '../shared/learning.mjs'
import { apiPost, failureMessage, useIntegrationStatus } from './api'
import { useDemo } from './demo'
import { downloadBlob } from './documents'
import { href, navigate, useUnsavedChanges } from './routes'
import { useAccount } from './session'
import { EmptyState, SearchBox } from './ui'
import { useWorkspace } from './workspace'
import { CourseCards, SearchSuggestions } from './CourseCards'
import './learning.css'

export function useLearning() {
  const demo = useDemo()
  return {
    demo,
    run: <T,>(action: LearningAction, payload: object) => demo ? demo.run<T>(action, payload) : apiPost<T>('learning/' + action, payload),
  }
}

export function creditLabel(action: LearningAction) {
  const count = demoCosts[action]
  return count + (count === 1 ? ' demo credit' : ' demo credits')
}

function CourseLink({ course }: { course: Course }) {
  return <a href={course.url} className="text-link" target="_blank" rel="noreferrer">{course.title} <ExternalLink size={15} /></a>
}

export function CoursesPage() {
  const [query, setQuery] = useState('')
  const results = courses.filter(course => [course.title, course.provider, course.topic].some(text => text.toLowerCase().includes(query.trim().toLowerCase())))
  return <div className="learning-page">
    <header><p className="eyebrow">Learning resources</p><h1>Course Finder</h1><p>Browse a curated set of resources from their original providers.</p></header>
    <SearchBox value={query} onChange={setQuery} placeholder="Search by topic or provider" />
    <CourseCards resources={results} />
    {!results.length && <EmptyState title="No matching resources" description="Try a provider name or a broader topic." action={<button className="button button-secondary" onClick={() => setQuery('')}>Clear search</button>} />}
  </div>
}

export function RoadmapPage({ proposedGoal, initialPlan, initialHours, initialWeeks, initialLevel, flowchart = false }: { proposedGoal: string; initialPlan?: string; initialHours?: string; initialWeeks?: string; initialLevel?: string; flowchart?: boolean }) {
  const { state, saveRoadmap } = useWorkspace()
  const { session } = useAccount()
  const preferences = session?.user?.preferences
  const { demo, run } = useLearning()
  const service = useIntegrationStatus()
  const saved = state.roadmaps ?? []
  const [selected, setSelected] = useState(saved.find(item => item.id === initialPlan)?.id ?? (proposedGoal ? '' : saved[0]?.id ?? ''))
  const [inputs, setInputs] = useState<RoadmapInput>({
    goal: proposedGoal || '', level: ['Beginner','Intermediate','Advanced'].includes(initialLevel ?? '') ? initialLevel! : ['Intermediate', 'Advanced'].includes(preferences?.level ?? '') ? preferences!.level! : 'Beginner',
    hours: Number(initialHours) >= 1 && Number(initialHours) <= 40 ? Number(initialHours) : preferences?.weeklyHours === '1–3 hours' ? 2 : preferences?.weeklyHours === '7–10 hours' ? 8 : preferences?.weeklyHours === '10+ hours' ? 10 : 5,
    durationWeeks: Number(initialWeeks) >= 2 && Number(initialWeeks) <= 104 ? Number(initialWeeks) : 12, preferences: '',
    skills: preferences?.skills.slice(0, 10).join(', ').slice(0, 300) ?? '', budget: preferences?.budget ?? 'Free courses only',
  })
  const inputBaseline = useRef(JSON.stringify(inputs))
  const [draft, setDraft] = useState<SavedRoadmap | null>(null)
  const [useGemini, setUseGemini] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [scale, setScale] = useState(100)
  const [editing, setEditing] = useState(false)
  const shown = draft ?? saved.find(item => item.id === selected)
  const markNavigationSaved = useUnsavedChanges(Boolean(draft && JSON.stringify(draft) !== JSON.stringify(saved.find(item => item.id === draft.id))) || JSON.stringify(inputs) !== inputBaseline.current)
  const progress = roadmapProgress(shown)
  const update = (index: number, milestone: Milestone) => {
    if (shown) setDraft({ ...shown, milestones: shown.milestones.map((item, i) => i === index ? milestone : item) })
  }

  useEffect(() => {
    if (proposedGoal) setInputs(current => ({ ...current, goal: proposedGoal,
      ...(Number(initialHours) >= 1 && Number(initialHours) <= 40 ? {hours:Number(initialHours)} : {}),
      ...(Number(initialWeeks) >= 2 && Number(initialWeeks) <= 104 ? {durationWeeks:Number(initialWeeks)} : {}),
      ...(['Beginner','Intermediate','Advanced'].includes(initialLevel ?? '') ? {level:initialLevel!} : {}),
    }))
  }, [proposedGoal, initialHours, initialWeeks, initialLevel])
  useEffect(() => { if (initialPlan) { setSelected(initialPlan); setDraft(null) } }, [initialPlan])

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    if (draft) { setError('Save or discard your current draft before generating another.'); return }
    if (!inputs.goal.trim() || !Number.isInteger(inputs.durationWeeks) || inputs.durationWeeks! < 2 || inputs.durationWeeks! > 104 || !Number.isInteger(inputs.hours) || inputs.hours < 1 || inputs.hours > 40) {
      setError('Enter a target role or skill and choose 1 to 40 hours per week and 2 to 104 weeks.')
      return
    }
    setPending(true)
    setError('')
    try {
      const result = await run<Roadmap>('roadmap', { ...inputs, useGemini: !demo && useGemini })
      setDraft({ ...result, id: crypto.randomUUID() })
      setEditing(false)
    } catch (failure) { setError(failureMessage(failure)) }
    finally { setPending(false) }
  }

  async function exportPlan() {
    if (!shown || exporting) return
    setExporting(true)
    setError('')
    try {
      const { documentBlob } = await import('./documentExport')
      const content = '**Level:** ' + shown.level + ' · **Weekly hours:** ' + shown.hours + '\n\n' + shown.milestones.map((item, index) => {
        const course = courses.find(entry => entry.id === item.resource)
        return ['## ' + (index + 1) + '. ' + item.title, item.done ? 'Complete' : 'In progress', item.task, item.hours + ' estimated hours', index ? 'Prerequisite: ' + shown.milestones[index - 1].title : (shown.skills ? 'Starting skills: ' + shown.skills : ''), course ? '[' + course.title + '](' + course.url + ')' : ''].filter(Boolean).join('\n')
      }).join('\n\n')
      downloadBlob(await documentBlob({ title: shown.goal, content, template: 'Modern Technical' }, 'pdf'), 'Path4U_Roadmap.pdf')
    } catch (failure) { setError(failureMessage(failure)) } finally { setExporting(false) }
  }

  function move(index: number, offset: number) {
    if (!shown) return
    const milestones = [...shown.milestones]
    const [item] = milestones.splice(index, 1)
    milestones.splice(index + offset, 0, item)
    setDraft({ ...shown, milestones })
  }

  return <div className="learning-page">
    <header><p className="eyebrow">{flowchart ? 'Milestone sequence' : 'Career planning'}</p><h1>{flowchart ? 'Roadmap Flowchart' : 'My Roadmap'}</h1><p>{flowchart ? 'Follow the sequence, open milestone details, and reorder your plan.' : 'Your goals. A clear path forward.'}</p></header>
    <div className="learning-layout">
      <div className="learning-side">
        <form className="panel learning-card" noValidate onSubmit={generate}>
          <h2>Build a roadmap</h2>
          <label className="field">Target role or skill<input required maxLength={100} placeholder="e.g. AI Engineer" value={inputs.goal} onChange={event => setInputs({ ...inputs, goal: event.target.value })} /></label>
          <div className="learning-fields">
            <label className="field">Skill level<select value={inputs.level} onChange={event => setInputs({ ...inputs, level: event.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
            <label className="field">Hours per week<input type="number" min="1" max="40" required value={Number.isFinite(inputs.hours) ? inputs.hours : ''} onChange={event => setInputs({ ...inputs, hours: event.target.valueAsNumber })} /></label>
          </div>
          <div className="learning-fields"><label className="field">Duration (weeks)<input type="number" min="2" max="104" required value={Number.isFinite(inputs.durationWeeks) ? inputs.durationWeeks : ''} onChange={event => setInputs({ ...inputs, durationWeeks: event.target.valueAsNumber })} /></label></div>
          <label className="field">Learning preferences<input maxLength={300} value={inputs.preferences ?? ''} onChange={event => setInputs({ ...inputs, preferences: event.target.value })} placeholder="Hands-on projects, video, reading…" /></label>
          <label className="field">Existing skills <small className="muted">Optional</small><input maxLength={300} value={inputs.skills} onChange={event => setInputs({ ...inputs, skills: event.target.value })} placeholder="Python, SQL" /></label>
          <label className="field">Course budget<input maxLength={70} value={inputs.budget} onChange={event => setInputs({ ...inputs, budget: event.target.value })} /></label>
          {demo ? <p className="muted">{demo.liveAI?'Live Gemini generation · 1 shared AI interaction':'Simulated generation'}{!demo.liveAI && demo.credits !== null ? ' · ' + creditLabel('roadmap') : ''}</p> : service.gemini ? <label className="learning-check"><input type="checkbox" checked={useGemini} onChange={event => setUseGemini(event.target.checked)} /> Share these inputs with Gemini</label> : <p className="muted">Guided template · Personalized AI and live research are unavailable.</p>}
          {demo?.error && <p role="alert">{demo.error} <button className="button button-ghost button-small" type="button" onClick={demo.retry}>Retry</button></p>}
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="button button-primary" disabled={pending || Boolean(draft) || Boolean(demo && !demo.ready)}>{pending ? 'Building…' : 'Generate roadmap'} <ArrowRight size={17} /></button>
        </form>
        {saved.length > 0 && <div className="panel learning-card"><h2>Saved roadmaps</h2><label className="field">Choose a roadmap<select value={selected} disabled={Boolean(draft)} onChange={event => { setSelected(event.target.value); setDraft(null); setEditing(false) }}>
          <option value="">Choose</option>{saved.map(item => <option key={item.id} value={item.id}>{item.goal}</option>)}
        </select></label></div>}
      </div>
      {shown ? <section className="panel learning-card">
        <div className="learning-heading"><div><p className="eyebrow">{shown.source === 'gemini' ? 'Generated with Gemini' : 'Guided roadmap'} · {shown.level}</p><h2>{shown.goal}</h2></div><Route size={24} /></div>
        <p className="muted">{progress.complete} of {progress.total} {progress.unit} complete · {shown.hours} hours per week</p>
        {shown.overview && <p>{shown.overview}</p>}
        {shown.prerequisites?.length ? <div><h3>Before you start</h3><ul>{shown.prerequisites.map(item => <li key={item}>{item}</li>)}</ul></div> : null}
        <progress className="roadmap-progress" aria-label="Roadmap completion" value={progress.complete} max={progress.total} />
        <div className="learning-toolbar">
          <button type="button" className="button button-secondary button-small" onClick={() => setEditing(value => !value)} aria-pressed={editing}>{editing ? 'Finish editing' : 'Edit milestones'}</button>
          {!draft && <a className="text-link" href={href(flowchart ? '/roadmap' : '/flowchart', new URLSearchParams({ plan: shown.id }))}>{flowchart ? 'Roadmap view' : 'Flowchart view'} <ArrowRight size={15} /></a>}
          <button type="button" className="button button-secondary button-small" disabled={exporting} onClick={() => void exportPlan()}><Download size={15} /> {exporting ? 'Preparing PDF…' : 'Export PDF'}</button>
          {flowchart && <label className="learning-scale">Scale <input type="range" min="75" max="125" value={scale} onChange={event => setScale(Number(event.target.value))} /> {scale}%</label>}
        </div>
        <ol className={'learning-sequence' + (flowchart ? ' is-flowchart' : ' is-roadmap')} style={flowchart ? { fontSize: scale + '%' } : undefined}>
          {shown.milestones.map((item, index) => {
            const resource = courses.find(course => course.id === item.resource)
            return <li key={index}>
              {!flowchart && <div className="road-segment" aria-hidden="true"><svg viewBox="0 0 60 100" preserveAspectRatio="none"><path className="road-edge" d="M16 0 C16 24 44 30 44 58 S16 78 16 100"/><path className="road-center" d="M16 0 C16 24 44 30 44 58 S16 78 16 100"/></svg><span data-done={item.done}>{item.done ? <Check size={12} /> : index + 1}</span></div>}
              <details open={editing ? true : undefined}>
              <summary><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong>{item.done && <Check size={17} aria-label="Complete" />}<ChevronDown size={15} /></summary>
              <div className="learning-node">
                {editing ? <>
                  <label className="field">Milestone name<input maxLength={120} value={item.title} onChange={event => update(index, { ...item, title: event.target.value })} /></label>
                  <label className="field">Next activity<textarea className="resize-none" maxLength={400} rows={2} value={item.task} onChange={event => update(index, { ...item, task: event.target.value })} /></label>
                  <div className="learning-toolbar">
                    <button className="icon-button" aria-label={'Move milestone ' + (index + 1) + ' up'} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
                    <button className="icon-button" aria-label={'Move milestone ' + (index + 1) + ' down'} disabled={index === shown.milestones.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
                  </div>
                </> : <p>{item.task}</p>}
                <p className="muted">{item.startWeek ? 'Weeks ' + item.startWeek + '–' + item.endWeek + ' · ' : ''}{item.hours} estimated hours</p>
                {item.skills?.length ? <p><strong>Skills</strong> · {item.skills.join(', ')}</p> : null}
                {item.lessons?.length ? <fieldset className="roadmap-lessons"><legend>Learning checklist</legend>{item.lessons.map(lesson => <label className="learning-check" key={lesson.id}><input type="checkbox" checked={lesson.done} onChange={event => { const lessons = item.lessons!.map(entry => entry.id === lesson.id ? { ...entry, done: event.target.checked } : entry); update(index, { ...item, lessons, done: lessons.every(entry => entry.done) }) }} />{lesson.title}</label>)}</fieldset> : null}
                {item.assignments?.length ? <div><strong>Practice assignments</strong><ul>{item.assignments.map(task => <li key={task}>{task}</li>)}</ul></div> : null}
                {item.project && <p><strong>Build</strong> · {item.project}</p>}{item.completionCriteria?.length ? <section><strong>Complete this phase when you can</strong><ul>{item.completionCriteria.map(criterion=><li key={criterion}>{criterion}</li>)}</ul></section> : null}
                {item.resourceIds?.length ? <div><h3>Recommended for this phase</h3><CourseCards resources={(shown.resources ?? courses).filter(course => item.resourceIds!.includes(course.id))} /></div> : null}
                {index > 0 ? <p><strong>Prerequisite</strong> · {shown.milestones[index - 1].title}</p> : shown.skills && <p><strong>Starting skills</strong> · {shown.skills}</p>}
                {!editing && <button type="button" className="button button-ghost button-small" onClick={() => window.dispatchEvent(new CustomEvent('path4u:ask', { detail: 'Help me with the ' + item.title + ' milestone on my roadmap for ' + shown.goal + '.' }))}><Sparkles size={15} /> Ask Path4U AI</button>}
                {resource && !item.resourceIds?.length && <CourseLink course={resource} />}
                <label className="learning-check"><input type="checkbox" checked={item.done} onChange={event => update(index, { ...item, done: event.target.checked, ...(item.lessons ? {lessons: item.lessons.map(lesson => ({...lesson,done:event.target.checked}))} : {}) })} /> Mark complete</label>
              </div>
            </details></li>
          })}
        </ol>
        {([ ['Portfolio evidence', shown.portfolio], ['Certification options to investigate', shown.certifications], ['Next steps', shown.nextSteps] ] as const).map(([title,items]) => items?.length ? <section key={title}><h3>{title}</h3><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></section> : null)}
        {shown.researchNote && <p className="field-help">{shown.researchNote}</p>}
        {shown.research?.sources?.length ? <details><summary>Research sources</summary><ul>{shown.research.sources.map(source => <li key={source.url}><a className="text-link" href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul></details> : null}
        <SearchSuggestions html={shown.research?.suggestions} />
        {shown.platformSearches?.length ? <details><summary>Explore more courses · platform search links</summary><ul>{shown.platformSearches.map(item => <li key={item.url}><a className="text-link" href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></li>)}</ul><p className="field-help">Search links are not verified course recommendations.</p></details> : null}
        {editing && shown.milestones.length < 10 && <button type="button" className="button button-secondary" onClick={() => setDraft({ ...shown, milestones: [...shown.milestones, { title: 'New milestone', task: '', hours: shown.hours, resource: '', done: false }] })}><Plus size={16} /> Add milestone</button>}
        <div className="learning-toolbar">
          {draft && <button className="button button-primary" disabled={(!saved.some(item => item.id === shown.id) && saved.length >= 10) || shown.milestones.some(item => !item.title.trim() || !item.task.trim())} onClick={() => {
            if (saveRoadmap(shown)) { markNavigationSaved(); inputBaseline.current = JSON.stringify(inputs); setSelected(shown.id); setDraft(null); navigate(flowchart ? '/flowchart' : '/roadmap', new URLSearchParams({plan:shown.id})) }
          }}>Save roadmap</button>}
          {draft && <button className="button button-ghost" onClick={() => { setDraft(null); setEditing(false) }}>Discard edits</button>}
          {!draft && <p className="muted">Saved to your workspace.</p>}
        </div>
      </section> : <EmptyState icon={<Route size={25} />} title="Start with a goal" description="Generate a plan to see suggested milestones, learning resources, and the next activity." />}
    </div>
  </div>
}

export function MindMapPage({ initialTopic = '' }: { initialTopic?: string }) {
  const { state, saveMindMap } = useWorkspace()
  const { demo, run } = useLearning()
  const [topic, setTopic] = useState(initialTopic)
  const topicBaseline = useRef(initialTopic)
  const [draft, setDraft] = useState<MindNode[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useUnsavedChanges(Boolean(draft) || topic !== topicBaseline.current)
  const nodes = draft ?? state.mindMap ?? []
  const root = nodes.find(node => node.parent === null)

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (busy || draft) return
    if (!topic.trim()) { setError('Enter a topic to start your mind map.'); return }
    setError('')
    setBusy(true)
    try {
      const result = await run<{ nodes: string[] }>('mindMap', { topic })
      const id = crypto.randomUUID()
      setDraft(result.nodes.map((label, index) => ({ label, id: index ? crypto.randomUUID() : id, parent: index ? id : null })))
    } catch (failure) { setError(failureMessage(failure)) }
    finally { setBusy(false) }
  }

  function branch(node: MindNode, depth = 0): React.ReactNode {
    return <li key={node.id}>
      <div className="mind-node">
        <label className="field">{node.parent ? 'Branch' : 'Main topic'}<input maxLength={100} value={node.label} onChange={event => setDraft(nodes.map(item => item.id === node.id ? { ...item, label: event.target.value } : item))} /></label>
        {nodes.length < 40 && depth < 4 && <button className="icon-button" aria-label={'Add a branch to ' + node.label} onClick={() => setDraft([...nodes, { id: crypto.randomUUID(), label: 'New branch', parent: node.id }])}><Plus size={18} /></button>}
      </div>
      {nodes.some(item => item.parent === node.id) && <details open><summary>Branches</summary><ul>{nodes.filter(item => item.parent === node.id).map(item => branch(item, depth + 1))}</ul></details>}
    </li>
  }

  return <div className="learning-page">
    <header><p className="eyebrow">Visual planning</p><h1>Mind Maps</h1><p>Break a topic into branches and edit the connections as you learn.</p></header>
    <div className="learning-layout">
      <form className="panel learning-card" noValidate onSubmit={generate}><h2>Start a new map</h2>
        <label className="field">Topic<input required maxLength={100} value={topic} onChange={event => setTopic(event.target.value)} placeholder="e.g. React development" /></label>
        <p className="muted">{demo?.liveAI ? 'Live Gemini branches · 1 shared AI interaction' : 'Guided branch suggestions'}{demo && !demo.liveAI && demo.credits !== null ? ' · ' + creditLabel('mindMap') : ''}</p>
        {root && <p className="muted">Saving a new map replaces the current map.</p>}
        {(error || demo?.error) && <p className="field-error" role="alert">{error || demo?.error}</p>}
        <button className="button button-primary" disabled={busy || Boolean(draft) || Boolean(demo && !demo.ready)}>{busy ? 'Generating…' : 'Generate mind map'} <Network size={17} /></button>
      </form>
      {root ? <section className="panel learning-card"><h2>My mind map</h2><ul className="mind-tree">{branch(root)}</ul>
        <div className="learning-toolbar">{draft ? <><button className="button button-primary" disabled={nodes.some(item => !item.label.trim())} onClick={() => { if (saveMindMap(nodes)) { topicBaseline.current = topic; setDraft(null) } }}>Save mind map</button><button className="button button-ghost" onClick={() => setDraft(null)}>Discard edits</button></> : <p className="muted">Saved to your workspace.</p>}</div>
      </section> : <EmptyState icon={<Network size={25} />} title="No mind map yet" description="Choose a topic to create a map and add your own branches." />}
    </div>
  </div>
}
