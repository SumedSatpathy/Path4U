export interface Course { id: string; title: string; provider: string; topic: string; kind: string; url: string; discovery?: string; instructor?: string; level?: string; skills?: string[]; cost?: string; alternative?: string; checkedAt?: string }
export type LearningAction = 'roadmap' | 'assistant' | 'mindMap'
export interface RoadmapInput { goal: string; level: string; hours: number; skills: string; budget: string; durationWeeks?: number; preferences?: string }
export interface Milestone { title: string; task: string; hours: number; resource: string; done: boolean; startWeek?: number; endWeek?: number; skills?: string[]; assignments?: string[]; project?: string; completionCriteria?: string[]; resourceIds?: string[]; lessons?: {id: string; title: string; done: boolean}[] }
export interface Roadmap extends RoadmapInput { source: 'guided' | 'gemini'; milestones: Milestone[]; overview?: string; prerequisites?: string[]; portfolio?: string[]; nextSteps?: string[]; certifications?: string[]; resources?: Course[]; platformSearches?: {title:string;url:string}[]; researchNote?: string; research?: {state:string;suggestions?:string;sources:{title:string;url:string}[];checkedAt?:string} }
export interface SavedRoadmap extends Roadmap { id: string }
export interface MindNode { id: string; label: string; parent: string | null }
export interface AssistantReply { answer: string; proposal?: string }
export const courses: Course[]
export const demoCosts: Record<LearningAction, number>
export function curatedRoadmap(input: RoadmapInput): Roadmap

export function roadmapProgress(plan?: Roadmap): {complete:number;total:number;unit:string}
