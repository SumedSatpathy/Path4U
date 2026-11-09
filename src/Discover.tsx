import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Clock3, CodeXml, FileCheck2, FileText, GraduationCap, Layers3, ListChecks, MapPin, Presentation, Rocket, SearchX, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { audiences, categories, deadlineChange, disciplines, formatDate, opportunities, workFormats, type Audience, type Category, type Discipline, type Opportunity, type WorkFormat } from './data'
import { useIntegrationStatus } from './api'
import { href, navigate } from './routes'
import { Dialog, EmptyState, ErrorState, SearchBox } from './ui'
import { useWorkspace } from './workspace'
import './discover.css'

const categoryTabs = [
  { value: 'All', label: 'All opportunities', icon: Layers3 },
  { value: 'Internship', label: 'Internships', icon: BriefcaseBusiness },
  { value: 'Hackathon', label: 'Hackathons', icon: CodeXml },
  { value: 'Workshop', label: 'Workshops', icon: Presentation },
  { value: 'Fellowship', label: 'Fellowships', icon: GraduationCap },
  { value: 'Career program', label: 'Career programs', icon: Rocket },
] as const

type CategoryTab = Category | 'All'
type Sort = 'recommended' | 'deadline' | 'latest'
type Duration = '4-6' | 'short'

interface Filters {
  locations: string[]
  disciplines: Discipline[]
  format: WorkFormat | ''
  audience: Audience | ''
  duration: Duration | ''
  saved: boolean
}

const locations = [...new Set(opportunities.map(item => item.location))].sort()
const emptyFilters: Filters = { locations: [], disciplines: [], format: '', audience: '', duration: '', saved: false }
const pageSize = 6

function choice<T extends string>(value: string | null, values: readonly T[]): T | undefined {
  return values.find(item => item === value)
}

function readFilters(params: URLSearchParams): Filters {
  return {
    locations: locations.filter(item => params.getAll('location').includes(item)),
    disciplines: disciplines.filter(item => params.getAll('discipline').includes(item)),
    format: choice(params.get('format'), workFormats) ?? '',
    audience: choice(params.get('audience'), audiences) ?? '',
    duration: choice(params.get('duration'), ['4-6', 'short']) ?? '',
    saved: params.get('saved') === '1',
  }
}

function writeFilters(params: URLSearchParams, filters: Filters) {
  for (const key of ['location', 'discipline', 'format', 'audience', 'duration', 'saved']) params.delete(key)
  filters.locations.forEach(value => params.append('location', value))
  filters.disciplines.forEach(value => params.append('discipline', value))
  if (filters.format) params.set('format', filters.format)
  if (filters.audience) params.set('audience', filters.audience)
  if (filters.duration) params.set('duration', filters.duration)
  if (filters.saved) params.set('saved', '1')
  params.delete('page')
}

function toggleChoice<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

function getResults(category: CategoryTab, query: string, filters: Filters, sort: Sort, saved: string[]) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return opportunities.filter(item => {
    if (category !== 'All' && item.category !== category) return false
    if (filters.locations.length && !filters.locations.includes(item.location)) return false
    if (filters.disciplines.length && !filters.disciplines.includes(item.discipline)) return false
    if (filters.format && item.format !== filters.format) return false
    if (filters.audience && item.audience !== filters.audience) return false
    if (filters.duration === '4-6' && (item.durationMonths < 4 || item.durationMonths > 6)) return false
    if (filters.duration === 'short' && item.durationMonths !== 0) return false
    if (filters.saved && !saved.includes(item.id)) return false
    const text = [item.title, item.organization, item.category, item.discipline, item.location, item.format, item.summary, ...item.skills].join(' ').toLowerCase()
    return words.every(word => text.includes(word))
  }).sort((left, right) => {
    if (sort === 'deadline') return left.deadline.localeCompare(right.deadline)
    if (sort === 'latest') return right.published.localeCompare(left.published)
    return right.match.score - left.match.score
  })
}

