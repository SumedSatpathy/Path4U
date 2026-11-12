import { ApiError } from './integrations.mjs'
import { requireAccount, requireResult, supabase } from './auth.mjs'

const types = new Set(['draft', 'conversation'])
const templates = new Set(['Classic Professional', 'Modern Technical', 'Student & Graduate'])
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i

function entryValue(kind, value) {
  if (!value || typeof value !== 'object' || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 120) throw new ApiError(400, 'Enter a title under 120 characters.')
  if (kind === 'draft') {
    if (!templates.has(value.template) || typeof value.content !== 'string' || !value.content.trim() || value.content.length > 20_000) throw new ApiError(400, 'Check the draft content and layout.')
    return { title: value.title.trim(), template: value.template, content: value.content }
  }
  if (!Array.isArray(value.turns) || value.turns.length > 10) throw new ApiError(400, 'Keep at most ten turns in each saved conversation.')
  const turns = value.turns.map(turn => {
    if (!turn || !uuid.test(turn.id ?? '') || typeof turn.question !== 'string' || turn.question.length > 1500 || typeof turn.answer !== 'string' || turn.answer.length > 5500 || typeof turn.at !== 'string' || !Number.isFinite(Date.parse(turn.at))) throw new ApiError(400, 'The conversation has an invalid message.')
    const sources = Array.isArray(turn.sources) ? turn.sources.slice(0, 10).filter(source => {
      try { const url = new URL(source.url); return url.protocol === 'https:' && !url.username && !url.password && typeof source.title === 'string' } catch { return false }
    }).map(source => ({ title: source.title.slice(0,180), url: source.url.slice(0,1500) })) : undefined
    const tools = Array.isArray(turn.tools) ? turn.tools.slice(0,1).filter(tool => ['review_resume','build_resume','create_roadmap','search_opportunities','find_courses'].includes(tool.name) && ['completed','needs_input','no_results'].includes(tool.status)).map(tool => ({name:tool.name,status:tool.status})) : undefined
    const optional = (key, max) => typeof turn[key] === 'string' ? turn[key].slice(0, max) : undefined
    const planInputs = turn.planInputs && typeof turn.planInputs === 'object' ? { hours: Number.isSafeInteger(turn.planInputs.hours) && turn.planInputs.hours >= 1 && turn.planInputs.hours <= 40 ? turn.planInputs.hours : undefined, durationWeeks: Number.isSafeInteger(turn.planInputs.durationWeeks) && turn.planInputs.durationWeeks >= 2 && turn.planInputs.durationWeeks <= 104 ? turn.planInputs.durationWeeks : undefined, level: ['Beginner','Intermediate','Advanced'].includes(turn.planInputs.level) ? turn.planInputs.level : undefined } : undefined
    return { suggestions: optional('suggestions',40000), planInputs, sources, tools, id: turn.id, question: turn.question, answer: turn.answer, at: new Date(turn.at).toISOString(), proposal: optional('proposal', 100), attachment: optional('attachment', 180), title: optional('title', 120), artifact: ['text', 'document', 'roadmap', 'flowchart', 'mindmap'].includes(turn.artifact) ? turn.artifact : undefined }
  })
  return { title: value.title.trim(), turns }
}

export async function libraryRequest(request, env, kind, input) {
  const { user, token } = await requireAccount(request, env)
  if (!types.has(kind)) throw new ApiError(400, 'Choose drafts or conversations.')
  const root = '/rest/v1/openpath_library'
  const query = '?user_id=eq.' + encodeURIComponent(user.id) + '&kind=eq.' + kind
  if (!input) return requireResult(await supabase(env, root + query + '&select=id,value,updated_at&order=updated_at.desc&limit=30', { token }), 'Saved items could not be loaded.')
  if (typeof input.id !== 'string' || !uuid.test(input.id)) throw new ApiError(400, 'Invalid library item.')
  if (input.remove === true) {
    requireResult(await supabase(env, root + query + '&id=eq.' + input.id, { token, method: 'DELETE' }), 'The item could not be removed.')
    return { removed: true }
  }
  const value = entryValue(kind, input.value)
  while (kind === 'conversation' && Buffer.byteLength(JSON.stringify(value)) > 80_000 && value.turns.length > 1) value.turns.shift()
  if (Buffer.byteLength(JSON.stringify(value)) > 80_000) throw new ApiError(400, 'This item is too long to save.')
  const result = await supabase(env, root + '?on_conflict=user_id,kind,id&select=id,value,updated_at', {
    token, method: 'POST', prefer: 'resolution=merge-duplicates,return=representation',
    body: { user_id: user.id, kind, id: input.id, value, updated_at: new Date().toISOString() },
  })
  if (result.data?.message === 'Library item limit reached') throw new ApiError(409, 'Remove an older saved item before adding another.')
  const [entry] = requireResult(result, 'The item could not be saved.') ?? []
  if (!entry) throw new ApiError(502, 'The save could not be confirmed.')
  return entry
}
