import { createBankFingerprint } from './progressStore.js'

const PACKAGE_PROGRESS_KEY_PREFIX = 'pwl-quiz-package-progress:v1:'
const PACKAGE_PROGRESS_SCHEMA_VERSION = 1

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function createStatistics() {
  return {
    mcYesNoCorrect: 0,
    mcYesNoWrong: 0,
    freeTextGreen: 0,
    freeTextYellow: 0,
    freeTextRed: 0,
  }
}

export function createPackageBankFingerprint(packageBank) {
  const fingerprintQuestions = (packageBank?.questions || []).map((question, index) => ({
    id: question.questionId ?? `question-${index + 1}`,
    // The fingerprint deliberately covers the complete question definition, but it is only
    // persisted as a hash in the storage key; private question content is never stored.
    question: JSON.stringify(question),
  }))

  return createBankFingerprint('package', fingerprintQuestions)
}

export function createPackageProgressKey(packageId, bankFingerprint) {
  return `${PACKAGE_PROGRESS_KEY_PREFIX}${packageId}:${bankFingerprint}`
}

export function createInitialPackageProgress(packageBank) {
  return {
    schemaVersion: PACKAGE_PROGRESS_SCHEMA_VERSION,
    packageId: packageBank.packageId,
    bankFingerprint: createPackageBankFingerprint(packageBank),
    packageTitle: packageBank.packageTitle,
    currentQuestionIndex: 0,
    sessionSize: 'all',
    questionTypeFilter: 'mixed',
    orderedQuestionIds: [],
    sessionStatus: 'inProgress',
    answers: {},
    statistics: createStatistics(),
    updatedAt: null,
  }
}

function normalizeProgress(packageBank, progress) {
  const initial = createInitialPackageProgress(packageBank)
  const answers = progress?.answers && typeof progress.answers === 'object'
    ? progress.answers
    : {}

  return {
    ...initial,
    ...progress,
    packageId: initial.packageId,
    bankFingerprint: initial.bankFingerprint,
    packageTitle: initial.packageTitle,
    currentQuestionIndex: Math.max(
      0,
      Math.min(Number(progress?.currentQuestionIndex) || 0, Math.max(0, packageBank.questions.length - 1)),
    ),
    sessionStatus: progress?.sessionStatus === 'completed' ? 'completed' : 'inProgress',
    sessionSize: progress?.sessionSize === 'all' ? 'all' : (Number(progress?.sessionSize) || 'all'),
    questionTypeFilter: ['mixed', 'mc', 'yesNo', 'freeText'].includes(progress?.questionTypeFilter) ? progress.questionTypeFilter : 'mixed',
    orderedQuestionIds: Array.isArray(progress?.orderedQuestionIds) ? progress.orderedQuestionIds.map(String) : [],
    answers,
    statistics: { ...createStatistics(), ...(progress?.statistics || {}) },
  }
}

export function loadPackageProgress(packageBank) {
  const initial = createInitialPackageProgress(packageBank)
  const storage = getStorage()
  if (!storage) return initial

  try {
    const stored = JSON.parse(storage.getItem(
      createPackageProgressKey(initial.packageId, initial.bankFingerprint),
    ))
    if (
      !stored
      || stored.schemaVersion !== PACKAGE_PROGRESS_SCHEMA_VERSION
      || stored.packageId !== initial.packageId
      || stored.bankFingerprint !== initial.bankFingerprint
    ) return initial

    return normalizeProgress(packageBank, stored)
  } catch {
    return initial
  }
}

export function savePackageProgress(packageBank, progress) {
  const storage = getStorage()
  const progressToSave = {
    ...normalizeProgress(packageBank, progress),
    updatedAt: new Date().toISOString(),
  }

  if (storage) {
    storage.setItem(
      createPackageProgressKey(progressToSave.packageId, progressToSave.bankFingerprint),
      JSON.stringify(progressToSave),
    )
  }

  return progressToSave
}

export function clearPackageProgress(packageBank) {
  const initial = createInitialPackageProgress(packageBank)
  getStorage()?.removeItem(createPackageProgressKey(initial.packageId, initial.bankFingerprint))
}

export function getPackageProgressSummary(progress) {
  const answered = Object.keys(progress?.answers || {}).length
  return {
    answered,
    completed: progress?.sessionStatus === 'completed',
    roundQuestions: Array.isArray(progress?.orderedQuestionIds) && progress.orderedQuestionIds.length ? progress.orderedQuestionIds.length : null,
    hasProgress: answered > 0 || progress?.sessionStatus === 'completed',
  }
}
