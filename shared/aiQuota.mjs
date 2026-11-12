// App days use UTC. Provider days deliberately use a separate Pacific calendar.
export const aiLimits = Object.freeze({ guestDaily: 4, accountDaily: 12, accountRoadmaps: 2, globalDaily: 80, globalMinute: 4, sessionMints: 120, sessionMintWindowMs: 600000, modelDaily: 400, modelMinute: 10, modelInputMinute: 200000 })
export function utcQuotaWindow(now = Date.now()) {
  const date = new Date(now)
  return { day: date.toISOString().slice(0, 10), resetAt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)).toISOString(), serverNow: date.toISOString(), limit: aiLimits.guestDaily, unitCost: 1 }
}
export function mergeDemoBalance(current, next) {
  if (!next.quota || !current?.quota) return next
  if (next.quota.serverNow < current.quota.serverNow) return current
  if (next.quota.session !== current.quota.session) return next
  if (next.quota.day < current.quota.day) return current
  if (next.quota.day > current.quota.day) return next
  return { ...next, credits: Math.min(current.credits ?? next.credits, next.credits) }
}

export function providerQuotaWindow(now = Date.now()) {
  const format = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'})
  const dayAt = value => format.format(new Date(value))
  const day = dayAt(now)
  let low = Math.floor(now / 1000), high = low + 26 * 3600
  // Find the next Pacific calendar boundary, including 23/25-hour DST days.
  while (high - low > 1) { const middle = Math.floor((high + low) / 2); if (dayAt(middle * 1000) === day) low = middle; else high = middle }
  return {day, resetAt:new Date(high * 1000).toISOString()}
}
