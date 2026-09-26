// Persistence for the multiple-choice quiz session.
//
// Privacy rule: the full question bank (private or public) is never written to
// localStorage. Only technical resume metadata survives - a content fingerprint,
// the bank source descriptor (kind/fileName), position, score/streak counters, and
// id lists of answered/incorrect questions. `sanitizeMcSession` is the single
// whitelist enforcement point used for both writing and reading, so any legacy or
// tampered record is reduced to the same safe shape before it is used or re-saved.
export const MC_SESSION_STORAGE_KEY = 'pwl-quiz-mc-session:v1'

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function toFiniteNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

export function sanitizeMcSession(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.type !== 'mc') return null

  const bank = raw.bank && typeof raw.bank === 'object' ? raw.bank : {}
  const source = bank.source && typeof bank.source === 'object' ? bank.source : {}

  // Legacy (v1) records stored full question objects but already computed an
  // id-only `answeredQuestionIds` array alongside them - prefer that if present,
  // otherwise derive ids from the legacy `answeredQuestions` array without ever
  // reading anything but the id field from it.
  let answeredQuestionIds = toStringArray(raw.answeredQuestionIds)
  if (answeredQuestionIds.length === 0 && Array.isArray(raw.answeredQuestions)) {
    answeredQuestionIds = raw.answeredQuestions
      .map((entry) => entry && entry.questionId)
      .filter((id) => id !== undefined && id !== null)
      .map(String)
  }

  return {
    version: 2,
    type: 'mc',
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
    bank: {
      id: typeof bank.id === 'string' ? bank.id : null,
      questionCount: toFiniteNumber(bank.questionCount, 0),
      source: {
        kind: source.kind === 'import' ? 'import' : 'public',
        fileName: typeof source.fileName === 'string' ? source.fileName : null,
      },
    },
    currentQuestionIndex: toFiniteNumber(raw.currentQuestionIndex, 0),
    isQuizComplete: Boolean(raw.isQuizComplete),
    isReviewMode: Boolean(raw.isReviewMode),
    score: toFiniteNumber(raw.score, 0),
    currentStreak: toFiniteNumber(raw.currentStreak, 0),
    bestStreak: toFiniteNumber(raw.bestStreak, 0),
    answeredQuestionIds,
    incorrectlyAnsweredQuestionIds: toStringArray(raw.incorrectlyAnsweredQuestionIds),
  }
}

export function loadMcSessionRaw(storage = getStorage()) {
  if (!storage) return null

  try {
    const parsed = JSON.parse(storage.getItem(MC_SESSION_STORAGE_KEY))
    return sanitizeMcSession(parsed)
  } catch {
    return null
  }
}

export function saveMcSession(record, storage = getStorage()) {
  const safe = sanitizeMcSession({ type: 'mc', ...record })
  if (!safe) return null
  if (!storage) return safe

  try {
    storage.setItem(MC_SESSION_STORAGE_KEY, JSON.stringify(safe))
    return safe
  } catch {
    // localStorage can be unavailable or full; the current quiz remains usable.
    return safe
  }
}

export function clearMcSession(storage = getStorage()) {
  if (!storage) return
  storage.removeItem(MC_SESSION_STORAGE_KEY)
}
