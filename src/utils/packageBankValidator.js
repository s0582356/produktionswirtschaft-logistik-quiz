const VALID_PACKAGE_IDS = Array.from({ length: 11 }, (_, index) => `p${String(index + 1).padStart(2, '0')}`)
const PACKAGE_ID_TO_NUMBER = Object.fromEntries(VALID_PACKAGE_IDS.map((id, index) => [id, index + 1]))
const ALLOWED_QUESTION_TYPES = new Set(['mc', 'yesNo', 'freeText'])

export function isPackageBank(data) {
  return Boolean(data) && !Array.isArray(data) && data.type === 'package' && Boolean(data.packageId)
}

function fail(message) {
  throw new Error(message)
}

function validateMcQuestion(question, label) {
  if (!question.question || typeof question.question !== 'string') {
    fail(`${label}: "question" fehlt oder ist ungültig.`)
  }
  if (!Array.isArray(question.options) || question.options.length !== 4) {
    fail(`${label}: MC-Fragen benötigen genau 4 Antwortoptionen.`)
  }
  if (!question.correctAnswer || typeof question.correctAnswer !== 'string') {
    fail(`${label}: "correctAnswer" fehlt oder ist ungültig.`)
  }
  if (!question.options.includes(question.correctAnswer)) {
    fail(`${label}: "correctAnswer" muss in "options" enthalten sein.`)
  }
  if (!question.explanation || typeof question.explanation !== 'string') {
    fail(`${label}: "explanation" fehlt oder ist ungültig.`)
  }
}

function validateYesNoQuestion(question, label) {
  if (!question.statement || typeof question.statement !== 'string') {
    fail(`${label}: "statement" fehlt oder ist ungültig.`)
  }
  if (typeof question.correctAnswer !== 'boolean') {
    fail(`${label}: "correctAnswer" muss ein Wahrheitswert (true/false) sein.`)
  }
  if (!question.explanation || typeof question.explanation !== 'string') {
    fail(`${label}: "explanation" fehlt oder ist ungültig.`)
  }
}

function hasSearchTerms(value) {
  return Array.isArray(value) && value.length > 0
}

// Mirrors the checkpoint shapes checkpointMatches() in freeTextEvaluator.js
// actually evaluates: either a plain non-empty string, or an object carrying
// at least one non-empty term list (anyOf/keywords, allOf, or synonyms). A
// checkpoint without any of these can never match and would silently count
// as a permanently missing checkpoint.
function isValidCheckpoint(checkpoint) {
  if (typeof checkpoint === 'string') return checkpoint.trim().length > 0
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) return false

  return hasSearchTerms(checkpoint.anyOf)
    || hasSearchTerms(checkpoint.allOf)
    || hasSearchTerms(checkpoint.keywords)
    || hasSearchTerms(checkpoint.synonyms)
}

function validateFreeTextQuestion(question, label) {
  if (!question.question || typeof question.question !== 'string') {
    fail(`${label}: "question" fehlt oder ist ungültig.`)
  }
  if (!question.modelAnswer || typeof question.modelAnswer !== 'string') {
    fail(`${label}: "modelAnswer" fehlt oder ist ungültig.`)
  }
  if (!Array.isArray(question.checkpoints) || question.checkpoints.length === 0) {
    fail(`${label}: "checkpoints" muss mindestens einen Eintrag enthalten.`)
  }

  question.checkpoints.forEach((checkpoint, checkpointIndex) => {
    if (!isValidCheckpoint(checkpoint)) {
      fail(
        `${label}: Checkpoint ${checkpointIndex + 1} ist ungültig. Erwartet wird ein nicht-leerer `
        + 'Text oder ein Objekt mit mindestens einer nicht-leeren Liste ("anyOf", "allOf", '
        + '"keywords" oder "synonyms").',
      )
    }
  })
}

export function validatePackageBank(data) {
  if (data.type !== 'package') {
    fail('Paketdatei: "type" muss "package" sein.')
  }
  if (data.schemaVersion !== 1) {
    fail('Paketdatei: "schemaVersion" wird nicht unterstützt (aktuell wird nur 1 unterstützt).')
  }
  if (!data.packageId || typeof data.packageId !== 'string') {
    fail('Paketdatei: "packageId" fehlt oder ist ungültig.')
  }
  if (!VALID_PACKAGE_IDS.includes(data.packageId)) {
    fail(`Paketdatei: Unbekannte packageId "${data.packageId}". Gültig sind p01 bis p11.`)
  }
  if (!data.packageTitle || typeof data.packageTitle !== 'string') {
    fail('Paketdatei: "packageTitle" fehlt oder ist ungültig.')
  }
  if (!Number.isInteger(data.packageNumber)) {
    fail('Paketdatei: "packageNumber" fehlt oder ist keine Ganzzahl.')
  }
  if (PACKAGE_ID_TO_NUMBER[data.packageId] !== data.packageNumber) {
    fail(`Paketdatei: "packageNumber" (${data.packageNumber}) passt nicht zu "packageId" (${data.packageId}).`)
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    fail('Paketdatei: "questions" muss ein nicht leeres Array sein.')
  }
  if (data.packagePriority !== undefined && typeof data.packagePriority !== 'string') {
    fail('Paketdatei: "packagePriority" muss ein Text sein.')
  }
  if (data.tags !== undefined && !Array.isArray(data.tags)) {
    fail('Paketdatei: "tags" muss eine Liste sein.')
  }

  const questionIds = new Set()
  const counts = { mc: 0, yesNo: 0, freeText: 0 }

  data.questions.forEach((question, index) => {
    const label = `Frage ${index + 1}`

    if (!question.questionId || typeof question.questionId !== 'string') {
      fail(`${label}: "questionId" fehlt oder ist ungültig.`)
    }
    if (questionIds.has(question.questionId)) {
      fail(`Doppelte questionId: ${question.questionId}`)
    }
    questionIds.add(question.questionId)

    if (!ALLOWED_QUESTION_TYPES.has(question.questionType)) {
      fail(`${label} (${question.questionId}): unbekannter questionType "${question.questionType}".`)
    }

    const questionLabel = `${label} (${question.questionId})`

    if (question.questionType === 'mc') {
      validateMcQuestion(question, questionLabel)
      counts.mc++
    } else if (question.questionType === 'yesNo') {
      validateYesNoQuestion(question, questionLabel)
      counts.yesNo++
    } else {
      validateFreeTextQuestion(question, questionLabel)
      counts.freeText++
    }
  })

  return {
    type: 'package',
    schemaVersion: 1,
    packageId: data.packageId,
    packageTitle: data.packageTitle,
    packageNumber: data.packageNumber,
    packagePriority: data.packagePriority ?? null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    questions: data.questions,
    counts: {
      total: data.questions.length,
      ...counts,
    },
  }
}
