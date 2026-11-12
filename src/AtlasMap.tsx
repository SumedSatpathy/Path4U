import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { ArrowRight, ArrowUpRight, Award, BriefcaseBusiness, CodeXml, Compass, Flag, MapPin, Route, Trophy } from 'lucide-react'
import { journey, waypoints, type Waypoint } from './atlasData'
import { href, navigate, useRoute } from './routes'
import './atlas-map.css'

const width = 760
const height = 455

const waypointIcons = {
  'Current location': MapPin,
  Hackathon: CodeXml,
  Competition: Trophy,
  Certification: Award,
  Internship: Flag,
}

const woodlots = [
  [39, 143], [51, 155], [65, 137], [73, 158], [92, 151], [83, 174], [99, 168], [107, 185], [43, 182],
  [172, 353], [187, 367], [203, 348], [220, 360], [230, 381], [247, 373], [270, 388], [252, 402], [205, 396],
  [454, 62], [466, 79], [480, 65], [493, 92], [509, 71], [519, 53], [529, 85], [547, 71], [531, 104],
  [657, 288], [675, 306], [691, 285], [705, 315], [725, 298], [741, 325], [719, 334], [675, 329],
]

const surveyPoints = [[156, 96], [265, 172], [379, 134], [562, 223], [659, 187], [524, 319], [389, 374], [310, 62], [610, 374]]

function elevationPaths(cx: number, cy: number, rx: number, ry: number, count: number, phase: number) {
  return Array.from({ length: count }, (_, ring) => {
    const scale = .21 + ring * .093
    const coordinates = Array.from({ length: 73 }, (_, step) => {
      const angle = step * Math.PI / 36
      const ridge = 1 + .14 * Math.sin(angle * 3 + phase) + .07 * Math.cos(angle * 5 + phase * 2) + .055 * Math.sin(angle * 7 - phase)
      const x = cx + Math.cos(angle) * rx * scale * ridge + Math.sin(angle) * rx * scale * .25
      const y = cy + Math.sin(angle) * ry * scale * ridge - Math.cos(angle) * ry * scale * .12
      return `${x.toFixed(1)} ${y.toFixed(1)}`
    })
    return `M${coordinates.join(' L')} Z`
  })
}

const contours = [
  ...elevationPaths(95, 81, 180, 120, 10, 2.4),
  ...elevationPaths(604, 32, 181, 131, 13, 1.6),
  ...elevationPaths(719, 348, 212, 134, 12, 3.8),
  ...elevationPaths(312, 449, 164, 100, 11, .4),
]

function traceRoute(stops: Waypoint[]) {
  const turns = [[.15, -.22, .52, .05], [.43, -.15, .65, 1.15], [.20, .15, .68, 1.03], [.34, .08, .62, 1.17]]
  return stops.map((point, index) => {
    const x = point.x * width / 100
    const y = point.y * height / 100
    if (index === 0) return `M${x} ${y}`
    const last = stops[index - 1]
    const previousX = last.x * width / 100
    const previousY = last.y * height / 100
    const [startX, startY, endX, endY] = turns[index - 1] ?? [.25, .15, .75, .85]
    const dx = x - previousX
    const dy = y - previousY
    return `C${previousX + dx * startX} ${previousY + dy * startY} ${previousX + dx * endX} ${previousY + dy * endY} ${x} ${y}`
  }).join(' ')
}

const routePath = traceRoute(waypoints)

