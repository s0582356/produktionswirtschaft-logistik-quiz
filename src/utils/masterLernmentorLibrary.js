import { createBankFingerprint } from './progressStore.js'

export const SOURCE_GAP_STATUS = 'SOURCE_GAP_CONFIRMED'

// The single, exact identity of the Master-Lernmentor library type, taken
// verbatim from the frozen FINAL bank's "libraryId" field (present and
// identical at both the whole-bank level and every per-chapter file - the
// only field that is uniformly stable across the structure; "version" is
// NOT, e.g. "whole-bank-candidate-v1" at the top level vs. "pilot-v1" per
// chapter file). This is the sole source of truth for "is this a
// Master-Lernmentor library" - classifier and validator both compare
// against it with exact equality, never a substring/prefix check, so a
// foreign library can never be accepted just because its structure happens
// to resemble the Master-Lernmentor schema.
export const MASTER_LERNMENTOR_LIBRARY_ID = 'pwl-master-lernmentor'

function fail(message) {
  throw new Error(message)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeConceptList(list, label) {
  if (list === undefined) return []
  if (!Array.isArray(list)) fail(`${label}: muss eine Liste sein.`)
  return list.map((concept, index) => {
    if (!concept || typeof concept !== 'object') {
      fail(`${label}, Eintrag ${index + 1}: ist kein gültiges Konzept-Objekt.`)
    }
    if (!isNonEmptyString(concept.label) && !isNonEmptyString(concept.description)) {
      fail(`${label}, Eintrag ${index + 1}: benötigt mindestens "label" oder "description".`)
    }
    return {
      conceptId: concept.conceptId ?? null,
      label: concept.label ?? '',
      description: concept.description ?? '',
      acceptedPhrases: Array.isArray(concept.acceptedPhrases) ? concept.acceptedPhrases.filter(isNonEmptyString) : [],
    }
  })
}

function normalizeQuestion(question, label, seenQuestionIds) {
  if (!question || typeof question !== 'object') fail(`${label}: ungültige Frage.`)
  if (!isNonEmptyString(question.questionId)) fail(`${label}: "questionId" fehlt oder ist ungültig.`)
  if (seenQuestionIds.has(question.questionId)) fail(`Doppelte questionId: ${question.questionId}`)
  seenQuestionIds.add(question.questionId)

  if (!isNonEmptyString(question.question)) fail(`${label} (${question.questionId}): "question" fehlt oder ist ungültig.`)
  if (!isNonEmptyString(question.sourceStatus)) fail(`${label} (${question.questionId}): "sourceStatus" fehlt oder ist ungültig.`)
  if (!isNonEmptyString(question.questionType)) fail(`${label} (${question.questionId}): "questionType" fehlt oder ist ungültig.`)
  if (!isNonEmptyString(question.minimumSufficientAnswer)) fail(`${label} (${question.questionId}): "minimumSufficientAnswer" fehlt oder ist ungültig.`)
  if (!isNonEmptyString(question.shortModelAnswer)) fail(`${label} (${question.questionId}): "shortModelAnswer" fehlt oder ist ungültig.`)
  if (!isNonEmptyString(question.masterExcerpt)) fail(`${label} (${question.questionId}): "masterExcerpt" fehlt oder ist ungültig.`)

  const coreConcepts = normalizeConceptList(question.coreConcepts, `${label} (${question.questionId}): "coreConcepts"`)
  const optionalConcepts = normalizeConceptList(question.optionalConcepts, `${label} (${question.questionId}): "optionalConcepts"`)

  const answerFlexibility = question.answerFlexibility && typeof question.answerFlexibility === 'object'
    ? {
      wordingMatchRequired: question.answerFlexibility.wordingMatchRequired === true,
      equivalentOwnExamplesAllowed: question.answerFlexibility.equivalentOwnExamplesAllowed === true,
      caseBound: question.answerFlexibility.caseBound === true,
    }
    : { wordingMatchRequired: false, equivalentOwnExamplesAllowed: false, caseBound: false }

  const responseRequirements = question.responseRequirements && typeof question.responseRequirements === 'object'
    ? { ...question.responseRequirements }
    : null

  const calculationRequirements = question.calculationRequirements && typeof question.calculationRequirements === 'object'
    ? { ...question.calculationRequirements }
    : null

  return {
    questionId: question.questionId,
    question: question.question,
    hint: isNonEmptyString(question.hint) ? question.hint : null,
    expectedAnswerLength: isNonEmptyString(question.expectedAnswerLength) ? question.expectedAnswerLength : null,
    sourceStatus: question.sourceStatus,
    questionType: question.questionType,
    difficulty: isNonEmptyString(question.difficulty) ? question.difficulty : null,
    examRelevance: isNonEmptyString(question.examRelevance) ? question.examRelevance : null,
    coreConcepts,
    optionalConcepts,
    minimumSufficientAnswer: question.minimumSufficientAnswer,
    shortModelAnswer: question.shortModelAnswer,
    masterExcerpt: question.masterExcerpt,
    masterAnchor: isNonEmptyString(question.masterAnchor) ? question.masterAnchor : null,
    answerFlexibility,
    responseRequirements,
    calculationRequirements,
  }
}

function normalizeTopic(topic, chapterLabel, seenTopicIds, seenQuestionIds) {
  if (!topic || typeof topic !== 'object') fail(`${chapterLabel}: ungültiges Topic.`)
  if (!isNonEmptyString(topic.topicId)) fail(`${chapterLabel}: "topicId" eines Topics fehlt oder ist ungültig.`)
  if (seenTopicIds.has(topic.topicId)) fail(`Doppelte topicId: ${topic.topicId}`)
  seenTopicIds.add(topic.topicId)

  const topicLabel = `${chapterLabel}, Topic ${topic.topicId}`
  const learningPhase = topic.learningPhase && typeof topic.learningPhase === 'object' ? topic.learningPhase : null
  if (!learningPhase || !isNonEmptyString(learningPhase.masterContent)) {
    fail(`${topicLabel}: "learningPhase.masterContent" fehlt oder ist ungültig.`)
  }
  if (!Array.isArray(topic.questions) || topic.questions.length === 0) {
    fail(`${topicLabel}: "questions" muss ein nicht leeres Array sein.`)
  }

  return {
    topicId: topic.topicId,
    topicNumber: topic.topicNumber ?? null,
    topicTitle: isNonEmptyString(topic.topicTitle) ? topic.topicTitle : topic.topicId,
    learningPhase: {
      masterAnchor: isNonEmptyString(learningPhase.masterAnchor) ? learningPhase.masterAnchor : null,
      masterContent: learningPhase.masterContent,
      containsTable: learningPhase.containsTable === true,
      containsFormula: learningPhase.containsFormula === true,
      containsMemoryBox: learningPhase.containsMemoryBox === true,
      containsExamTrap: learningPhase.containsExamTrap === true,
    },
    questions: topic.questions.map((question, index) => (
      normalizeQuestion(question, `${topicLabel}, Frage ${index + 1}`, seenQuestionIds)
    )),
  }
}

function normalizeChapter(chapterEntry, index, seenChapterIds, seenTopicIds, seenQuestionIds) {
  if (!chapterEntry || typeof chapterEntry !== 'object') fail(`Kapitel ${index + 1}: ungültiger Eintrag.`)
  const chapterMeta = chapterEntry.chapter && typeof chapterEntry.chapter === 'object' ? chapterEntry.chapter : chapterEntry
  if (!isNonEmptyString(chapterMeta.chapterId)) fail(`Kapitel ${index + 1}: "chapterId" fehlt oder ist ungültig.`)
  if (seenChapterIds.has(chapterMeta.chapterId)) fail(`Doppelte chapterId: ${chapterMeta.chapterId}`)
  seenChapterIds.add(chapterMeta.chapterId)

  const chapterLabel = `Kapitel ${chapterMeta.chapterId}`
  if (!isNonEmptyString(chapterMeta.chapterTitle)) fail(`${chapterLabel}: "chapterTitle" fehlt oder ist ungültig.`)
  if (!Array.isArray(chapterEntry.topics) || chapterEntry.topics.length === 0) {
    fail(`${chapterLabel}: "topics" muss ein nicht leeres Array sein.`)
  }

  return {
    chapterId: chapterMeta.chapterId,
    chapterNumber: chapterMeta.chapterNumber ?? null,
    chapterTitle: chapterMeta.chapterTitle,
    topics: chapterEntry.topics.map((topic) => normalizeTopic(topic, chapterLabel, seenTopicIds, seenQuestionIds)),
  }
}

export function flattenQuestions(library) {
  const flat = []
  for (const chapter of library.chapters) {
    for (const topic of chapter.topics) {
      for (const question of topic.questions) flat.push(question)
    }
  }
  return flat
}

export function createMasterLernmentorFingerprint(chapters) {
  const flatIdentity = []
  for (const chapter of chapters) {
    for (const topic of chapter.topics) {
      for (const question of topic.questions) {
        flatIdentity.push({ id: question.questionId, question: question.question })
      }
    }
  }
  return createBankFingerprint('masterLernmentor', flatIdentity)
}

// Validates and normalizes a parsed Master-Lernmentor library. Purely
// structural: no question/answer content is rewritten, only optional fields
// are defaulted so the UI never has to guard against missing shapes.
export function validateMasterLernmentorLibrary(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    fail('Master-Lernmentor-Datei: erwartet wird ein JSON-Objekt.')
  }
  if (data.libraryId !== MASTER_LERNMENTOR_LIBRARY_ID) {
    fail(`Diese Datei ist keine gültige Master-Lernmentor-Datei ("libraryId" muss exakt "${MASTER_LERNMENTOR_LIBRARY_ID}" sein).`)
  }
  if (!Array.isArray(data.chapters) || data.chapters.length === 0) {
    fail('Master-Lernmentor-Datei: "chapters" muss ein nicht leeres Array sein.')
  }

  const seenChapterIds = new Set()
  const seenTopicIds = new Set()
  const seenQuestionIds = new Set()
  const chapters = data.chapters.map((chapterEntry, index) => (
    normalizeChapter(chapterEntry, index, seenChapterIds, seenTopicIds, seenQuestionIds)
  ))

  return {
    libraryId: data.libraryId,
    version: isNonEmptyString(data.version) ? data.version : null,
    fingerprint: createMasterLernmentorFingerprint(chapters),
    chapters,
  }
}

export function findChapter(library, chapterId) {
  return library?.chapters?.find((chapter) => chapter.chapterId === chapterId) || null
}

export function findTopic(library, chapterId, topicId) {
  const chapter = findChapter(library, chapterId)
  return chapter?.topics?.find((topic) => topic.topicId === topicId) || null
}

export function findQuestion(library, chapterId, topicId, questionId) {
  const topic = findTopic(library, chapterId, topicId)
  return topic?.questions?.find((question) => question.questionId === questionId) || null
}

export function countTopicQuestions(topic) {
  return topic?.questions?.length || 0
}

export function countChapterQuestions(chapter) {
  return (chapter?.topics || []).reduce((total, topic) => total + countTopicQuestions(topic), 0)
}

export function countLibraryQuestions(library) {
  return (library?.chapters || []).reduce((total, chapter) => total + countChapterQuestions(chapter), 0)
}
