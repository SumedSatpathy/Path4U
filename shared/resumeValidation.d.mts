import type { ResumeProfile } from './resume.mjs'
export const requiredResumeFields: (keyof ResumeProfile)[]
export const resumeHints: Partial<Record<keyof ResumeProfile,string>>
export function validateResume(profile: Partial<ResumeProfile>): Partial<Record<keyof ResumeProfile,string>>
export function resumeCompletion(profile: ResumeProfile): number
export function validateResumeDocument(content:string):string
