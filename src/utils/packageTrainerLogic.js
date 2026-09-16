export function isPackageLoaded(importedPackages, packageId) {
  const bank = importedPackages?.[packageId]
  return Boolean(bank) && Array.isArray(bank.questions) && bank.questions.length > 0
}

export function createPackageSession() {
  return {
    currentIndex: 0,
    isComplete: false,
    stats: {
      answered: 0,
      correct: 0,
      wrong: 0,
      freeText: { green: 0, yellow: 0, red: 0 },
    },
  }
}

export function getCurrentQuestion(packageBank, session) {
  return packageBank?.questions?.[session.currentIndex] ?? null
}

export function isLastPackageQuestion(packageBank, session) {
  const total = packageBank?.questions?.length ?? 0
  return total > 0 && session.currentIndex === total - 1
}

export function evaluateMcAnswer(question, selectedOption) {
  return selectedOption === question.correctAnswer
}

export function evaluateYesNoAnswer(question, selectedValue) {
  return selectedValue === question.correctAnswer
}

export function recordObjectiveAnswer(session, isCorrect) {
  session.stats.answered++
  if (isCorrect) session.stats.correct++
  else session.stats.wrong++
}

export function recordFreeTextEvaluation(session, rating) {
  session.stats.answered++
  if (rating in session.stats.freeText) session.stats.freeText[rating]++
}

export function advanceToNextQuestion(packageBank, session) {
  if (isLastPackageQuestion(packageBank, session)) return
  session.currentIndex++
}

export function finishPackageSession(session) {
  session.isComplete = true
}

export function resetPackageSession(session) {
  const fresh = createPackageSession()
  session.currentIndex = fresh.currentIndex
  session.isComplete = fresh.isComplete
  session.stats = fresh.stats
}
