// Opt-in server/build diagnostic. Never prints keys, stores prompts or submits real resumes.
import { geminiConfig } from '../server/geminiConfig.mjs'
import { generate, requestJson } from '../server/integrations.mjs'
import { runLearning, learningInput } from '../server/learning.mjs'
import { parseLearningRequest } from '../shared/intent.mjs'
import { executeCareerTool } from '../server/careerTools.mjs'
import { research } from '../server/research.mjs'
if (process.argv.includes('--preview') && (process.env.VERCEL_ENV !== 'preview' || process.env.PATH4U_VERIFY_GEMINI !== '1')) process.exit(0)
const env = { ...process.env, GEMINI_SEARCH_ENABLED: 'false', GEMINI_PRIVATE_DATA_APPROVED: 'false' }
const config = geminiConfig(env)
const report = { event: 'gemini_verification', model: config.model, syntheticOnly: true, paidResearch: false, tests: [] }
const record = (name, details) => { report.tests.push({ name, ...details }); console.info(JSON.stringify({ event: 'gemini_check', name, ...details })) }
try {
  if (!config.configured) throw new Error('Missing key')
  const models = await requestJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } }, 'Gemini model listing')
  const model = models.models?.find(item => item.name === 'models/' + config.model && item.supportedGenerationMethods?.includes('generateContent'))
  if (!model) throw new Error('Configured model unavailable')
  record('Model available to this key', { passed: true, availableFlashModels:models.models.filter(item=>/flash/.test(item.name) && item.supportedGenerationMethods?.includes('generateContent')).map(item=>item.name) })
  const prompts = [
    'Hello, what can Path4U help me with?',
    'Create a 6-month cybersecurity roadmap.',
    'Build a beginner AI engineering roadmap.',
    'Find free Python courses.',
    'Recommend paid Coursera and Udemy cybersecurity courses.',
    'Explain computer networking.',
    'Create a study plan for learning Python.',
    'Find relevant upcoming hackathons.',
  ]
  for (const [index, message] of prompts.entries()) {
    if(process.env.PATH4U_VERIFY_PROMPTS && !process.env.PATH4U_VERIFY_PROMPTS.split(',').includes(String(index+1))) continue
    try {
    const parsed = parseLearningRequest(message)
    if (parsed.intent === 'roadmap') {
      const data = learningInput('roadmap', { goal: parsed.goal, durationWeeks: parsed.durationWeeks ?? 12, hours: 5, level: parsed.level ?? 'Beginner', skills: '', budget: 'Free and paid', preferences: 'Use synthetic public learning examples only.' })
      const plan = await runLearning('roadmap', data, env, true, AbortSignal.timeout(55_000))
      record('Prompt ' + (index + 1), { passed: plan.source === 'gemini' && plan.milestones.length >= 2, intent: parsed.intent, goal: plan.goal, phases: plan.milestones.length, actualGemini: true })
    } else if (parsed.intent === 'courses') {
      const result = await executeCareerTool('find_courses', { query: message }, { message, history: [] }, env, {})
      if (!result.resources.length) throw new Error('Course directory empty')
      record('Prompt ' + (index + 1), { passed: true, intent: parsed.intent, resources: result.resources.length, actualGemini: false, mode: 'Checked directory; live research disabled' })
    } else if (parsed.intent === 'research') {
      const result = await research(message, env)
      record('Prompt ' + (index + 1), { passed: result.state === 'unavailable', intent: parsed.intent, actualGemini: false, mode: 'Honest unavailable state; no current event verified' })
    } else {
      const reply = await generate(env, 'You are Path4U, a career and technology learning assistant. Answer the supplied synthetic question in helpful Markdown under 2000 characters. Do not invent links or claim current dates or availability.', { message, history: [{question: 'I am a beginner studying technology.',answer:'Which topic would you like to explore?'}] }, { answer: { type: 'STRING' } }, { maxOutputTokens: 2400 })
      if (typeof reply.answer !== 'string' || !reply.answer.trim()) throw new Error('Blank answer')
      record('Prompt ' + (index + 1), { passed: true, intent: parsed.intent, actualGemini: true, answerCharacters: reply.answer.length })
    }
    } catch(error) {record('Prompt '+(index+1),{passed:false,status:error.status ?? null,upstreamStatus:error.upstreamStatus ?? null,validationCode:error.validationCode ?? null,error:error.status?error.message:'Validation failed'})}
  }
  const passed=report.tests.every(item=>item.passed)
  if(!passed) process.exitCode=1
  console.info(JSON.stringify({ ...report, passed, scope: 'Server-side provider and learning engine; authentication/database require separate end-to-end verification.' }))
} catch (error) {
  console.error(JSON.stringify({ ...report, passed: false, status: error.status ?? null, error: error.status ? error.message : 'Gemini verification failed. Check model access, configuration and validation tests.' }))
  process.exitCode = 1
}
