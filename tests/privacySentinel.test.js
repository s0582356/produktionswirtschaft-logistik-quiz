// Phase 5A.1 - cross-store privacy assertion.
//
// Simulates a realistic learning flow across all four persistence surfaces
// (MC session, package progress, topic check, exam) with clearly marked
// sentinel content standing in for private question/answer text, then
// inspects every raw serialized localStorage value. If either sentinel ever
// appears in what actually gets written to storage, this test fails.
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createBankFingerprint, getQuestionId } from '../src/utils/progressStore.js'
import { saveMcSession } from '../src/utils/mcSessionStore.js'
import { createInitialPackageProgress, createPackageProgressKey, createPackageBankFingerprint, savePackageProgress } from '../src/utils/packageProgressStore.js'
import { createInitialTopicCheck, saveTopicCheck } from '../src/utils/topicCheckStore.js'
import { initialExam, saveExam } from '../src/utils/examStore.js'
import { validateMasterLernmentorLibrary } from '../src/utils/masterLernmentorLibrary.js'
import { saveMasterLernmentorProgress } from '../src/utils/masterLernmentorProgressStore.js'

const PRIVATE_QUESTION_SENTINEL = 'PRIVATE_QUESTION_SENTINEL_8472'
const RAW_USER_ANSWER_SENTINEL = 'RAW_USER_ANSWER_SENTINEL_5921'
const PRIVATE_OPTION_TEXT_SENTINEL = 'PRIVATE_OPTION_TEXT_SENTINEL_7319'
const PRIVATE_MASTER_CONTENT_SENTINEL = 'PRIVATE_MASTER_CONTENT_SENTINEL_3157'
const RAW_MASTER_LERNMENTOR_ANSWER_SENTINEL = 'RAW_MASTER_LERNMENTOR_ANSWER_SENTINEL_9042'

const storage = new Map()
global.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
}
afterEach(() => storage.clear())

function assertNoSentinelsAnywhereInStorage() {
  for (const [key, value] of storage.entries()) {
    assert.equal(value.includes(PRIVATE_QUESTION_SENTINEL), false, `Key ${key} enthält den privaten Fragetext-Sentinel`)
    assert.equal(value.includes(RAW_USER_ANSWER_SENTINEL), false, `Key ${key} enthält den rohen Antwort-Sentinel`)
    assert.equal(value.includes(PRIVATE_OPTION_TEXT_SENTINEL), false, `Key ${key} enthält den privaten MC-Options-Sentinel`)
    assert.equal(value.includes(PRIVATE_MASTER_CONTENT_SENTINEL), false, `Key ${key} enthält den privaten Master-Lernmentor-Masterinhalt-Sentinel`)
    assert.equal(value.includes(RAW_MASTER_LERNMENTOR_ANSWER_SENTINEL), false, `Key ${key} enthält den rohen Master-Lernmentor-Freitextantwort-Sentinel`)
  }
}

