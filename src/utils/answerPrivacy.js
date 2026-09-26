// Shared write-time/read-time sanitization for per-question answer records that get
// persisted in localStorage (package progress, topic check, exam sessions).
//
// Privacy rule: raw free-text answers are never persisted, and MC selections are
// never persisted as option text either - only technical, closed-set identifiers
// survive:
//   - freeText: { questionType, answered, status? } - never the typed text.
//   - yesNo:    { questionType, selectedAnswer (a real boolean), correct? } - a
//               boolean carries no content, so it is safe to keep as-is.
//   - mc:       { questionType, selectedOptionIndex (integer, canonical index into
//               the ORIGINAL question.options array), correct? } - never the
//               option's own text. The canonical index is resolved against the
//               question object that belongs to the questionId being sanitized,
//               which every caller in this codebase already has in memory (the
//               currently loaded bank/library), so text is never round-tripped
//               through storage even for legacy records written before this
//               field existed.
const FREE_TEXT_STATUSES = new Set(['green', 'yellow', 'red'])

function toCanonicalOptionIndex(rawSelection, options) {
  if (!Array.isArray(options) || options.length === 0) return null

  if (typeof rawSelection === 'number' && Number.isInteger(rawSelection)) {
    return rawSelection >= 0 && rawSelection < options.length ? rawSelection : null
  }

  // Legacy shape: the raw option text itself. Resolved once against the current
  // (fingerprint-matched, therefore identical) options and never written back as
  // text - the next save persists only the resulting index.
  if (typeof rawSelection === 'string') {
    const index = options.indexOf(rawSelection)
    return index === -1 ? null : index
  }

  return null
}

export function sanitizeAnswerRecord(entry, question) {
  if (!entry || typeof entry !== 'object') return null

  if (entry.questionType === 'freeText') {
    const safe = { questionType: 'freeText', answered: true }
    if (FREE_TEXT_STATUSES.has(entry.status)) safe.status = entry.status
    return safe
  }

  if (entry.questionType === 'yesNo') {
    const safe = { questionType: 'yesNo' }
    if (typeof entry.selectedAnswer === 'boolean') safe.selectedAnswer = entry.selectedAnswer
    if (typeof entry.correct === 'boolean') safe.correct = entry.correct
    return safe
  }

  if (entry.questionType === 'mc') {
    const safe = { questionType: 'mc' }
    const rawSelection = typeof entry.selectedOptionIndex !== 'undefined'
      ? entry.selectedOptionIndex
      : entry.selectedAnswer
    const index = toCanonicalOptionIndex(rawSelection, question?.options)
    // If the selection cannot be safely resolved to a canonical index (unknown
    // question, missing options, or a value matching nothing) it is dropped
    // rather than ever persisting an unvalidated value - see Phase 5A.3.
    if (index !== null) safe.selectedOptionIndex = index
    if (typeof entry.correct === 'boolean') safe.correct = entry.correct
    return safe
  }

  return null
}

export function sanitizeAnswerRecords(answers, questionsById) {
  const safe = {}
  if (!answers || typeof answers !== 'object') return safe

  for (const [questionId, entry] of Object.entries(answers)) {
    const question = questionsById instanceof Map
      ? questionsById.get(questionId)
      : questionsById?.[questionId]
    const sanitized = sanitizeAnswerRecord(entry, question)
    if (sanitized) safe[questionId] = sanitized
  }

  return safe
}

// Builds a questionId -> question lookup from a single package bank (the key
// shape used by packageProgressStore.js, where answers are keyed by bare
// questionId within one bank).
export function buildQuestionLookup(packageBank) {
  const map = new Map()
  for (const question of packageBank?.questions || []) {
    if (question?.questionId) map.set(question.questionId, question)
  }
  return map
}

// Builds a "packageId::questionId" -> question lookup across an entire loaded
// library (the key shape used by topicCheckStore.js and examStore.js, where
// answers are keyed across multiple banks at once).
export function buildCompositeQuestionLookup(library) {
  const map = new Map()
  for (const bank of Object.values(library || {})) {
    for (const question of bank?.questions || []) {
      if (bank?.packageId && question?.questionId) {
        map.set(`${bank.packageId}::${question.questionId}`, question)
      }
    }
  }
  return map
}
