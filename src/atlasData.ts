export type WaypointKind = 'Current location' | 'Hackathon' | 'Competition' | 'Certification' | 'Internship'

export interface Waypoint {
  id: string
  title: string
  shortTitle: string
  kind: WaypointKind
  month: string
  readiness: number
  description: string
  skills: string[]
  x: number
  y: number
  opportunityId?: string
}

export const waypoints: Waypoint[] = [
  { id: 'student', title: 'APU Student', shortTitle: 'APU Student', kind: 'Current location', month: 'Now', readiness: 0, description: 'Start from the software fundamentals and student projects in your sample profile.', skills: ['Python', 'Git'], x: 13, y: 75 },
  { id: 'solution-challenge', title: 'Google Solution Challenge', shortTitle: 'Solution Challenge', kind: 'Hackathon', month: 'November', readiness: 18, description: 'Build a small team project around a real problem. Turn your prototype into a portfolio story with evidence of what you contributed.', skills: ['Prototyping', 'Teamwork', 'Python'], x: 28, y: 53, opportunityId: 'signal-hack' },
  { id: 'kaggle', title: 'Kaggle Competition', shortTitle: 'Kaggle Competition', kind: 'Competition', month: 'December', readiness: 10, description: 'Practice evaluating a model against a public benchmark and write up the tradeoffs in a reproducible notebook.', skills: ['Model evaluation', 'Pandas', 'Python'], x: 46, y: 64 },
  { id: 'tensorflow', title: 'TensorFlow Certification', shortTitle: 'TensorFlow Skills', kind: 'Certification', month: 'January', readiness: 12, description: 'Set a milestone to demonstrate TensorFlow skills in a documented model project. Verify current certification availability before making a booking.', skills: ['TensorFlow', 'Model training'], x: 64, y: 37 },
  { id: 'google-internship', title: 'Google Internship', shortTitle: 'Google Internship', kind: 'Internship', month: 'August', readiness: 25, description: 'Target a supervised AI engineering placement. Use your completed projects to explain your approach and its results.', skills: ['Applied ML', 'Collaboration', 'Technical writing'], x: 83, y: 24, opportunityId: 'orbit-summer' },
]

export const journey = {
  destination: 'AI Engineer',
  track: 'AI Engineering',
  campus: 'APU Student',
  readiness: 72,
  recommendedId: 'solution-challenge',
} as const

export interface Milestone {
  id: string
  month: string
  year: number
  label: string
  title: string
  description: string
  waypointId: string
}

export const milestones: Milestone[] = [
  { id: 'solution-challenge', month: 'November', year: 2026, label: 'Hackathon', title: 'Build a first team prototype', description: 'Pick a problem, scope a weekend-sized solution, and decide what you’ll show in a three-minute demo.', waypointId: 'solution-challenge' },
  { id: 'kaggle', month: 'December', year: 2026, label: 'Competition', title: 'Publish a competition notebook', description: 'Compare a simple baseline with one improvement and record the evaluation method.', waypointId: 'kaggle' },
  { id: 'tensorflow', month: 'January', year: 2027, label: 'Certification', title: 'Demonstrate TensorFlow skills', description: 'Train and evaluate a small model, then add a clear project write-up to your portfolio.', waypointId: 'tensorflow' },
  { id: 'internship-applications', month: 'March', year: 2027, label: 'Applications', title: 'Prepare internship applications', description: 'Use your project evidence to tailor a resume and prepare interview examples for each role.', waypointId: 'google-internship' },
  { id: 'internship-start', month: 'August', year: 2027, label: 'Internship start', title: 'Aim for an AI engineering placement', description: 'Set onboarding goals and agree how you’ll document the skills you gain during a placement.', waypointId: 'google-internship' },
]
