import { courseCatalog } from './courseCatalog.mjs'
export const courses = [
  { id: 'python', title: 'The Python Tutorial', provider: 'Python Software Foundation', topic: 'Programming', kind: 'Tutorial', url: 'https://docs.python.org/3/tutorial/' },
  { id: 'mdn', title: 'Learn web development', provider: 'MDN', topic: 'Web development', kind: 'Learning path', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development' },
  { id: 'google-ml', title: 'Machine Learning Crash Course', provider: 'Google for Developers', topic: 'Machine learning', kind: 'Course', url: 'https://developers.google.com/machine-learning/crash-course' },
  { id: 'azure', title: 'Training for Azure', provider: 'Microsoft Learn', topic: 'Cloud computing', kind: 'Training catalog', url: 'https://learn.microsoft.com/en-us/training/azure/' },
  ...courseCatalog.map(course => ({ ...course, kind: 'Course', checkedAt: '2026-11-11' })),
]
export const demoCosts = { roadmap: 3, assistant: 1, mindMap: 2 }

export function curatedRoadmap({ goal, level, hours, skills, budget }) {
  const web = /\b(web|front.?end|react|javascript|full.?stack)\b/i.test(goal)
  const ml = /\b(ai|machine learning|data scien|data analy|python)/i.test(goal)
  const cloud = /\b(cloud|azure|devops|infrastructure)\b/i.test(goal)
  const foundation = web ? 'Build an accessible HTML page and style it with CSS.' : ml ? 'Load and inspect a public dataset with Python.' : cloud ? 'Diagram a simple cloud deployment and explain its core services.' : 'Compare three role descriptions and list the recurring skills.'
  const practice = web ? 'Build an interactive page that validates a form and handles loading and empty states.' : ml ? 'Train a baseline on a public dataset and evaluate it on held-out examples.' : cloud ? 'Follow a Microsoft Learn exercise and record how access and resources are configured.' : 'Choose one recurring skill and complete a small project with a reproducible result.'
  const advanced = /intermediate|advanced/i.test(level)
  return {
    goal, level, hours, skills, budget, source: 'guided',
    milestones: [
      { title: advanced ? 'Assess your baseline' : 'Build the foundation', task: advanced ? 'Document what you can already do with ' + (skills || 'your current skills') + '. Test one weak area in a small exercise.' : foundation, hours, resource: web ? 'mdn' : ml ? 'python' : cloud ? 'azure' : '', done: false },
      { title: 'Practice on a real project', task: practice, hours: hours * 2, resource: web ? 'mdn' : ml ? 'google-ml' : cloud ? 'azure' : '', done: false },
      { title: 'Publish the evidence', task: 'Write a concise case study with your goal, approach, a result you can demonstrate, and one improvement.', hours, resource: '', done: false },
      { title: 'Prepare for your next opportunity', task: 'Compare the project with a current role description. Record one remaining gap and set a follow-up task.', hours, resource: '', done: false },
    ],
  }
}

export function roadmapProgress(plan) {
  const milestones = plan?.milestones ?? []
  const lessons = milestones.flatMap(item => item.lessons?.length ? item.lessons : [{done:item.done}])
  return { complete: lessons.filter(item => item.done).length, total: lessons.length, unit: milestones.some(item => item.lessons?.length) ? 'learning tasks' : 'milestones' }
}