function Terrain({ patternId }: { patternId: string }) {
  return <svg className="atlas-map-terrain" width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id={`${patternId}-grid`} width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38 0H0V38" fill="none" stroke="var(--atlas-contour)" strokeWidth=".55" opacity=".38" /></pattern>
      <pattern id={`${patternId}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(39)"><path d="M0 0V5" stroke="var(--atlas-contour)" strokeWidth=".7" opacity=".38" /></pattern>
      <linearGradient id={`${patternId}-paper`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="var(--atlas-terrain)" /><stop offset=".53" stopColor="var(--atlas-paper)" /><stop offset="1" stopColor="var(--atlas-terrain)" /></linearGradient>
      <linearGradient id={`${patternId}-lake`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--atlas-water)" /><stop offset="1" stopColor="var(--atlas-terrain)" /></linearGradient>
    </defs>
    <rect width="760" height="455" fill={`url(#${patternId}-paper)`} />
    <path d="M0 0H322L292 38 253 45 215 81 203 123 159 152 151 212 90 234 46 219 0 232Z" fill="var(--atlas-water)" opacity=".43" />
    <path d="M470 0H760V184L718 174 677 153 648 179 611 153 570 156 539 130 492 137 469 94 449 52Z" fill="var(--atlas-sea-glass)" opacity=".68" />
    <path d="M760 249V455H433L456 428 507 419 535 384 581 392 619 350 624 322 664 290 700 295Z" fill="var(--atlas-water)" opacity=".44" />
    <path d="M0 324L80 312 130 336 164 327 207 346 236 334 275 359 303 399 355 415 381 455H0Z" fill="var(--atlas-sea-glass)" opacity=".55" />
    <path d="M0 232L46 219 90 234 151 212 159 152 203 123 215 81 253 45 292 38" fill="none" stroke="var(--atlas-contour)" strokeWidth=".7" strokeDasharray="3 4" opacity=".62" />
    <path d="M639 305l23-13 36 6 34-21 28 2v88l-25-10-33 4-37-20zM147 383l35-36 40 9 24-18 45 39 16 36-49 10-42-24-37 2z" fill={`url(#${patternId}-hatch)`} />
    <path d="M387-9C360 28 353 53 359 82c9 46 53 46 67 82 16 42-21 70-6 103 12 29 57 29 71 62 16 37-1 76 19 135" fill="none" stroke="var(--atlas-water)" strokeWidth="12" opacity=".82" />
    <path d="M387-9C360 28 353 53 359 82c9 46 53 46 67 82 16 42-21 70-6 103 12 29 57 29 71 62 16 37-1 76 19 135" fill="none" stroke="var(--atlas-paper)" strokeWidth="2.7" opacity=".85" />
    <path d="M403 169c22-16 60-7 67 14 8 22-18 42-42 49-22 8-44-4-46-21-3-16 3-30 21-42Z" fill={`url(#${patternId}-lake)`} stroke="var(--atlas-water-edge)" strokeWidth=".85" />
    <path d="M396 198c17 8 40 7 58-10M407 215c13 0 30-4 41-12" fill="none" stroke="var(--atlas-water-edge)" strokeWidth=".8" />
    <rect width="760" height="455" fill={`url(#${patternId}-grid)`} />
    <g fill="none" stroke="var(--atlas-contour)">
      {contours.map((path, index) => <path key={index} d={path} strokeWidth={index % 5 === 0 ? 1 : .58} opacity={index % 5 === 0 ? .49 : .32} />)}
    </g>
    <g fill="none" stroke="var(--atlas-contour)" strokeWidth="1.2" strokeDasharray="3 5" opacity=".68">
      <path d="M-12 287c77-22 154-24 228-59 67-32 99-81 161-92 83-14 99-44 122-95" />
      <path d="M185 461c7-52 51-70 103-72 77-4 99-71 157-78 81-10 148 22 208-14 45-26 79-25 115-18" />
      <path d="M544 459c31-47 14-84 18-117 6-51 69-104 121-131l75-23" />
    </g>
    <g transform="translate(19 318) rotate(-13 60 35)">
      <path d="M-16 35H134M27 -13V78M76 -13V78M119 -8V78M-12 7H129M-12 64H129" fill="none" stroke="var(--atlas-paper)" strokeWidth="5" />
      <g fill="var(--atlas-campus)" stroke="var(--atlas-contour)" strokeWidth=".7">
        <path d="M1 12h18v16H1zM35 12h30v11H35zM82 13h26v17H82zM35 42h28v13H35zM1 41h16v16H1zM88 41h22v14H88zM3 70h15v12H3zM37 72h24v11H37zM83 72h24v9H83z" />
      </g>
    </g>
    <g fill="none" stroke="var(--atlas-contour)" strokeWidth="1" opacity=".7">
      {woodlots.map(([x, y], index) => <path key={index} d={`M${x} ${y - 5}l-3.5 6h7z m0 6v2`} />)}
    </g>
    <g stroke="var(--atlas-contour)" strokeWidth=".8" opacity=".64">
      {surveyPoints.map(([x, y]) => <path key={x} d={`M${x - 2} ${y}h4m-2 -2v4`} />)}
    </g>
    <g className="atlas-terrain-lettering" fill="var(--atlas-slate)">
      <text x="101" y="119" transform="rotate(-11 101 119)">FOUNDATIONS</text>
      <text x="468" y="130" transform="rotate(-17 468 130)">LEARNING RIDGE</text>
      <text x="533" y="367" transform="rotate(-7 533 367)">PRACTICE VALLEY</text>
      <text x="34" y="409">CAMPUS</text>
      <text x="661" y="57">SUMMIT</text>
      <text x="600" y="281" className="atlas-survey-height">450</text>
      <text x="216" y="417" className="atlas-survey-height">120</text>
    </g>
    <path d={routePath} fill="none" stroke="var(--atlas-paper)" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" />
    <path d={routePath} fill="none" stroke="var(--atlas-route)" strokeWidth="3.3" strokeLinejoin="round" strokeLinecap="round" />
    <path d={routePath} fill="none" stroke="var(--atlas-sea-glass)" strokeWidth=".75" strokeDasharray="1 7" strokeLinecap="round" />
  </svg>
}

export function AtlasMap({ selectedId, onSelect, expanded = false }: { selectedId: string; onSelect: (id: string) => void; expanded?: boolean }) {
  const mapId = `atlas-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const markers = useRef<(HTMLButtonElement | null)[]>([])

  function moveMarker(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const final = waypoints.length - 1
    let target: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown': target = Math.min(index + 1, final); break
      case 'ArrowLeft':
      case 'ArrowUp': target = Math.max(index - 1, 0); break
      case 'Home': target = 0; break
      case 'End': target = final; break
      default: return
    }
    event.preventDefault()
    markers.current[target]?.focus()
    onSelect(waypoints[target].id)
  }

  return <figure className={`atlas-map${expanded ? ' atlas-map-expanded' : ''}`}>
    <div className="atlas-map-canvas" role="group" aria-label="Illustrated career route. Use the waypoint buttons to explore each stop.">
      <Terrain patternId={mapId} />
      <div className="atlas-map-frame" aria-hidden="true" />
      <div className="atlas-map-north" aria-hidden="true"><span>N</span><svg viewBox="0 0 32 38" width="27" height="33"><path d="M16 1 28 31 16 24 4 31Z" fill="var(--atlas-paper)" stroke="currentColor" strokeWidth="1.1" /><path d="M16 1v23L4 31Z" fill="currentColor" /><path d="M16 30v7M1 33h5m20 0h5" stroke="currentColor" strokeWidth=".7" /></svg></div>
      <div className="atlas-map-index" aria-hidden="true"><span>FIG. 01</span><span>CAREER TERRAIN</span></div>
      <div className="atlas-map-scale" aria-hidden="true"><span>ROUTE PROGRESS</span><div><i /><i /><i /></div><span>TRAILHEAD <b /> SUMMIT</span></div>
      {waypoints.map((point, index) => {
        const active = point.id === selectedId
        const Icon = waypointIcons[point.kind]
        return <button type="button" key={point.id} ref={element => { markers.current[index] = element }}
          className={`atlas-map-marker atlas-map-marker-${index + 1}${active ? ' is-selected' : ''}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-pressed={active}
          aria-label={`${index === 0 ? 'Trailhead' : `Waypoint ${index}`}. ${point.title}, ${point.kind}, ${point.month}`}
          onClick={() => onSelect(point.id)} onKeyDown={event => moveMarker(event, index)}>
          <span className="atlas-map-marker-pin" aria-hidden="true">{index === 0 ? <Icon size={15} strokeWidth={2.2} /> : String(index).padStart(2, '0')}</span>
          <span className="atlas-map-marker-label" aria-hidden="true"><strong>{point.shortTitle}</strong><span>{point.month}</span></span>
        </button>
      })}
    </div>
    <figcaption className="atlas-map-caption">
      <span className="atlas-map-key"><i className="atlas-map-key-current" />You are here</span>
      <span className="atlas-map-key"><i className="atlas-map-key-waypoint" />Waypoint</span>
      <span className="atlas-map-key"><i className="atlas-map-key-route" />Learning route</span>
      <span className="atlas-map-caption-aside">Illustrative map · Demo route</span>
    </figcaption>
  </figure>
}

