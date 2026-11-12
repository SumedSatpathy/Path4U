export const roleOptions: string[]
export type ResumeProfile = Record<'name' | 'email' | 'phone' | 'city' | 'linkedin' | 'github' | 'portfolio' | 'role' | 'level' | 'industry' | 'summary' | 'education' | 'work' | 'internships' | 'projects' | 'technical' | 'soft' | 'certifications' | 'achievements' | 'languages' | 'volunteer' | 'job' | 'template', string>
export type ResumeEdit = { id: number; before: string; after: string; reason: string }
export type ResumeReview = { score: number; missingInfo: string[]; careerStage: string; rubric: { label: string; weight: number; score: number; note: string; evidence: string[] }[]; matched: string[]; missing: string[]; evidence: number; headings: number; long: number; edits: ResumeEdit[] }
export function buildResume(profile: ResumeProfile): string
export function reviewResume(content: string, role: string, job?: string, careerStage?: string): ResumeReview
export function applyResumeEdits(content: string, edits: ResumeEdit[], accepted: number[]): string
