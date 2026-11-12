export const REGISTRATION_ZONE: 'Asia/Kuala_Lumpur'
export const AGE_POLICY_VERSION: string
export const MINIMUM_AGE: 15
export function calendarDate(now?: Date): string
export function parseBirthday(value: unknown): {year:number; month:number; day:number} | null
export function birthdayCutoff(now?: Date, minimumAge?: number): string
export function ageEligibility(value: unknown, now?: Date): 'invalid' | 'underage' | 'eligible'
export function passwordAcceptable(password: unknown): boolean
