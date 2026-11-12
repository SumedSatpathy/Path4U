export const categories = ['Internship', 'Hackathon', 'Workshop', 'Fellowship', 'Career program', 'Certification', 'Scholarship', 'Job'] as const
export const workFormats = ['Remote', 'Hybrid', 'In person', 'Not stated'] as const
export const audiences = ['Students', 'Graduates', 'Open to all', 'Not stated'] as const
export const disciplines = ['Software', 'AI', 'Data Science', 'Product', 'Design', 'Other'] as const

export type Category = typeof categories[number]
export type WorkFormat = typeof workFormats[number]
export type Audience = typeof audiences[number]
export type Discipline = typeof disciplines[number]

export interface Opportunity {
  id: string
  title: string
  organization: string
  initials: string
  color: 'violet' | 'cyan' | 'amber' | 'mint' | 'pink' | 'blue'
  category: Category
  location: string
  format: WorkFormat
  audience: Audience
  discipline: Discipline
  durationMonths: number
  status?: 'Verified Open' | 'Status Unverified' | 'Closed' | 'Expired'
  discoveredAt?: string
  checkedAt?: string
  sourceId?: string
  sourceRecordUrl?: string
  sourceVerifiedAt?: string
  statusEvidence?: string
  cached?: boolean
  eventStart?: string
  eventEnd?: string
  eventTimezone?: string
  fees?: string
  employmentType?: string
  experienceLevel?: string
  verified?: boolean
  deadline: string
  published: string
  summary: string
  description: string
  skills: string[]
  requirements: string[]
  eligibility: string[]
  match: { score: number; reasons: string[]; gaps: string[] }
  sourceUrl: string
  sourceName: string
}

export interface Task { id: string; title: string; done: boolean }

export interface DeadlineChange {
  id: string
  opportunityId: string
  oldDate: string
  newDate: string
  before: string
  after: string
  task: string
  sourceName: string
  detectedAt: string
}

export interface CalendarResolution {
  changeId: string
  confirmedAt: string
  date: string
  simulated: true
}

export const deadlineChange: DeadlineChange = {
  id: 'orbit-november-deadline',
  opportunityId: 'orbit-summer',
  oldDate: '2026-11-28',
  newDate: '2026-11-21',
  before: 'Applications close on 28 November 2026 at 23:59 UTC.',
  after: 'Applications close on 21 November 2026 at 23:59 UTC.',
  task: 'Submit your portfolio and application',
  sourceName: 'Orbit Labs sample careers listing',
  detectedAt: '2026-11-09T09:00:00Z',
}

type Fixture = Omit<Opportunity, 'sourceName' | 'sourceUrl' | 'match'> & { score: number; reasons: string[]; gaps: string[] }

function fixture({ score, reasons, gaps, ...item }: Fixture): Opportunity {
  return {
    ...item,
    match: { score, reasons, gaps },
    sourceName: item.organization + ' sample listing',
    sourceUrl: '#/source/' + item.id,
  }
}