export function OpportunityMapPage() {
  const { params } = useRoute()
  const selected = waypoints.find(point => point.id === params.get('waypoint')) ?? waypoints[0]
  const selectedIndex = waypoints.indexOf(selected)
  const next = waypoints[selectedIndex + 1]
  const Icon = waypointIcons[selected.kind]
  const detailTitle = useRef<HTMLHeadingElement>(null)
  const focusDetails = useRef(false)

  useEffect(() => {
    if (!focusDetails.current) return
    focusDetails.current = false
    detailTitle.current?.focus({ preventScroll: true })
  }, [selected.id])

  function select(id: string) {
    navigate('/map', new URLSearchParams({ waypoint: id }), { replace: true })
  }

  return <div className="atlas-map-page">
    <header className="atlas-map-page-heading">
      <p className="eyebrow"><Compass size={15} aria-hidden="true" /> Career Atlas</p>
      <h1>Opportunity Map</h1>
      <p>Follow a sample route from your first project to an internship. Select a waypoint to see the skills and preparation behind it.</p>
    </header>
    <div className="atlas-map-page-grid">
      <AtlasMap selectedId={selected.id} onSelect={select} expanded />
      <section className="panel atlas-map-detail" aria-labelledby="atlas-waypoint-title">
        <div className="atlas-map-detail-identity">
          <span><Icon size={21} aria-hidden="true" /></span>
          <p className="eyebrow">{selected.kind} <b>·</b> {selected.month}</p>
        </div>
        <div aria-live="polite" aria-atomic="true">
          <h2 id="atlas-waypoint-title" ref={detailTitle} tabIndex={-1}>{selected.title}</h2>
          <p>{selected.description}</p>
        </div>
        <div className="atlas-map-readiness">
          <label htmlFor="atlas-map-readiness-value">Baseline readiness <strong>{journey.readiness}%</strong></label>
          <meter id="atlas-map-readiness-value" min={0} max={100} value={journey.readiness}>{journey.readiness}%</meter>
          {selected.readiness > 0 && <p>Illustrated contribution <strong>+{selected.readiness} points</strong></p>}
        </div>
        <div className="atlas-map-skills"><h3>Skills on this leg</h3><ul>{selected.skills.map(skill => <li key={skill}>{skill}</li>)}</ul></div>
        {selected.opportunityId ? <a className="button button-primary" href={href('/opportunity/' + selected.opportunityId)}>View related demo listing <ArrowUpRight size={16} aria-hidden="true" /></a>
          : next ? <button className="button button-secondary" type="button" onClick={() => { focusDetails.current = true; select(next.id) }}>Next waypoint <ArrowRight size={16} aria-hidden="true" /></button>
            : <a className="button button-secondary" href={href('/discover')}>Discover opportunities <ArrowRight size={16} aria-hidden="true" /></a>}
      </section>
    </div>
    <section className="panel atlas-map-itinerary" aria-labelledby="atlas-route-heading">
      <div className="atlas-map-itinerary-heading"><Route size={19} aria-hidden="true" /><div><h2 id="atlas-route-heading">Route itinerary</h2><p>Five waypoints from trailhead to summit</p></div></div>
      <ol>{waypoints.map((point, index) => {
        const PointIcon = index === waypoints.length - 1 ? BriefcaseBusiness : waypointIcons[point.kind]
        return <li key={point.id}><button type="button" aria-pressed={selected.id === point.id} onClick={() => select(point.id)}>
          <PointIcon size={18} aria-hidden="true" /><span><strong>{point.shortTitle}</strong><small>{point.kind} · {point.month}</small></span>
        </button></li>
      })}</ol>
    </section>
  </div>
}
