import { countLibraryQuestions, findQuestion } from './masterLernmentorLibrary.js'

const PROGRESS_KEY_PREFIX = 'pwl-quiz-master-lernmentor-progress:v1:'
const SCHEMA_VERSION = 1
const VALID_RATINGS = new Set(['safe', 'partial', 'learn'])

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function createMasterLernmentorProgressKey(libraryId, fingerprint) {
  return `${PROGRESS_KEY_PREFIX}${libraryId}:${fingerprint}`
}

export function createInitialMasterLernmentorProgress(library, fileName = null) {
  const firstChapter = library.chapters[0]
  const firstTopic = firstChapter?.topics?.[0]

  return {
    schemaVersion: SCHEMA_VERSION,
    libraryId: library.libraryId,
    fingerprint: library.fingerprint,
    fileName: typeof fileName === 'string' ? fileName : null,
    currentChapterId: firstChapter?.chapterId ?? null,
    currentTopicId: firstTopic?.topicId ?? null,
    currentQuestionIndex: 0,
    ratings: {},
    updatedAt: null,
  }
}

// Sole whitelist enforcement point for both write-time and read-time I/O: only
// technical resume/rating metadata survives. Question text, master content,
// concept text and raw user free-text answers are never part of this shape,
// so there is nothing here that could leak them - malformed/legacy records
// self-heal into this safe shape on the next save.
function sanitizeProgress(library, raw, fallbackFileName) {
  const initial = createInitialMasterLernmentorProgress(library, fallbackFileName)
  if (!raw || typeof raw !== 'object') return initial

  const chapterId = typeof raw.currentChapterId === 'string' && library.chapters.some((chapter) => chapter.chapterId === raw.currentChapterId)
    ? raw.currentChapterId
    : initial.currentChapterId
  const chapter = library.chapters.find((c) => c.chapterId === chapterId)
  const topicId = typeof raw.currentTopicId === 'string' && chapter?.topics?.some((topic) => topic.topicId === raw.currentTopicId)
    ? raw.currentTopicId
    : (chapter?.topics?.[0]?.topicId ?? null)
  const topic = chapter?.topics?.find((t) => t.topicId === topicId)
  const questionCount = topic?.questions?.length || 0
  const currentQuestionIndex = questionCount
    ? Math.max(0, Math.min(Number(raw.currentQuestionIndex) || 0, questionCount - 1))
    : 0

  const ratings = {}
  if (raw.ratings && typeof raw.ratings === 'object') {
    for (const [questionId, rating] of Object.entries(raw.ratings)) {
      if (typeof questionId !== 'string' || !VALID_RATINGS.has(rating)) continue
      if (!findQuestion(library, chapterId, topicId, questionId) && !questionExistsAnywhere(library, questionId)) continue
      ratings[questionId] = rating
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    libraryId: library.libraryId,
    fingerprint: library.fingerprint,
    fileName: typeof raw.fileName === 'string' ? raw.fileName : (typeof fallbackFileName === 'string' ? fallbackFileName : null),
    currentChapterId: chapterId,
    currentTopicId: topicId,
    currentQuestionIndex,
    ratings,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  }
}

function questionExistsAnywhere(library, questionId) {
  for (const chapter of library.chapters) {
    for (const topic of chapter.topics) {
      if (topic.questions.some((question) => question.questionId === questionId)) return true
    }
  }
  return false
}

export function loadMasterLernmentorProgress(library, fileName = null) {
  const initial = createInitialMasterLernmentorProgress(library, fileName)
  const storage = getStorage()
  if (!storage) return initial

  try {
    const stored = JSON.parse(storage.getItem(createMasterLernmentorProgressKey(library.libraryId, library.fingerprint)))
    if (!stored || stored.schemaVersion !== SCHEMA_VERSION || stored.libraryId !== library.libraryId || stored.fingerprint !== library.fingerprint) {
      return initial
    }
    return sanitizeProgress(library, stored, fileName)
  } catch {
    return initial
  }
}

export function saveMasterLernmentorProgress(library, progress) {
  const storage = getStorage()
  const toSave = {
    ...sanitizeProgress(library, progress, progress?.fileName),
    updatedAt: new Date().toISOString(),
  }

  if (storage) {
    storage.setItem(createMasterLernmentorProgressKey(library.libraryId, library.fingerprint), JSON.stringify(toSave))
  }

  return toSave
}

export function clearMasterLernmentorProgress(library) {
  getStorage()?.removeItem(createMasterLernmentorProgressKey(library.libraryId, library.fingerprint))
}

// Review status and progress percentages are intentionally derived from the
// persisted `ratings` map rather than stored redundantly, keeping the
// whitelist minimal while satisfying "review status stays clean" and
// "compact progress" requirements from the same source of truth.
export function computeMasterLernmentorProgressSummary(library, progress) {
  const total = countLibraryQuestions(library)
  const ratings = progress?.ratings || {}
  const ratedIds = Object.keys(ratings)
  const counts = { safe: 0, partial: 0, learn: 0 }
  ratedIds.forEach((id) => {
    if (ratings[id] in counts) counts[ratings[id]]++
  })

  return {
    total,
    rated: ratedIds.length,
    percent: total ? Math.round((ratedIds.length / total) * 100) : 0,
    safe: counts.safe,
    partial: counts.partial,
    learn: counts.learn,
    reviewRelevantCount: counts.partial + counts.learn,
  }
}

export function isReviewRelevant(rating) {
  return rating === 'partial' || rating === 'learn'
}
