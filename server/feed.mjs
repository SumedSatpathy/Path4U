const greenhouseApi = 'https://boards-api.greenhouse.io/v1/boards/'
const approvedHosts = new Set(['boards.greenhouse.io', 'job-boards.greenhouse.io'])
const boardPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/

function readApprovedBoards(env) {
  const entries = (env.OPENPATH_GREENHOUSE_BOARDS ?? '').split(',').map(value => value.trim()).filter(Boolean)
  if (entries.some(board => !boardPattern.test(board))) throw new Error('Invalid Greenhouse board configuration')
  return [...new Set(entries)]
}

async function readGreenhouse(url, signal) {
  const response = await fetch(url, { redirect: 'error', signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Greenhouse feed request failed')
  return response.json()
}

function approvedSource(value, board, id) {
  if (typeof value !== 'string') return null
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  const path = `/${board}/jobs/${id}`
  if (url.protocol !== 'https:' || !approvedHosts.has(url.hostname) || url.port || url.username || url.password) return null
  if (url.pathname !== path && url.pathname !== path + '/') return null
  return url.origin + path
}

async function readBoard(board) {
  const url = greenhouseApi + board
  const signal = AbortSignal.timeout(6000)
  const [info, data] = await Promise.all([readGreenhouse(url, signal), readGreenhouse(url + '/jobs', signal)])
  const organization = typeof info?.name === 'string' ? info.name.trim() : ''
  if (!organization || !Array.isArray(data?.jobs)) throw new Error('Invalid Greenhouse feed response')

  const results = new Map()
  for (const job of data.jobs) {
    if (!job || !Number.isSafeInteger(job.id) || job.id <= 0 || job.internal_job_id === null || typeof job.title !== 'string') continue
    const title = job.title.trim()
    const sourceUrl = approvedSource(job.absolute_url, board, job.id)
    if (!title || !sourceUrl) continue
    const id = `greenhouse:${board}:${job.id}`
    const location = typeof job.location?.name === 'string' ? job.location.name.trim() : ''
    results.set(id, { id, title, organization, location, sourceUrl })
  }
  return [...results.values()]
}

export function approvedFeedConfigured(env = process.env) {
  try {
    return readApprovedBoards(env).length > 0
  } catch {
    return false
  }
}

export async function getApprovedFeed(env = process.env) {
  const results = await Promise.all(readApprovedBoards(env).map(readBoard))
  return results.flat()
}
