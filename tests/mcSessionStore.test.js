import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MC_SESSION_STORAGE_KEY,
  clearMcSession,
  loadMcSessionRaw,
  sanitizeMcSession,
  saveMcSession,
} from '../src/utils/mcSessionStore.js'
import { createBankFingerprint, getQuestionId } from '../src/utils/progressStore.js'

const storage = new Map()
global.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
}
afterEach(() => storage.clear())

const PRIVATE_QUESTION_SENTINEL = 'PRIVATE_QUESTION_SENTINEL_8472'

function privateBank(size = 3) {
  return Array.from({ length: size }, (_, index) => ({
    id: `q-${index + 1}`,
    category: 'Privat',
    question: `${PRIVATE_QUESTION_SENTINEL} Frage ${index + 1}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    explanation: 'private Erklärung',
  }))
}

function recordFor(bank, overrides = {}) {
  return {
    bank: { id: createBankFingerprint('mc', bank), questionCount: bank.length, source: { kind: 'import', fileName: 'meine-bank.json' } },
    currentQuestionIndex: 1,
    isQuizComplete: false,
    isReviewMode: false,
    score: 2,
    currentStreak: 1,
    bestStreak: 2,
    answeredQuestionIds: [getQuestionId(bank[0], 0), getQuestionId(bank[1], 1)],
    incorrectlyAnsweredQuestionIds: [getQuestionId(bank[1], 1)],
    ...overrides,
  }
}

// A + B: the full private bank / question text is never persisted.
test('Phase 5A.1: private MC-Fragenbank wird nicht persistiert', () => {
  const bank = privateBank()
  saveMcSession(recordFor(bank))
  const raw = storage.get(MC_SESSION_STORAGE_KEY)
  assert.equal(raw.includes(PRIVATE_QUESTION_SENTINEL), false)
  assert.equal(raw.includes('originalQuestions'), false)
  assert.equal(raw.includes('"questions"'), false)
  const parsed = JSON.parse(raw)
  assert.equal('originalQuestions' in parsed, false)
  assert.equal('questions' in parsed, false)
})

// F: technical resume metadata is persisted and survives a round trip.
test('Phase 5A.1: technische Resume-Metadaten bleiben erhalten', () => {
  const bank = privateBank()
  saveMcSession(recordFor(bank))
  const loaded = loadMcSessionRaw()
  assert.equal(loaded.score, 2)
  assert.equal(loaded.currentStreak, 1)
  assert.equal(loaded.bestStreak, 2)
  assert.equal(loaded.currentQuestionIndex, 1)
  assert.deepEqual(loaded.answeredQuestionIds, [getQuestionId(bank[0], 0), getQuestionId(bank[1], 1)])
  assert.deepEqual(loaded.incorrectlyAnsweredQuestionIds, [getQuestionId(bank[1], 1)])
  assert.equal(loaded.bank.source.fileName, 'meine-bank.json')
})

// G: same fingerprint (same re-imported file) restores progress.
test('Phase 5A.1: gleicher Fingerprint stellt Fortschritt wieder her', () => {
  const bank = privateBank()
  saveMcSession(recordFor(bank))
  const reimported = privateBank() // identical content -> identical fingerprint
  const loaded = loadMcSessionRaw()
  assert.equal(loaded.bank.id, createBankFingerprint('mc', reimported))
})

// H: a different fingerprint (edited file / different bank) must not be treated as a match.
test('Phase 5A.1: unterschiedlicher Fingerprint verhindert falsche Fortschrittsübernahme', () => {
  const bankA = privateBank(3)
  const bankB = privateBank(4) // different length -> different fingerprint
  saveMcSession(recordFor(bankA))
  const loaded = loadMcSessionRaw()
  assert.notEqual(loaded.bank.id, createBankFingerprint('mc', bankB))
})

// I: a legacy (pre-repair) record with the full bank embedded is sanitized down to the safe shape.
test('Phase 5A.1: Legacy-Vollbank-Datensatz wird beim Laden saniert', () => {
  const bank = privateBank()
  const legacy = {
    version: 1,
    type: 'mc',
    savedAt: '2026-01-01T00:00:00.000Z',
    bank: { id: createBankFingerprint('mc', bank), questionCount: bank.length, source: { kind: 'import', fileName: 'alt.json' } },
    originalQuestions: bank,
    questions: bank,
    selectedAnswer: bank[0].options[0],
    isAnswered: true,
    isQuizComplete: false,
    isReviewMode: false,
    score: 5,
    currentStreak: 3,
    bestStreak: 4,
    answeredQuestions: [
      { questionId: getQuestionId(bank[0], 0), key: 'legacy-key', category: 'Privat', selectedAnswer: 'A', isCorrect: true },
    ],
    answeredQuestionIds: [getQuestionId(bank[0], 0)],
    incorrectlyAnsweredQuestionIds: [],
  }
  storage.set(MC_SESSION_STORAGE_KEY, JSON.stringify(legacy))

  const sanitized = loadMcSessionRaw()
  assert.equal('originalQuestions' in sanitized, false)
  assert.equal('questions' in sanitized, false)
  assert.equal('answeredQuestions' in sanitized, false)
  assert.equal('selectedAnswer' in sanitized, false)
  assert.equal('isAnswered' in sanitized, false)
  assert.equal(sanitized.score, 5)
  assert.deepEqual(sanitized.answeredQuestionIds, [getQuestionId(bank[0], 0)])

  // re-saving after migration must only ever write the safe shape (write-time enforcement)
  saveMcSession(sanitized)
  const raw = storage.get(MC_SESSION_STORAGE_KEY)
  assert.equal(raw.includes(PRIVATE_QUESTION_SENTINEL), false)
  assert.equal(raw.includes('legacy-key'), false)
})

// K: malformed storage content must not crash the app.
test('Phase 5A.1: fehlerhafter Storage-Inhalt führt zu sicherem Fallback statt Crash', () => {
  storage.set(MC_SESSION_STORAGE_KEY, '{not valid json')
  assert.doesNotThrow(() => loadMcSessionRaw())
  assert.equal(loadMcSessionRaw(), null)

  storage.set(MC_SESSION_STORAGE_KEY, JSON.stringify({ type: 'mc', bank: 'not-an-object', score: 'NaN-ish' }))
  const sanitized = loadMcSessionRaw()
  assert.equal(sanitized.bank.id, null)
  assert.equal(sanitized.score, 0)
})

// L: sanitizing an already-sanitized record is a no-op (idempotent).
test('Phase 5A.1: Sanitizing ist idempotent', () => {
  const bank = privateBank()
  const once = sanitizeMcSession({ type: 'mc', ...recordFor(bank) })
  const twice = sanitizeMcSession(once)
  assert.deepEqual(once, twice)
})

// M: normal save/load/clear round trip still works end to end.
test('Phase 5A.1: normaler MC-Speicher-/Lade-/Löschzyklus funktioniert weiterhin', () => {
  const bank = privateBank()
  saveMcSession(recordFor(bank))
  assert.ok(loadMcSessionRaw())
  clearMcSession()
  assert.equal(loadMcSessionRaw(), null)
  assert.equal(storage.has(MC_SESSION_STORAGE_KEY), false)
})
