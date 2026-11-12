export function roadmapFixture(input) {
  const split = Math.floor(input.durationWeeks / 2)
  const phase = (startWeek,endWeek,title) => ({ title, task: 'Practice ' + input.goal + ' in a local lab.', hours: (endWeek - startWeek + 1) * input.hours, startWeek, endWeek, skills: [input.goal], assignments: ['Document a repeatable exercise.'], project: 'Publish an annotated learning project.', completionCriteria:['Demonstrate the exercise independently and explain the decisions.'], lessons: ['Learn fundamentals', 'Complete the lab'], resourceIds: [] })
  return { overview: 'A learning plan for ' + input.goal, prerequisites: ['Basic computer use'], portfolio: ['Document your project and learning decisions.'], certifications: ['Investigate role-relevant credentials at official providers.'], nextSteps: ['Review the remaining skills gaps.'], milestones: [phase(1,split,'Foundations'),phase(split + 1,input.durationWeeks,'Practice and portfolio')] }
}
