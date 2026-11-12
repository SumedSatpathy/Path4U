const host = 'https://hacker-news.firebaseio.com/v0/'
let cache = null

async function json(path) {
  const response = await fetch(host + path + '.json', { signal: AbortSignal.timeout(6500) })
  if (!response.ok) throw new Error('Hacker News request failed')
  return response.json()
}

export async function getDeveloperNews() {
  if (cache && cache.until > Date.now()) return cache.stories
  const ids = await json('topstories')
  const results = await Promise.allSettled(ids.slice(0, 12).filter(Number.isSafeInteger).map(id => json('item/' + id)))
  const stories = results.flatMap(result => {
    if (result.status !== 'fulfilled') return []
    const item = result.value
    if (!item || typeof item.title !== 'string' || !Number.isSafeInteger(item.id) || !Number.isFinite(item.time) || item.time < 1 || item.time > 8e12 || item.deleted || item.dead) return []
    return [{ id: item.id, title: item.title, author: item.by ?? 'Hacker News', published: new Date(item.time * 1000).toISOString(), url: 'https://news.ycombinator.com/item?id=' + item.id }]
  })
  if (!stories.length && results.some(result => result.status === 'rejected')) throw new Error('Hacker News unavailable')
  cache = { until: Date.now() + 300_000, stories }
  return stories
}
