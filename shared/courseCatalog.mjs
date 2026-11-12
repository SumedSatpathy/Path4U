// Provider pages checked 2026-11-11. Fees and availability are always checked at the provider.
export const courseCatalog = [
  { id: 'google-cyber', title: 'Google Cybersecurity Professional Certificate', provider: 'Coursera', instructor: 'Google', topic: 'Cybersecurity', level: 'Beginner', skills: ['Network security', 'Linux', 'Python', 'SQL'], cost: 'Paid credential; check provider pricing', url: 'https://www.coursera.org/professional-certificates/google-cybersecurity/', alternative: 'cisco-cyber' },
  { id: 'udemy-cyber', title: 'Cyber Security: From Beginner to Expert', provider: 'Udemy', instructor: 'Logix Academy', topic: 'Cybersecurity', level: 'Beginner', skills: ['Network security', 'Security fundamentals'], cost: 'Paid; check provider pricing', url: 'https://www.udemy.com/course/cybersecurity-from-beginner-to-expert/', alternative: 'cisco-cyber' },
  { id: 'cisco-cyber', title: 'Introduction to Cybersecurity', provider: 'Cisco Networking Academy', instructor: 'Cisco', topic: 'Cybersecurity networking', level: 'Beginner', skills: ['Threats', 'Data protection', 'Cybersecurity careers'], cost: 'Free learning', url: 'https://www.netacad.com/courses/introduction-to-cybersecurity' },
  { id: 'coursera-ml', title: 'Machine Learning Specialization', provider: 'Coursera', instructor: 'DeepLearning.AI and Stanford Online', topic: 'AI engineering machine learning data science', level: 'Beginner', skills: ['Python', 'Supervised learning', 'Neural networks'], cost: 'Paid credential; check provider pricing', url: 'https://www.coursera.org/specializations/machine-learning-introduction', alternative: 'google-ml' },
  { id: 'udemy-ml', title: 'Machine Learning A-Z: ML, DL, AI with AWS, Python & R', provider: 'Udemy', instructor: 'Kirill Eremenko, Hadelin de Ponteves and team', topic: 'AI engineering machine learning data science', level: 'Beginner', skills: ['Python', 'Model evaluation', 'Machine learning'], cost: 'Paid; check provider pricing', url: 'https://www.udemy.com/course/machinelearning/', alternative: 'google-ml' },
  { id: 'fcc-python', title: 'Scientific Computing with Python', provider: 'freeCodeCamp', instructor: 'freeCodeCamp', topic: 'Python software programming', level: 'Beginner', skills: ['Python', 'Problem solving'], cost: 'Free learning', url: 'https://www.freecodecamp.org/learn/scientific-computing-with-python/' },
]

export function platformSearches(goal) {
  const query = encodeURIComponent(goal)
  return [
    { title: 'Search Coursera for ' + goal, url: 'https://www.coursera.org/search?query=' + query },
    { title: 'Search Udemy for ' + goal, url: 'https://www.udemy.com/courses/search/?q=' + query },
  ]
}
