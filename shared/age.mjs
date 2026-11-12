export const REGISTRATION_ZONE = 'Asia/Kuala_Lumpur'
export const AGE_POLICY_VERSION = 'my-15-v2'
export const MINIMUM_AGE = 15

export function calendarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: REGISTRATION_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-')
}

export function parseBirthday(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(value + 'T00:00:00Z')
  if (year < 1 || Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null
  return { year, month, day }
}

export function birthdayCutoff(now = new Date(), minimumAge = MINIMUM_AGE) {
  const [year, month, day] = calendarDate(now).split('-').map(Number)
  const cutoffYear = year - minimumAge
  const end = new Date(Date.UTC(cutoffYear, month, 0)).getUTCDate()
  return [cutoffYear, month, Math.min(day, end)].map(part => String(part).padStart(2, '0')).join('-')
}

export function ageEligibility(value, now = new Date()) {
  if (!parseBirthday(value) || value > calendarDate(now)) return 'invalid'
  return value <= birthdayCutoff(now) ? 'eligible' : 'underage'
}

export function passwordAcceptable(password) {
  return typeof password === 'string' && password.length >= 12 && new TextEncoder().encode(password).length <= 72
}
