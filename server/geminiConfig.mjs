// All Gemini model selection lives on the server. No provider calls at import time.
export function geminiConfig(env) {
 const model=(env.GEMINI_MODEL || 'gemini-3.1-flash-lite').replace(/^models\//,'')
 const researchModel=(env.GEMINI_RESEARCH_MODEL || model).replace(/^models\//,'')
 const valid=value=>/^gemini-[a-zA-Z0-9.-]+$/.test(value) || /^mock[-a-z]*$/.test(value)
 if(!valid(model) || !valid(researchModel)) throw new Error('Configure a valid Gemini model ID, not an API key or URL.')
 const legacyFreeSearch=/^gemini-2\.5-flash(?:-lite)?$/.test(researchModel) && new Date() < new Date('2026-12-01T00:00:00Z')
 return {model,researchModel,configured:Boolean(env.GEMINI_API_KEY),search:env.GEMINI_SEARCH_ENABLED==='true' && (legacyFreeSearch || env.GEMINI_SEARCH_BILLING_APPROVED==='true'),searchReason:env.GEMINI_SEARCH_ENABLED!=='true' ? 'Live research is not enabled.' : 'Google Search on this model requires a supported paid arrangement and explicit cost approval. Search has not been enabled.',privateAI:env.GEMINI_PRIVATE_DATA_APPROVED==='true' && Boolean(env.GEMINI_DATA_PROCESSING_REFERENCE?.trim())}
}
