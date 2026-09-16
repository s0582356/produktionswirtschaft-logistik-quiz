export const ROUND_SIZES = { quick: 10, normal: 20, all: 'all' }
export const QUESTION_TYPE_FILTERS = ['mixed', 'mc', 'yesNo', 'freeText']

function shuffle(items, random) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

function targetCount(sessionSize, available) {
  if (sessionSize === 'all') return available
  const requested = Number(sessionSize)
  return Number.isInteger(requested) && requested > 0 ? Math.min(requested, available) : available
}

function interleaveByType(questions, random) {
  const groups = new Map()
  shuffle(questions, random).forEach((question) => {
    const type = question.questionType
    groups.set(type, [...(groups.get(type) || []), question])
  })

  const result = []
  let previousType = null
  while ([...groups.values()].some((items) => items.length)) {
    const hasAlternativeType = [...groups.entries()].some(([type, items]) => type !== previousType && items.length)
    const candidates = [...groups.entries()]
      .filter(([type, items]) => items.length && (!hasAlternativeType || type !== previousType))
    const largest = Math.max(...candidates.map(([, items]) => items.length))
    const type = shuffle(candidates.filter(([, items]) => items.length === largest), random)[0][0]
    result.push(groups.get(type).pop())
    previousType = type
  }
  return result
}

export function createPackageRound(questions, { sessionSize = ROUND_SIZES.normal, questionTypeFilter = 'mixed' } = {}, random = Math.random) {
  const validQuestions = Array.isArray(questions) ? questions : []
  const filtered = questionTypeFilter === 'mixed'
    ? validQuestions
    : validQuestions.filter((question) => question.questionType === questionTypeFilter)
  const count = targetCount(sessionSize, filtered.length)
  let selected

  if (questionTypeFilter === 'mixed') {
    const groups = new Map()
    filtered.forEach((question) => groups.set(question.questionType, [...(groups.get(question.questionType) || []), question]))
    const coverage = shuffle([...groups.values()].filter((items) => items.length).map((items) => shuffle(items, random)[0]), random)
    const remaining = shuffle(filtered.filter((question) => !coverage.includes(question)), random)
    selected = [...coverage, ...remaining].slice(0, count)
    selected = interleaveByType(selected, random)
  } else {
    selected = shuffle(filtered, random).slice(0, count)
  }

  return {
    sessionSize: sessionSize === 'all' ? 'all' : Number(sessionSize),
    questionTypeFilter: QUESTION_TYPE_FILTERS.includes(questionTypeFilter) ? questionTypeFilter : 'mixed',
    orderedQuestionIds: selected.map((question) => String(question.questionId)),
  }
}

export function getRoundLabel(sessionSize) {
  return sessionSize === 'all' ? 'Komplettes Paket' : `${sessionSize}-Fragen-Runde`
}

export function getFilterLabel(questionTypeFilter) {
  return {
    mixed: 'Gemischt', mc: 'Nur Multiple Choice', yesNo: 'Nur Ja/Nein', freeText: 'Nur Freitext',
  }[questionTypeFilter] || 'Gemischt'
}
