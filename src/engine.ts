import { opportunities, type Opportunity } from './data'
import type { Profile } from './workspace'

export interface Analysis {
  skills: string[]
  evidence: string[]
}

export interface ApplicationDraft { resume: string; cover: string; email: string; subject: string }

const skillVocabulary = [...new Set(opportunities.flatMap(item => item.skills))]
const skillAliases: Record<string, string[]> = { 'Machine Learning': ['machine learning', 'scikit-learn', 'tensorflow'], 'Data Visualization': ['data visualization', 'tableau', 'power bi'] }

function normalize(value: string) {
  return value.toLocaleLowerCase('en').normalize('NFKC')
}

function terms(value: string) {
  return normalize(value).match(/[\p{L}\p{N}+#.-]+/gu)?.map(term => term.replace(/^[.-]+|[.-]+$/g, '')) ?? []
}

function containsTerm(text: string, term: string) {
  const full = ' ' + terms(text).join(' ') + ' '
  return full.includes(' ' + terms(term).join(' ') + ' ')
}

export const sampleResume = 'Software engineering student based in Kuala Lumpur. Available for a six-month internship.\n\nBuilt a React and TypeScript campus events dashboard with keyboard navigation.\nDeveloped a Python and SQL reporting script for a student organization.\nUsed Git and Docker to collaborate and package a student project.'

export function analyzeLocally(resume: string): Analysis {
  return {
    skills: skillVocabulary.filter(skill => (skillAliases[skill] ?? [skill]).some(term => containsTerm(resume, term))),
    evidence: resume.split(/\n|(?<=\.)\s/).map(line => line.trim()).filter(line => line.length > 24).slice(0, 5).map(line => line.slice(0, 240)),
  }
}

export function rankOpportunity(opportunity: Opportunity, candidate: Analysis, profile: Profile) {
  const candidateVector = skillVocabulary.map(skill => Number(candidate.skills.some(candidateSkill => normalize(candidateSkill) === normalize(skill))))
  const roleVector = skillVocabulary.map(skill => Number(opportunity.skills.includes(skill)))
  const matched = opportunity.skills.filter(skill => candidateVector[skillVocabulary.indexOf(skill)] === 1)
  const gaps = opportunity.skills.filter(skill => !matched.includes(skill))
  const dotProduct = candidateVector.reduce((total, value, index) => total + value * roleVector[index], 0)
  const magnitude = Math.sqrt(candidateVector.reduce((sum, value) => sum + value, 0) * roleVector.reduce((sum, value) => sum + value, 0))
  const score = Math.round((magnitude ? dotProduct / magnitude : 0) * 100)
  const requirements = [
    { label: 'Career stage', pass: opportunity.audience === 'Open to all' || (opportunity.audience === 'Students' && profile.stage === 'Student') || (opportunity.audience === 'Graduates' && profile.stage === 'Graduate') },
    { label: 'Available duration', pass: !opportunity.durationMonths || profile.months >= opportunity.durationMonths },
    { label: 'Location preference', pass: opportunity.format === 'Remote' || profile.location === 'Any location' || profile.location === opportunity.location },
  ]
  return { opportunity, matched, gaps, score, requirements, reviewCount: requirements.filter(item => !item.pass).length }
}

export function buildLocalDraft(opportunity: Opportunity, analysis: Analysis, profile: Profile): ApplicationDraft {
  const { matched, gaps } = rankOpportunity(opportunity, analysis, profile)
  const evidence = analysis.evidence.find(line => matched.some(skill => containsTerm(line, skill)))
  const resume = [
    'Emphasize these skills where your résumé already demonstrates them: ' + (matched.join(', ') || '[add relevant skills you can substantiate]') + '.',
    'Place your strongest relevant project near the top. Describe the work, your contribution, and a result you can verify.',
    ...(evidence ? ['Candidate evidence to adapt: ' + evidence] : []),
    ...(gaps.length ? ['Review these requested skills: ' + gaps.join(', ') + '. Include them only if you have experience to support them.'] : []),
  ].join('\n\n')
  const contribution = matched.length
    ? 'My résumé includes work with ' + matched.join(', ') + '. [Add a verified example of how you used these skills and what you delivered.]'
    : '[Add a project or experience that shows why you’re a good fit.]'
  return {
    resume,
    subject: 'Application for ' + opportunity.title,
    cover: 'Dear ' + opportunity.organization + ' team,\n\nI’m interested in the ' + opportunity.title + ' opportunity. ' + contribution +
      '\n\n[Explain what draws you to the work and how you would contribute.]\n\nThank you for considering my application.\n\n' + profile.name,
    email: 'Hello ' + opportunity.organization + ' team,\n\nI’m writing to express interest in the ' + opportunity.title +
      ' opportunity. [Add a short, verified example of relevant experience and a link to your work if requested.]\n\nThank you,\n' + profile.name,
  }
}