function durationLabel(duration: number) {
  return duration ? `${duration} ${duration === 1 ? 'month' : 'months'}` : 'Short event'
}

export function DeadlineBadge({ date, style = 'short' }: { date: string; style?: 'short' | 'long' }) {
  return <span className="opportunity-deadline"><CalendarDays size={15} aria-hidden="true" /><span>Due <time dateTime={date}>{formatDate(date, style)}</time></span></span>
}

export function SourceVerificationBadge() {
  return <span className="opportunity-source-badge"><FileCheck2 size={14} aria-hidden="true" />Sample source</span>
}

function OrganizationMark({ opportunity }: { opportunity: Opportunity }) {
  return <span className={`opportunity-mark opportunity-mark-${opportunity.color}`} aria-hidden="true">{opportunity.initials}</span>
}

export function OpportunityCard({ opportunity, saved, onToggleSave, compact, returnTo, order = 0 }: {
  opportunity: Opportunity
  saved: boolean
  onToggleSave: () => void
  compact?: boolean
  returnTo?: URLSearchParams
  order?: number
}) {
  const reducedMotion = useReducedMotion()
  const detailParams = returnTo?.size ? new URLSearchParams({ from: returnTo.toString() }) : undefined
  const detailLink = href('/opportunity/' + opportunity.id, detailParams)

  return <motion.article className={`panel opportunity-card${compact ? ' opportunity-card-compact' : ''}`}
    initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: .18, delay: Math.min(order, 5) * .035 }}>
    <div className="opportunity-card-top">
      <OrganizationMark opportunity={opportunity} />
      <span className="opportunity-category">{opportunity.category}</span>
      <button type="button" className="icon-button opportunity-save" aria-pressed={saved}
        aria-label={`Save ${opportunity.title}`} title={saved ? 'Remove from saved' : 'Save opportunity'} onClick={onToggleSave}>
        <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    </div>
    <div className="opportunity-card-copy">
      <p className="opportunity-organization">{opportunity.organization}</p>
      <h3><a href={detailLink}>{opportunity.title}<ArrowUpRight size={16} aria-hidden="true" /></a></h3>
      <p className="opportunity-card-meta"><MapPin size={14} aria-hidden="true" />{opportunity.location}{opportunity.location !== opportunity.format && ` · ${opportunity.format}`}<span aria-hidden="true">·</span>{durationLabel(opportunity.durationMonths)}</p>
      {!compact && <p className="opportunity-summary">{opportunity.summary}</p>}
    </div>
    {!compact && <div className="opportunity-tags"><span>{opportunity.discipline}</span>{opportunity.skills.slice(0, 2).filter(skill => skill !== opportunity.discipline).map(skill => <span key={skill}>{skill}</span>)}</div>}
    <div className="opportunity-card-foot">
      <DeadlineBadge date={opportunity.deadline} />
      <span className="opportunity-match-pill"><Sparkles size={13} aria-hidden="true" />{opportunity.match.score}% sample match</span>
    </div>
  </motion.article>
}

export function CategoryTabs({ active, onChange, panelId }: { active: CategoryTab; onChange: (category: CategoryTab) => void; panelId: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const reduceMotion = useReducedMotion()

  function handleKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = categoryTabs.length - 1
    let next: number
    switch (event.key) {
      case 'ArrowLeft': next = index === 0 ? last : index - 1; break
      case 'ArrowRight': next = index === last ? 0 : index + 1; break
      case 'Home': next = 0; break
      case 'End': next = last; break
      default: return
    }
    event.preventDefault()
    refs.current[next]?.focus()
    onChange(categoryTabs[next].value)
  }

  return <div className="discover-tabs" role="tablist" aria-label="Opportunity categories">
    {categoryTabs.map(({ value, label, icon: Icon }, index) => <button key={value} type="button" role="tab"
      ref={element => { refs.current[index] = element }} id={`${panelId}-tab-${index}`} aria-controls={panelId}
      aria-selected={active === value} tabIndex={active === value ? 0 : -1} onClick={() => onChange(value)}
      onKeyDown={event => handleKeys(event, index)}>
      {active === value && <motion.span className="discover-tab-indicator" layoutId={reduceMotion ? undefined : panelId + '-indicator'} transition={{ duration: .2 }} />}
      <Icon size={15} aria-hidden="true" /><span>{label}</span>
    </button>)}
  </div>
}

