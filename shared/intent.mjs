const text = value => typeof value === 'string' ? value.trim() : ''

export function parseLearningRequest(message, history = [], fallbackGoal = '') {
  const current = text(message)
  const numbers={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12}
  const normalize=value=>value.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?=[ -](?:month|week|hour))/gi,word=>String(numbers[word.toLowerCase()]))
  const normalized=normalize(current)
  const previous = history.filter(turn => typeof turn?.question === 'string').map(turn => turn.question).slice(-5)
  const roadmap = /\broad\s?map\b|\bstudy\s+plan\b|\blearning\s+plan\b/i.test(current)
  const prior = [...previous].reverse().find(question => /road\s?map|study plan|learning plan/i.test(question)) || ''
  const context = normalize(roadmap || !prior ? current : current + ' ' + prior)
  const levelText = /advanced|intermediate|beginner|from scratch/i.test(current) ? current : context
  const months = context.match(/\b(\d{1,2})[ -]months?\b/i)
  const weeks = context.match(/\b(\d{1,2})[ -]weeks?\b/i)
  const hours = context.match(/\b(\d{1,2})\s*(?:study\s*)?hours?\s*(?:per\s*week|a\s*week|weekly|\/week)/i)
  let goal = normalized
    .replace(/^[\s]*(?:please\s+)?(?:create|make|build|generate|plan|design|give|recommend)(?:\s+(?:me|a|an|my|personalized|personalised))*\s+/i, '')
    .replace(/\b(?:a\s+)?\d{1,2}[ -](?:month|week)s?\b/gi, '')
    .replace(/\b(?:career\s+|learning\s+|study\s+)?(?:road\s?map|study\s+plan|learning\s+plan)\b/gi, '')
    .replace(/\s+(?:for\s+(?:a\s+)?(?:complete\s+)?beginner|with\s+\d|at\s+\d|for\s+\d|using\s+\d).*$/i, '')
    .replace(/^(?:for|to become|to learn)\s+/i, '')
    .replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim().replace(/^(?:for|to become|to learn)\s+/i, '').replace(/^(?:a\s+)?(?:beginner|intermediate|advanced|learning)\s+/i, '')
  if (!roadmap && prior) goal = parseLearningRequest(prior, [], fallbackGoal).goal
  if (!goal || /^(?:it|that|this|one|please)$/i.test(goal)) goal = text(fallbackGoal)
  const durationWeeks = weeks ? Number(weeks[1]) : months ? Math.round(Number(months[1]) * 52 / 12) : undefined
  return {
    intent: roadmap || prior && /\b(?:make it|change|hours|months|weeks|easier|harder)\b/i.test(current) ? 'roadmap' : /\bcourses?|tutorials?|certifications?\b/i.test(current) ? 'courses' : /\bhackathons?|internships?|workshops?|jobs?|events?\b/i.test(current) && /find|search|discover|beginner/i.test(current) ? 'research' : /\b(?:research|search|latest|current)\b/i.test(current) ? 'research' : 'guidance',
    goal: goal.slice(0, 100),
    hours: hours ? Math.max(1, Math.min(40, Number(hours[1]))) : undefined,
    durationWeeks: durationWeeks && durationWeeks >= 1 && durationWeeks <= 104 ? durationWeeks : undefined,
    level: /advanced/i.test(levelText) ? 'Advanced' : /intermediate/i.test(levelText) ? 'Intermediate' : /beginner|from scratch/i.test(levelText) ? 'Beginner' : undefined,
  }
}
