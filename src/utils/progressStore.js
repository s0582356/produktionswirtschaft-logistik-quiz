const PROGRESS_KEY_PREFIX = 'pwl-quiz-progress:v1:'

function hashString(value) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

export function getQuestionId(question, index = 0) {
  return String(question.id ?? `question-${index + 1}`)
}

export function createBankFingerprint(type, questions) {
  const identity = questions.map((question, index) => [
    getQuestionId(question, index),
    question.question || '',
  ])

  return `${type}-${questions.length}-${hashString(JSON.stringify(identity))}`
}

export function getProgressStorageKey(bankId) {
  return `${PROGRESS_KEY_PREFIX}${bankId}`
}

export function createEmptyProgress(type, totalQuestions) {
  return {
    version: 1,
    type,
    currentIndex: 0,
    currentQuestionId: null,
    answeredQuestionIds: [],
    questions: {},
    totals: {
      questions: totalQuestions,
      answered: 0,
      green: 0,
      yellow: 0,
      red: 0,
      open: totalQuestions,
      attempts: 0,
    },
    lastPracticedAt: null,
  }
}

export function calculateProgressTotals(progress, totalQuestions) {
  const records = Object.values(progress.questions || {})
  const totals = {
    questions: totalQuestions,
    answered: records.length,
    green: 0,
    yellow: 0,
    red: 0,
    open: Math.max(0, totalQuestions - records.length),
    attempts: 0,
  }

  records.forEach((record) => {
    if (record.lastStatus in totals) totals[record.lastStatus]++
    totals.attempts += Number(record.attempts) || 0
  })

  return totals
}

export function loadProgress(bankId, type, totalQuestions) {
  const emptyProgress = createEmptyProgress(type, totalQuestions)

  try {
    const stored = JSON.parse(window.localStorage.getItem(getProgressStorageKey(bankId)))
    if (!stored || stored.version !== 1 || stored.type !== type) return emptyProgress

    const progress = {
      ...emptyProgress,
      ...stored,
      answeredQuestionIds: Array.isArray(stored.answeredQuestionIds)
        ? stored.answeredQuestionIds.map(String)
        : Object.keys(stored.questions || {}),
      questions: stored.questions && typeof stored.questions === 'object'
        ? stored.questions
        : {},
    }

    progress.totals = calculateProgressTotals(progress, totalQuestions)
    return progress
  } catch {
    return emptyProgress
  }
}

export function saveProgress(bankId, progress, totalQuestions) {
  const progressToSave = {
    ...progress,
    totals: calculateProgressTotals(progress, totalQuestions),
  }

  window.localStorage.setItem(
    getProgressStorageKey(bankId),
    JSON.stringify(progressToSave),
  )

  return progressToSave
}

export function removeProgress(bankId) {
  window.localStorage.removeItem(getProgressStorageKey(bankId))
}

export function getBetterStatus(currentStatus, nextStatus) {
  const rank = { red: 1, yellow: 2, green: 3 }
  if (!currentStatus || rank[nextStatus] > rank[currentStatus]) return nextStatus
  return currentStatus
}