test('Phase 5A.1: kein bekannter Storage-Key enthält private Frageninhalte oder rohe Nutzerantworten nach einem vollständigen Lernfluss', () => {
  // MC mode: a private bank with sentinel-marked question text.
  const mcBank = [
    { id: 'mc-1', category: 'Privat', question: `${PRIVATE_QUESTION_SENTINEL} MC-Frage`, options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'privat' },
    { id: 'mc-2', category: 'Privat', question: `${PRIVATE_QUESTION_SENTINEL} zweite MC-Frage`, options: ['A', 'B', 'C', 'D'], correctAnswer: 'B', explanation: 'privat' },
  ]
  saveMcSession({
    bank: { id: createBankFingerprint('mc', mcBank), questionCount: mcBank.length, source: { kind: 'import', fileName: 'privat.json' } },
    currentQuestionIndex: 1,
    isQuizComplete: false,
    isReviewMode: false,
    score: 1,
    currentStreak: 1,
    bestStreak: 1,
    answeredQuestionIds: [getQuestionId(mcBank[0], 0)],
    incorrectlyAnsweredQuestionIds: [],
  })

  // Package training: a free-text answer containing the raw-answer sentinel, and an
  // MC answer selecting the option that carries the private option-text sentinel.
  // Note: packageTitle itself is short label metadata that the existing app already
  // persists by design (out of scope for this repair) - the sentinels are only placed
  // in the actual question/option content, which must never reach storage.
  const packageBank = {
    packageId: 'p01',
    packageTitle: 'Testpaket',
    questions: [
      { questionId: 'p01-free', questionType: 'freeText', question: `${PRIVATE_QUESTION_SENTINEL} Freitextfrage` },
      { questionId: 'p01-mc', questionType: 'mc', question: 'MC?', options: ['A', PRIVATE_OPTION_TEXT_SENTINEL, 'C', 'D'], correctAnswer: 'A' },
    ],
  }
  savePackageProgress(packageBank, {
    ...createInitialPackageProgress(packageBank),
    currentQuestionIndex: 0,
    orderedQuestionIds: ['p01-free', 'p01-mc'],
    answers: {
      'p01-free': { questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL, status: 'yellow' },
      'p01-mc': { questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL, correct: false },
    },
  })

  // Topic check: same pattern, different store.
  const topicLibrary = { p01: packageBank }
  saveTopicCheck(topicLibrary, {
    ...createInitialTopicCheck(topicLibrary),
    orderedQuestionRefs: [{ packageId: 'p01', questionId: 'p01-free' }, { packageId: 'p01', questionId: 'p01-mc' }],
    answers: {
      'p01::p01-free': { questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL, status: 'green' },
      'p01::p01-mc': { questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL, correct: false },
    },
  })

  // Exam mode: an in-progress free-text draft plus an in-progress MC selection.
  saveExam(topicLibrary, {
    ...initialExam(topicLibrary),
    orderedQuestionRefs: [{ packageId: 'p01', questionId: 'p01-free' }, { packageId: 'p01', questionId: 'p01-mc' }],
    answers: {
      'p01::p01-free': { questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL },
      'p01::p01-mc': { questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL },
    },
  })

  assert.equal(storage.size >= 4, true, 'Erwartete mindestens 4 beschriebene Storage-Keys (mc/package/topic/exam)')
  assertNoSentinelsAnywhereInStorage()
})

test('Phase 5B: Master-Lernmentor - weder Masterinhalt/Fragetext noch eine (versehentlich als Rating durchgereichte) rohe Freitextantwort landen im Storage', () => {
  const library = validateMasterLernmentorLibrary({
    libraryId: 'pwl-master-lernmentor',
    chapters: [{
      chapter: { chapterId: 'c01', chapterNumber: '1', chapterTitle: 'Privates Kapitel' },
      topics: [{
        topicId: 't01',
        topicTitle: 'Privates Thema',
        learningPhase: { masterContent: `${PRIVATE_MASTER_CONTENT_SENTINEL} - geheimer Masterinhalt.` },
        questions: [{
          questionId: 'q01',
          question: `${PRIVATE_QUESTION_SENTINEL} Master-Lernmentor-Frage?`,
          sourceStatus: 'SOURCE_OK',
          questionType: 'knowledge',
          coreConcepts: [],
          optionalConcepts: [],
          minimumSufficientAnswer: 'Minimal.',
          shortModelAnswer: 'Kurz.',
          masterExcerpt: 'Auszug.',
        }],
      }],
    }],
  })

  saveMasterLernmentorProgress(library, {
    libraryId: library.libraryId,
    fingerprint: library.fingerprint,
    fileName: 'privat.json',
    currentChapterId: 'c01',
    currentTopicId: 't01',
    currentQuestionIndex: 0,
    // Simulates an accidental attempt to smuggle the raw free-text answer through
    // as a "rating" - the whitelist must reject it since it is not in {safe,partial,learn}.
    ratings: { q01: RAW_MASTER_LERNMENTOR_ANSWER_SENTINEL },
  })

  assertNoSentinelsAnywhereInStorage()
})
