import { useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Compass, Flag, MapPin, Route, Target } from 'lucide-react'
import { AtlasMap } from './AtlasMap'
import { JourneyTimeline } from './AtlasViews'
import { journey, waypoints } from './atlasData'
import { href } from './routes'
import { useWorkspace } from './workspace'
import './atlas.css'

const routeNotes = [
  { id: 'tensorflow', note: 'Show you can train and evaluate a model.' },
  { id: 'solution-challenge', note: 'Turn a team prototype into portfolio evidence.' },
  { id: 'google-internship', note: 'Apply your skills on a supervised team.' },
]

function mapLink(id: string) {
  return href('/map', new URLSearchParams({ waypoint: id }))
}

export function CareerAtlas() {
  const { state } = useWorkspace()
  const [selectedId, setSelectedId] = useState<string>(journey.recommendedId)
  const selected = waypoints.find(point => point.id === selectedId) ?? waypoints[0]
  const recommended = waypoints.find(point => point.id === journey.recommendedId)!
  const firstName = state.profile.name.trim().split(/\s+/)[0] || 'Ahmad'
  const origin = state.profile.stage === 'Student' ? journey.campus : state.profile.stage === 'Graduate' ? 'Recent graduate' : 'Career explorer'

  return <article className="career-atlas">
    <header className="atlas-hero">
      <div>
        <p className="atlas-kicker"><Compass size={15} /> Career atlas <span /> AI engineering track</p>
        <h1>Your career journey<span>.</span></h1>
        <p>See where you are, where you want to go, and the opportunities that connect them.</p>
      </div>
      <a className="button button-secondary atlas-brief-link" href={href('/briefing')}><BookOpen size={17} /> Weekly briefing <ArrowUpRight size={15} /></a>
    </header>

    <section className="atlas-summary" aria-label="Your journey at a glance">
      <div className="atlas-summary-cell">
        <span className="atlas-summary-icon"><MapPin size={19} /></span>
        <div><p className="atlas-label">Current location</p><h2>{origin}</h2><p>{firstName} · {state.profile.location === 'Any location' ? 'Open to any location' : state.profile.location}</p></div>
      </div>
      <div className="atlas-summary-cell">
        <span className="atlas-summary-icon atlas-summary-target"><Flag size={19} /></span>
        <div><p className="atlas-label">Destination</p><h2>{journey.destination}</h2><p>Sample career goal</p></div>
      </div>
      <div className="atlas-summary-cell atlas-summary-readiness">
        <span className="atlas-readiness" aria-hidden="true"><svg viewBox="0 0 54 54"><circle cx="27" cy="27" r="22" /><circle cx="27" cy="27" r="22" pathLength="100" strokeDasharray={journey.readiness + ' 100'} /></svg><Target size={17} /></span>
        <div><p className="atlas-label">Estimated readiness</p><h2>{journey.readiness}%</h2><p>Illustrative baseline</p></div>
      </div>
    </section>

    <section className="atlas-route" aria-labelledby="route-heading">
      <div className="atlas-section-heading">
        <div><p className="atlas-kicker"><Route size={15} /> Route 01 <span /> Kuala Lumpur</p><h2 id="route-heading">Opportunity map</h2></div>
        <a className="atlas-link" href={mapLink(selectedId)}>Expand map <ArrowUpRight size={16} /></a>
      </div>
      <div className="atlas-route-grid">
        <AtlasMap selectedId={selectedId} onSelect={setSelectedId} />
        <aside className="atlas-route-guide" aria-labelledby="route-guide-title">
          <header><p className="atlas-label"><span className="atlas-tiny-square" /> Route intelligence</p><h3 id="route-guide-title">Why this path?</h3><p>Build evidence in stages, from a team prototype to applied engineering work.</p></header>
          <div className="atlas-route-notes">
            {routeNotes.map(note => {
              const point = waypoints.find(item => item.id === note.id)!
              return <button type="button" key={note.id} className="atlas-note" aria-pressed={selectedId === note.id} onClick={() => setSelectedId(note.id)}>
                <span><strong>{point.kind === 'Hackathon' ? 'Team hackathon' : point.kind === 'Internship' ? 'AI internship' : point.title}</strong><small>{note.note}</small></span>
                <span className="atlas-points" aria-label={point.readiness + ' estimated readiness points'}>+{point.readiness}</span>
              </button>
            })}
          </div>
          <div className="atlas-selected" aria-live="polite">
            <p className="atlas-label">Selected waypoint</p>
            <a className="atlas-link" href={mapLink(selected.id)}>{selected.title} <ArrowDownRight size={15} /></a>
          </div>
        </aside>
      </div>
      <div className="atlas-next">
        <span className="atlas-next-icon"><Flag size={19} /></span>
        <div><p className="atlas-label">Next recommended move</p><strong>{recommended.title}</strong></div>
        <p>Draft a problem statement and find a teammate.</p>
        <a className="button button-primary button-small" href={mapLink(recommended.id)}>View waypoint <ArrowRight size={16} /></a>
      </div>
    </section>

    <section className="atlas-timeline" aria-labelledby="atlas-timeline-title">
      <div className="atlas-section-heading">
        <div><p className="atlas-kicker"><CalendarDays size={15} /> November 2026 – August 2027</p><h2 id="atlas-timeline-title">Opportunity timeline</h2></div>
        <a className="atlas-link" href={href('/planner')}>Open pathway planner <ArrowUpRight size={16} /></a>
      </div>
      <JourneyTimeline compact />
    </section>
    <footer className="atlas-footer"><span>Path4U · Illustrative route and readiness estimates</span><a className="atlas-link" href={href('/demo')}>About this demo <ArrowUpRight size={14} /></a></footer>
  </article>
}
