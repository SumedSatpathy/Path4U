import { ExternalLink } from 'lucide-react'
import { courses, type Course } from '../shared/learning.mjs'

export function CourseCards({ resources }: { resources: Course[] }) {
  return <div className="learning-course-grid">{resources.map(course => {
    const alternative = courses.find(item => item.id === course.alternative)
    return <article className="panel learning-card" key={course.id}>
      <p className="eyebrow">{course.provider} · {course.level || 'Check prerequisites'}</p><h3>{course.title}</h3>
      {course.instructor && <p>{course.instructor}</p>}
      <p className="muted">{course.cost || 'Free learning material; check optional credential fees'}</p>
      {course.skills?.length ? <p><strong>Skills</strong> · {course.skills.join(', ')}</p> : <p>{course.topic}</p>}
      <p className="field-help">{course.discovery || (course.checkedAt ? 'Provider page checked ' + course.checkedAt + '. ' : '') + 'Check current enrollment terms at the provider.'}</p>
      <div className="learning-toolbar"><a className="button button-secondary button-small" href={course.url} target="_blank" rel="noopener noreferrer">View Course <ExternalLink size={14} /></a>
      {alternative && <a className="button button-ghost button-small" href={alternative.url} target="_blank" rel="noopener noreferrer">Free Alternative <ExternalLink size={14} /></a>}</div>
    </article>
  })}</div>
}

export function SearchSuggestions({ html }: { html?: string }) {
  if (!html) return null
  const policy = "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'"
  return <iframe className="search-suggestions" title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={'<!doctype html><meta http-equiv="Content-Security-Policy" content="' + policy + '"><base target="_blank"><style>html{color-scheme:light}body{margin:0;font:14px system-ui;color:#111;background:#fff}a{overflow-wrap:anywhere}</style>' + html} />
}