export function FilterPanel({ open, onClose, value, onChange, onApply }: {
  open: boolean
  onClose: () => void
  value: Filters
  onChange: (filters: Filters) => void
  onApply: (filters: Filters) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onApply(value)
  }

  return <Dialog open={open} onClose={onClose} title="Filter opportunities" description="Choose the locations, fields, and time commitments that fit." className="discover-filter-dialog">
    <form className="discover-filter-form" noValidate onSubmit={submit}>
      <fieldset className="discover-filter-group">
        <legend>Location</legend>
        <div className="discover-filter-options">{locations.map(location => <label key={location}>
          <input type="checkbox" checked={value.locations.includes(location)} onChange={() => onChange({ ...value, locations: toggleChoice(value.locations, location) })} />{location}
        </label>)}</div>
      </fieldset>
      <fieldset className="discover-filter-group">
        <legend>Discipline</legend>
        <div className="discover-filter-options">{disciplines.map(discipline => <label key={discipline}>
          <input type="checkbox" checked={value.disciplines.includes(discipline)} onChange={() => onChange({ ...value, disciplines: toggleChoice(value.disciplines, discipline) })} />{discipline}
        </label>)}</div>
      </fieldset>
      <label className="discover-filter-select">Duration
        <select className="field" value={value.duration} onChange={event => onChange({ ...value, duration: choice(event.target.value, ['4-6', 'short']) ?? '' })}>
          <option value="">Any duration</option><option value="4-6">4–6 months</option><option value="short">Short event</option>
        </select>
      </label>
      <label className="discover-filter-select">Work format
        <select className="field" value={value.format} onChange={event => onChange({ ...value, format: choice(event.target.value, workFormats) ?? '' })}>
          <option value="">Any format</option>{workFormats.map(format => <option key={format}>{format}</option>)}
        </select>
      </label>
      <label className="discover-filter-select">Audience
        <select className="field" value={value.audience} onChange={event => onChange({ ...value, audience: choice(event.target.value, audiences) ?? '' })}>
          <option value="">Any audience</option>{audiences.map(audience => <option key={audience}>{audience}</option>)}
        </select>
      </label>
      <label className="discover-filter-check"><input type="checkbox" checked={value.saved} onChange={event => onChange({ ...value, saved: event.target.checked })} />Saved opportunities only</label>
      <div className="discover-filter-actions">
        <button className="button button-ghost" type="button" onClick={() => onChange(emptyFilters)}>Clear filters</button>
        <button className="button button-primary" type="submit">Apply filters <ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </form>
  </Dialog>
}

interface ApprovedListing {
  id: string
  title: string
  organization: string
  location: string
  sourceUrl: string
}

type FeedState = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; listings: ApprovedListing[] }

function isApprovedListing(value: unknown): value is ApprovedListing {
  if (!value || typeof value !== 'object') return false
  const listing = value as Partial<ApprovedListing>
  return typeof listing.id === 'string' && typeof listing.title === 'string' && typeof listing.organization === 'string'
    && typeof listing.location === 'string' && typeof listing.sourceUrl === 'string'
    && /^https:\/\/(?:boards|job-boards)\.greenhouse\.io\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}\/jobs\/\d+$/.test(listing.sourceUrl)
}