export const opportunities: Opportunity[] = [
  fixture({
    id: 'orbit-summer', title: 'Product Engineering Internship', organization: 'Orbit Labs', initials: 'O',
    color: 'violet', category: 'Internship', location: 'Kuala Lumpur', format: 'Hybrid', audience: 'Students',
    discipline: 'Software', durationMonths: 6, deadline: deadlineChange.newDate, published: '2026-11-06',
    summary: 'Ship a real product feature alongside a small, cross-functional engineering team.',
    description: 'Join a six-month product engineering team in Kuala Lumpur. Work with a mentor on a customer-facing React feature, from scoping and accessibility through release.',
    skills: ['React', 'TypeScript', 'Git'],
    requirements: ['One-page resume', 'A portfolio or GitHub link', 'A short note about a feature you built'],
    eligibility: ['Currently enrolled in a degree or diploma', 'Available for six months', 'Able to work hybrid in Kuala Lumpur'],
    score: 94, reasons: ['React and TypeScript align with the team stack.', 'Your sample profile lists Kuala Lumpur and six-month availability.'],
    gaps: ['Add a portfolio example that explains a product decision.'],
  }),
  fixture({
    id: 'signal-hack', title: 'Build for Better Hackathon', organization: 'Signal Collective', initials: 'S',
    color: 'cyan', category: 'Hackathon', location: 'Remote', format: 'Remote', audience: 'Open to all',
    discipline: 'AI', durationMonths: 0, deadline: '2026-11-24', published: '2026-11-08',
    summary: 'Spend a weekend prototyping practical tools for local communities.',
    description: 'Form a small team or enter solo. The sample event provides open problem statements, mentor check-ins, and a short demo session at the end of the weekend.',
    skills: ['Python', 'Prototyping', 'Git'],
    requirements: ['A short project idea', 'Team details if applying as a group'],
    eligibility: ['Open to individual applicants and teams of up to four', 'Available for the weekend demo'],
    score: 89, reasons: ['Your sample Python and prototyping experience are relevant.'],
    gaps: ['Prepare a one-paragraph problem statement.'],
  }),
  fixture({
    id: 'atlas-data', title: 'Applied Data Science Internship', organization: 'Atlas Research', initials: 'A',
    color: 'mint', category: 'Internship', location: 'Riyadh', format: 'In person', audience: 'Graduates',
    discipline: 'Data Science', durationMonths: 5, deadline: '2026-12-02', published: '2026-11-07',
    summary: 'Turn messy operational data into measurable insights with a research team.',
    description: 'Work on data preparation, experiment design, and reporting. Interns build a reproducible notebook and present their conclusions to the team.',
    skills: ['Python', 'SQL', 'Pandas'],
    requirements: ['Resume', 'A notebook or analysis sample', 'Availability dates'],
    eligibility: ['Graduated within the past two years', 'Available for five months in Riyadh'],
    score: 83, reasons: ['Python and SQL match the role’s core tools.'],
    gaps: ['Graduate eligibility and in-person availability need review.'],
  }),
  fixture({
    id: 'lumen-ai', title: 'Applied AI Engineering Internship', organization: 'Lumen Studio', initials: 'L',
    color: 'blue', category: 'Internship', location: 'Kuala Lumpur', format: 'Hybrid', audience: 'Students',
    discipline: 'AI', durationMonths: 4, deadline: '2026-12-07', published: '2026-11-10',
    summary: 'Build evaluation tooling for retrieval and generative AI workflows.',
    description: 'Work on evaluation datasets, retrieval quality, and reproducible reporting with a four-month mentorship track.',
    skills: ['Python', 'Machine Learning', 'SQL'],
    requirements: ['Resume', 'A link to one technical project'],
    eligibility: ['Currently enrolled in a technical program', 'Available for four months'],
    score: 87, reasons: ['The sample profile includes Python and SQL.'],
    gaps: ['Show one machine learning or evaluation project.'],
  }),
  fixture({
    id: 'frame-workshop', title: 'Accessible Interfaces Workshop', organization: 'Frame School', initials: 'F',
    color: 'pink', category: 'Workshop', location: 'Remote', format: 'Remote', audience: 'Open to all',
    discipline: 'Design', durationMonths: 0, deadline: '2026-11-26', published: '2026-11-04',
    summary: 'Learn to test keyboard navigation and contrast on a real interface.',
    description: 'Bring a small interface and run a guided accessibility audit. Leave with an actionable list of improvements and a reusable test routine.',
    skills: ['Accessibility', 'HTML', 'CSS'],
    requirements: ['A short description of the interface you want to audit'],
    eligibility: ['Open to anyone with basic web experience'],
    score: 81, reasons: ['Your sample profile includes web development.'],
    gaps: ['Choose a page you can test during the session.'],
  }),
  fixture({
    id: 'meridian-fellow', title: 'Data for Cities Fellowship', organization: 'Meridian Institute', initials: 'M',
    color: 'amber', category: 'Fellowship', location: 'Riyadh', format: 'Hybrid', audience: 'Graduates',
    discipline: 'Data Science', durationMonths: 6, deadline: '2026-12-14', published: '2026-11-03',
    summary: 'Investigate an urban data question and publish an open methods note.',
    description: 'The fictional fellowship pairs early-career analysts with research mentors on an applied city data project.',
    skills: ['SQL', 'Python', 'Data Visualization'],
    requirements: ['Resume', 'A brief research statement', 'One data sample'],
    eligibility: ['Recent graduates with an analytical background', 'Six-month commitment in Riyadh'],
    score: 78, reasons: ['SQL and Python carry over to the sample project.'],
    gaps: ['Explain the policy or urban question you would investigate.'],
  }),
  fixture({
    id: 'bridge-career', title: 'Associate Product Launchpad', organization: 'Bridge Works', initials: 'B',
    color: 'blue', category: 'Career program', location: 'Kuala Lumpur', format: 'In person', audience: 'Graduates',
    discipline: 'Product', durationMonths: 4, deadline: '2026-12-05', published: '2026-11-05',
    summary: 'Build a small product case study with a cohort of early-career peers.',
    description: 'Follow a structured program on discovery, prioritization, and measurement. Practice presenting a product decision with clear evidence.',
    skills: ['Research', 'Prototyping', 'Communication'],
    requirements: ['Resume', 'One case study or an example of problem solving'],
    eligibility: ['Recent graduates', 'Available in Kuala Lumpur for four months'],
    score: 75, reasons: ['Prototyping experience transfers to the case study.'],
    gaps: ['Prepare an example of prioritizing competing user needs.'],
  }),
  fixture({
    id: 'northstar-dev', title: 'Platform Engineering Internship', organization: 'Northstar Systems', initials: 'N',
    color: 'mint', category: 'Internship', location: 'Riyadh', format: 'Hybrid', audience: 'Students',
    discipline: 'Software', durationMonths: 6, deadline: '2026-12-18', published: '2026-11-09',
    summary: 'Improve internal tooling and deployment reliability with a platform team.',
    description: 'Build developer tooling, improve one CI workflow, and document lessons learned in a final internal demo.',
    skills: ['Git', 'Docker', 'Linux'],
    requirements: ['Resume', 'A code sample or project walkthrough'],
    eligibility: ['Currently enrolled', 'Available for six months in Riyadh'],
    score: 76, reasons: ['Git experience is relevant to the team workflow.'],
    gaps: ['Demonstrate a container or Linux project.'],
  }),
]

export function formatDate(date: string, style: 'short' | 'long' = 'short') {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return date
  return new Intl.DateTimeFormat('en-GB', {
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    ...(style === 'long' ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(value)
}

export const integrations = [
  'Gemini Enterprise', 'Google Drive', 'Google Calendar', 'Google Forms',
  'DEV Community', 'Greenhouse', 'Google Sheets', 'Gmail Drafts',
] as const
