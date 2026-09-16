function shuffle(items, random) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] } return copy }
export function createTopicCheck(packageBanksById, checkSize = 1, random = Math.random) {
  const banks = Object.values(packageBanksById || {}).sort((a, b) => a.packageId.localeCompare(b.packageId))
  const globalTypes = new Map()
  const queues = banks.map((bank) => {
    const chosen = []
    const remaining = shuffle(bank.questions, random)
    while (chosen.length < checkSize && remaining.length) {
      const types = [...new Set(remaining.map((q) => q.questionType))]
      const type = shuffle(types, random).sort((a, b) => (globalTypes.get(a) || 0) - (globalTypes.get(b) || 0))[0]
      const index = remaining.findIndex((q) => q.questionType === type)
      const question = remaining.splice(index, 1)[0]
      chosen.push({ packageId: bank.packageId, questionId: question.questionId })
      globalTypes.set(type, (globalTypes.get(type) || 0) + 1)
    }
    return chosen
  })
  const orderedQuestionRefs = []
  while (queues.some((queue) => queue.length)) {
    shuffle(queues.filter((queue) => queue.length), random).forEach((queue) => orderedQuestionRefs.push(queue.shift()))
  }
  return { checkSize: Number(checkSize), orderedQuestionRefs }
}
export function topicCheckStats(orderedQuestionRefs, answers) {
  const reached = new Set(Object.keys(answers || {}).map((key) => key.split('::')[0]))
  const packages = new Set((orderedQuestionRefs || []).map((ref) => ref.packageId))
  return { reached, packages }
}
