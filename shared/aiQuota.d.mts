export interface DemoQuota { day: string; resetAt: string; serverNow: string; limit: number; unitCost: number; session?: string }
export interface DemoBalance { credits: number | null; liveAI?: boolean; quota?: DemoQuota }
export const aiLimits: Readonly<{guestDaily:number;accountDaily:number;accountRoadmaps:number;globalDaily:number;globalMinute:number;sessionMints:number;sessionMintWindowMs:number;modelDaily:number;modelMinute:number;modelInputMinute:number}>
export function utcQuotaWindow(now?: number): DemoQuota
export function mergeDemoBalance(current: DemoBalance | null, next: DemoBalance): DemoBalance

export function providerQuotaWindow(now?: number): {day:string;resetAt:string}
