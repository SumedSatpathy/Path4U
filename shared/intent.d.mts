export type LearningIntent = { intent: 'roadmap' | 'courses' | 'research' | 'guidance'; goal: string; hours?: number; durationWeeks?: number; level?: string }
export function parseLearningRequest(message: string, history?: { question: string }[], fallbackGoal?: string): LearningIntent