function ApprovedFeed() {
  const { feed } = useIntegrationStatus()
  const [result, setResult] = useState<FeedState>({ status: 'idle' })
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function load() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setResult({ status: 'loading' })
    try {
      const response = await fetch('api/opportunities', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
      })
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Feed unavailable')
      const data: { opportunities?: unknown } = await response.json()
      if (!Array.isArray(data?.opportunities) || !data.opportunities.every(isApprovedListing)) throw new Error('Invalid feed response')
      if (!controller.signal.aborted) {
        setPage(1)
        setResult({ status: 'ready', listings: data.opportunities })
      }
    } catch {
      if (!controller.signal.aborted) setResult({ status: 'error' })
    } finally {
      request.current = null
    }
  }

  const term = query.trim().toLowerCase()
  const filtered = result.status === 'ready' ? result.listings.filter(item => [item.title, item.organization, item.location].join(' ').toLowerCase().includes(term)) : []
  const limit = 8
  const pages = Math.ceil(filtered.length / limit)

  return <section className="panel discover-approved-feed" aria-labelledby="approved-feed-heading">
    <header>
      <span className="discover-feed-icon"><FileCheck2 size={21} aria-hidden="true" /></span>
      <div><h2 id="approved-feed-heading">Approved employer feeds</h2><p>Published Greenhouse listings from explicitly approved boards.</p></div>
      {feed ? <button className="button button-secondary" type="button" onClick={load} disabled={result.status === 'loading'}>
        {result.status === 'ready' ? 'Refresh listings' : 'Load listings'}
      </button> : <span className="discover-feed-badge">Setup required</span>}
    </header>
    {result.status === 'loading' && <p className="discover-feed-status" role="status">Checking approved Greenhouse boards…</p>}
    {result.status === 'error' && <ErrorState title="Employer feeds couldn’t load" description="Check the connection or approved board configuration and try again." onRetry={load} />}
    {result.status === 'ready' && (result.listings.length ? <div className="discover-feed-results">
      <SearchBox value={query} onChange={value => { setQuery(value); setPage(1) }} label="Search approved listings" placeholder="Search approved listings by title, organizer, or location" />
      <p className="discover-feed-status" role="status">{filtered.length} {filtered.length === 1 ? 'listing' : 'listings'} from approved feeds</p>
      {filtered.length ? <ul className="discover-feed-list">{filtered.slice((page - 1) * limit, page * limit).map(item => <li key={item.id}>
        <div><strong>{item.title}</strong><p>{item.organization}{item.location && ` · ${item.location}`}</p></div>
        <a className="button button-secondary" href={item.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.title} on Greenhouse (opens in a new tab)`}>View listing <ArrowUpRight size={16} aria-hidden="true" /></a>
      </li>)}</ul> : <EmptyState icon={<SearchX size={20} />} title="No matching approved listings" description="Search a different title, organizer, or location." />}
      {pages > 1 && <nav className="discover-pagination" aria-label="Approved listing pages">
        <span aria-live="polite">Page {page} of {pages}</span>
        <div><button className="icon-button" type="button" aria-label="Previous approved listing page" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} aria-hidden="true" /></button>
          <button className="icon-button" type="button" aria-label="Next approved listing page" disabled={page === pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} aria-hidden="true" /></button></div>
      </nav>}
    </div> : <p className="discover-feed-status" role="status">The approved boards returned no listings.</p>)}
  </section>
}

export function DiscoverPage({ params }: { params: URLSearchParams }) {
  const { state, toggleSaved } = useWorkspace()
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterDraft, setFilterDraft] = useState<Filters>(emptyFilters)
  const panelId = useId()
  const resultsRef = useRef<HTMLDivElement>(null)
  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const query = params.get('q') ?? ''
  const category = choice(params.get('category'), categories) ?? 'All'
  const filters = readFilters(params)
  const sort: Sort = choice(params.get('sort'), ['recommended', 'deadline', 'latest']) ?? 'recommended'
  const results = getResults(category, query, filters, sort, state.saved)
  const pageCount = Math.max(1, Math.ceil(results.length / pageSize))
  const requestedPage = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, pageCount)) : 1
  const start = (page - 1) * pageSize
  const chips = [
    ...filters.locations.map(location => ({ label: location, remove: { locations: filters.locations.filter(item => item !== location) } })),
    ...filters.disciplines.map(discipline => ({ label: discipline, remove: { disciplines: filters.disciplines.filter(item => item !== discipline) } })),
    ...(filters.duration ? [{ label: filters.duration === '4-6' ? '4–6 months' : 'Short event', remove: { duration: '' } as const }] : []),
    ...(filters.format ? [{ label: filters.format, remove: { format: '' } as const }] : []),
    ...(filters.audience ? [{ label: filters.audience, remove: { audience: '' } as const }] : []),
    ...(filters.saved ? [{ label: 'Saved only', remove: { saved: false } }] : []),
  ]

  function update(key: string, value: string, replace = false) {
    const next = new URLSearchParams(params)
    if (key !== 'page') next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    navigate('/discover', next, { replace })
  }

  function applyFilters(nextFilters: Filters) {
    const next = new URLSearchParams(params)
    writeFilters(next, nextFilters)
    navigate('/discover', next)
    setFilterOpen(false)
  }

  function openFilters() {
    setFilterDraft(filters)
    setFilterOpen(true)
  }

  function removeFilters(nextFilters: Filters) {
    applyFilters(nextFilters)
    filterTriggerRef.current?.focus({ preventScroll: true })
  }

  function changePage(next: number) {
    update('page', next === 1 ? '' : String(next))
    resultsRef.current?.focus()
  }

  return <div className="discover-page">
    <header className="discover-page-heading">
      <p className="eyebrow"><span className="discover-route-dot" aria-hidden="true" /> Opportunity catalog</p>
      <h1>Discover opportunities</h1>
      <p>Find internships, events, and career programs that fit your next step.</p>
      <span className="discover-demo-label"><span aria-hidden="true" />Fictional demo listings</span>
    </header>
    <div className="discover-search-row">
      <SearchBox value={query} onChange={value => update('q', value, true)} label="Search opportunity catalog" placeholder="Search by role, skill, or organizer" />
      <button ref={filterTriggerRef} className="button button-secondary discover-filter-trigger" type="button" aria-haspopup="dialog" onClick={openFilters}>
        <SlidersHorizontal size={17} aria-hidden="true" /> Filters {chips.length > 0 && <span className="discover-filter-count">{chips.length}</span>}
      </button>
    </div>
    <CategoryTabs active={category} panelId={panelId} onChange={value => update('category', value === 'All' ? '' : value)} />
    <div ref={resultsRef} className="discover-results" role="tabpanel" tabIndex={0} id={panelId}
      aria-labelledby={`${panelId}-tab-${categoryTabs.findIndex(item => item.value === category)}`}>
      {chips.length > 0 && <div className="discover-active-filters" aria-label="Active filters">
        {chips.map(({ label, remove }) => <button key={label} type="button" aria-label={`Remove ${label} filter`} onClick={() => removeFilters({ ...filters, ...remove })}>{label}<X size={14} aria-hidden="true" /></button>)}
        <button className="discover-clear-filters" type="button" onClick={() => removeFilters(emptyFilters)}>Clear filters</button>
      </div>}
      <div className="discover-results-bar">
        <p aria-live="polite"><strong>{results.length}</strong> {results.length === 1 ? 'opportunity' : 'opportunities'}</p>
        <label>Sort by <select className="field discover-sort" value={sort} onChange={event => update('sort', event.target.value === 'recommended' ? '' : event.target.value)}>
          <option value="recommended">Best match</option><option value="deadline">Deadline soonest</option><option value="latest">Recently added</option>
        </select></label>
      </div>
      {results.length ? <div className="discover-card-grid">
        {results.slice(start, start + pageSize).map((opportunity, index) => <OpportunityCard key={opportunity.id} opportunity={opportunity}
          saved={state.saved.includes(opportunity.id)} onToggleSave={() => {
            if (toggleSaved(opportunity.id) && filters.saved) resultsRef.current?.focus({ preventScroll: true })
          }} returnTo={params} order={index} />)}
      </div> : <EmptyState icon={<SearchX size={24} />} title="No matching opportunities" description="Try a different search term or clear filters to see more of the demo catalog."
        action={<button className="button button-secondary" type="button" onClick={() => {
          navigate('/discover')
          resultsRef.current?.focus({ preventScroll: true })
        }}>Reset search and filters</button>} />}
      {pageCount > 1 && <nav className="discover-pagination" aria-label="Catalog pages">
        <span aria-live="polite">Showing {start + 1}–{Math.min(start + pageSize, results.length)} of {results.length}</span>
        <div>
          <button className="icon-button" type="button" aria-label="Previous page" disabled={page === 1} onClick={() => changePage(page - 1)}><ChevronLeft size={17} aria-hidden="true" /></button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map(value => <button key={value} className="icon-button" type="button" aria-label={`Page ${value}`}
            aria-current={page === value ? 'page' : undefined} onClick={() => changePage(value)}>{value}</button>)}
          <button className="icon-button" type="button" aria-label="Next page" disabled={page === pageCount} onClick={() => changePage(page + 1)}><ChevronRight size={17} aria-hidden="true" /></button>
        </div>
      </nav>}
    </div>
    <ApprovedFeed />
    <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} value={filterDraft} onChange={setFilterDraft} onApply={applyFilters} />
  </div>
}

export function MatchExplanation({ opportunity }: { opportunity: Opportunity }) {
  const { score, reasons, gaps } = opportunity.match
  const reducedMotion = useReducedMotion()
  return <section className="panel opportunity-detail-panel opportunity-match-panel">
    <div className="opportunity-panel-label"><Sparkles size={17} aria-hidden="true" /><h2>Match explanation</h2></div>
    <div className="opportunity-match-score"><strong>{score}%</strong><span>Sample match</span></div>
    <div className="opportunity-match-track" role="meter" aria-label="Sample match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
      <motion.span style={{ width: `${score}%` }} initial={reducedMotion ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: .26 }} />
    </div>
    <p className="opportunity-match-context">Based on the demonstration profile and listing.</p>
    <ul className="opportunity-match-reasons">{reasons.map(reason => <li key={reason}><Check size={16} aria-hidden="true" />{reason}</li>)}</ul>
    {gaps.length > 0 && <div className="opportunity-match-gaps"><h3>To review</h3><ul>{gaps.map(gap => <li key={gap}>{gap}</li>)}</ul></div>}
  </section>
}

export function OpportunityDetailPage({ id, params }: { id: string; params?: URLSearchParams }) {
  const { state, toggleSaved, createPlan, openReview } = useWorkspace()
  const opportunity = opportunities.find(item => item.id === id)
  const catalogLink = href('/discover', new URLSearchParams(params?.get('from') ?? ''))
  if (!opportunity) return <EmptyState title="Opportunity unavailable" description="The link does not match a listing in the demo catalog."
    action={<a className="button button-secondary" href={catalogLink}><ArrowLeft size={16} aria-hidden="true" />Back to Discover</a>} />

  const saved = state.saved.includes(id)
  const hasPlan = Object.hasOwn(state.plans, id)
  const hasDeadlineChange = deadlineChange.opportunityId === id

  return <div className="opportunity-detail">
    <nav className="opportunity-breadcrumb" aria-label="Breadcrumb"><a href={catalogLink}><ArrowLeft size={16} aria-hidden="true" /> Discover</a><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">Opportunity detail</span></nav>
    <header className="panel opportunity-detail-hero">
      <div className="opportunity-detail-hero-top">
        <OrganizationMark opportunity={opportunity} />
        <span className="opportunity-category">{opportunity.category}</span><SourceVerificationBadge />
        <button className="button button-secondary opportunity-detail-save" type="button" aria-label={`Save ${opportunity.title}`} aria-pressed={saved} onClick={() => toggleSaved(id)}>
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />{saved ? 'Saved' : 'Save'}
        </button>
      </div>
      <h1>{opportunity.title}</h1>
      <p className="opportunity-detail-organization">{opportunity.organization}</p>
      <p className="opportunity-detail-summary">{opportunity.summary}</p>
      <div className="opportunity-detail-facts">
        <span><MapPin size={17} aria-hidden="true" />{opportunity.location}{opportunity.location !== opportunity.format && ` · ${opportunity.format}`}</span>
        <span><Clock3 size={17} aria-hidden="true" />{durationLabel(opportunity.durationMonths)}</span>
        <DeadlineBadge date={opportunity.deadline} style="long" />
      </div>
    </header>
    {hasDeadlineChange && <aside className="opportunity-deadline-note" aria-label="Deadline change">
      <CircleAlert size={20} aria-hidden="true" />
      <div><strong>Sample deadline moved earlier</strong><p><del>{formatDate(deadlineChange.oldDate, 'long')}</del><ArrowRight size={15} aria-hidden="true" /><time dateTime={deadlineChange.newDate}>{formatDate(deadlineChange.newDate, 'long')}</time></p></div>
      <button className="button button-secondary" type="button" onClick={openReview}>{state.resolution ? 'View update' : 'Review change'}</button>
    </aside>}
    <div className="opportunity-detail-columns">
      <div className="opportunity-detail-stack">
        <section className="panel opportunity-detail-panel"><h2>About the opportunity</h2><p>{opportunity.description}</p>
          <h3>Required skills</h3><div className="opportunity-tags">{opportunity.skills.map(skill => <span key={skill}>{skill}</span>)}</div>
        </section>
        <section className="panel opportunity-detail-panel"><h2>Eligibility</h2><p>{opportunity.organization} lists these eligibility criteria in the sample posting.</p>
          <ul className="opportunity-detail-list">{opportunity.eligibility.map(item => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="panel opportunity-detail-panel"><h2>Application requirements</h2>
          <ul className="opportunity-detail-list">{opportunity.requirements.map(item => <li key={item}>{item}</li>)}</ul>
          <a className="button button-secondary opportunity-draft-link" href={href('/application', new URLSearchParams({ opportunity: id }))}><FileText size={17} aria-hidden="true" />Prepare application draft</a>
        </section>
      </div>
      <aside className="opportunity-detail-stack" aria-label="Preparation and source">
        <section className="panel opportunity-detail-panel opportunity-plan-panel">
          <div className="opportunity-panel-label"><ListChecks size={18} aria-hidden="true" /><h2>Preparation plan</h2></div>
          <p>Break the sample requirements into steps you can track in My Path.</p>
          {hasPlan ? <a className="button button-primary" href={href('/path')}>View preparation plan <ArrowRight size={16} aria-hidden="true" /></a>
            : <button className="button button-primary" type="button" onClick={() => { if (createPlan(id)) navigate('/path') }}>Create preparation plan <ArrowRight size={16} aria-hidden="true" /></button>}
        </section>
        <MatchExplanation opportunity={opportunity} />
        <section className="panel opportunity-detail-panel opportunity-source-panel">
          <div className="opportunity-panel-label"><FileCheck2 size={17} aria-hidden="true" /><h2>Listing source</h2></div>
          <p>{opportunity.sourceName}</p>
          <a href={opportunity.sourceUrl}>Open sample source <ArrowUpRight size={16} aria-hidden="true" /></a>
        </section>
      </aside>
    </div>
  </div>
}
