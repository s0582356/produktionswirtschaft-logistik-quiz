import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  clearPackageProgress,
  createInitialPackageProgress,
  createPackageBankFingerprint,
  createPackageProgressKey,
  loadPackageProgress,
  savePackageProgress,
} from '../src/utils/packageProgressStore.js'

const storage = new Map()
global.window = { localStorage: {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
} }

function bank(packageId = 'p01', suffix = '') {
  return {
    packageId,
    packageTitle: `Paket ${packageId}`,
    questions: [
      { questionId: `${packageId}-mc`, questionType: 'mc', question: `MC-Frage ${suffix}`, options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
      { questionId: `${packageId}-yn`, questionType: 'yesNo', statement: `Ja-Nein-Frage ${suffix}`, correctAnswer: true },
      { questionId: `${packageId}-free`, questionType: 'freeText', question: `Freitextfrage ${suffix}` },
    ],
  }
}

function savedProgress(item) {
  const progress = createInitialPackageProgress(item)
  progress.currentQuestionIndex = 2
  progress.sessionStatus = 'completed'
  progress.answers = {
    [`${item.packageId}-mc`]: { questionType: 'mc', selectedAnswer: 'A', correct: true },
    [`${item.packageId}-yn`]: { questionType: 'yesNo', selectedAnswer: false, correct: false },
    [`${item.packageId}-free`]: { questionType: 'freeText', userAnswer: 'Meine gespeicherte Antwort', status: 'yellow' },
  }
  progress.statistics = {
    mcYesNoCorrect: 1, mcYesNoWrong: 1,
    freeTextGreen: 0, freeTextYellow: 1, freeTextRed: 0,
  }
  return savePackageProgress(item, progress)
}

afterEach(() => storage.clear())

test('Phase 4: Key enthält die packageId', () => {
  const item = bank('p01')
  assert.match(createPackageProgressKey(item.packageId, createPackageBankFingerprint(item)), /^pwl-quiz-package-progress:v1:p01:/)
})

test('Phase 4: Key enthält den Bank-Fingerprint', () => {
  const item = bank()
  const fingerprint = createPackageBankFingerprint(item)
  assert.ok(createPackageProgressKey(item.packageId, fingerprint).endsWith(fingerprint))
})

test('Phase 4: unterschiedliche packageIds haben getrennte Sessions', () => {
  const p01 = bank('p01')
  const p02 = bank('p02')
  savedProgress(p01)
  savedProgress(p02)
  assert.notEqual(createPackageProgressKey('p01', createPackageBankFingerprint(p01)), createPackageProgressKey('p02', createPackageBankFingerprint(p02)))
  assert.equal(loadPackageProgress(p01).packageId, 'p01')
  assert.equal(loadPackageProgress(p02).packageId, 'p02')
})

test('Phase 4: unterschiedliche Fingerprints desselben Pakets sind getrennt und inkompatibel', () => {
  const oldBank = bank('p01', 'alt')
  const newBank = bank('p01', 'neu')
  savedProgress(oldBank)
  assert.notEqual(createPackageBankFingerprint(oldBank), createPackageBankFingerprint(newBank))
  assert.equal(loadPackageProgress(newBank).currentQuestionIndex, 0)
  assert.deepEqual(loadPackageProgress(newBank).answers, {})
})

test('Phase 4: Session wird gespeichert und geladen', () => {
  const item = bank()
  savedProgress(item)
  assert.equal(loadPackageProgress(item).packageTitle, 'Paket p01')
})

test('Phase 4: currentQuestionIndex bleibt erhalten', () => {
  const item = bank()
  savedProgress(item)
  assert.equal(loadPackageProgress(item).currentQuestionIndex, 2)
})

test('Phase 5A.3: MC-Antwort bleibt als kanonischer Options-Index erhalten, nicht als Text', () => {
  const item = bank() // options: ['A', 'B', 'C', 'D'], selected 'A' -> canonical index 0
  savedProgress(item)
  assert.deepEqual(loadPackageProgress(item).answers['p01-mc'], { questionType: 'mc', selectedOptionIndex: 0, correct: true })
})

test('Phase 4: Ja-Nein-Antwort bleibt erhalten', () => {
  const item = bank()
  savedProgress(item)
  assert.deepEqual(loadPackageProgress(item).answers['p01-yn'], { questionType: 'yesNo', selectedAnswer: false, correct: false })
})

test('Phase 5A.1: Freitext userAnswer wird NICHT persistiert (Privacy)', () => {
  const item = bank()
  savedProgress(item)
  const stored = loadPackageProgress(item).answers['p01-free']
  assert.equal('userAnswer' in stored, false)
  assert.equal(stored.answered, true)
})

test('Phase 4: Freitext-Status bleibt erhalten', () => {
  const item = bank()
  savedProgress(item)
  assert.equal(loadPackageProgress(item).answers['p01-free'].status, 'yellow')
})

test('Phase 4: Statistik bleibt erhalten', () => {
  const item = bank()
  savedProgress(item)
  assert.deepEqual(loadPackageProgress(item).statistics, {
    mcYesNoCorrect: 1, mcYesNoWrong: 1,
    freeTextGreen: 0, freeTextYellow: 1, freeTextRed: 0,
  })
})

test('Phase 4: completed-Status bleibt erhalten', () => {
  const item = bank()
  savedProgress(item)
  assert.equal(loadPackageProgress(item).sessionStatus, 'completed')
})

test('Phase 4: Reset löscht nur den konkreten Paket-Fingerprint-Key', () => {
  const item = bank()
  savedProgress(item)
  const key = createPackageProgressKey(item.packageId, createPackageBankFingerprint(item))
  clearPackageProgress(item)
  assert.equal(storage.has(key), false)
})

test('Phase 4: anderes Paket bleibt nach Reset erhalten', () => {
  const p01 = bank('p01')
  const p02 = bank('p02')
  savedProgress(p01)
  savedProgress(p02)
  clearPackageProgress(p01)
  assert.equal(loadPackageProgress(p02).currentQuestionIndex, 2)
})

test('Phase 4: vollständige Fragenbank wird nicht im Storage abgelegt', () => {
  const item = bank('p01', 'privater Inhalt')
  savedProgress(item)
  const key = createPackageProgressKey(item.packageId, createPackageBankFingerprint(item))
  const raw = storage.get(key)
  const parsed = JSON.parse(raw)
  assert.equal(raw.includes('MC-Frage privater Inhalt'), false)
  assert.equal(raw.includes('Ja-Nein-Frage privater Inhalt'), false)
  assert.equal('questions' in parsed, false)
})

test('Phase 4: Paketstore verändert bestehende MC- und Freitext-Keys nicht', () => {
  const item = bank()
  storage.set('pwl-quiz-mc-session:v1', '{"mc":"unverändert"}')
  storage.set('pwl-quiz-progress:v1:freeText-demo', '{"freeText":"unverändert"}')
  savedProgress(item)
  clearPackageProgress(item)
  assert.equal(storage.get('pwl-quiz-mc-session:v1'), '{"mc":"unverändert"}')
  assert.equal(storage.get('pwl-quiz-progress:v1:freeText-demo'), '{"freeText":"unverändert"}')
})

const RAW_USER_ANSWER_SENTINEL = 'RAW_USER_ANSWER_SENTINEL_5921'
const PRIVATE_OPTION_TEXT_SENTINEL = 'PRIVATE_OPTION_TEXT_SENTINEL_7319'

test('Phase 5A.3: privater MC-Optionstext wird nie persistiert, nur der kanonische Index', () => {
  const item = {
    packageId: 'p01',
    packageTitle: 'Paket p01',
    questions: [{ questionId: 'p01-mc', questionType: 'mc', question: 'MC?', options: ['A', PRIVATE_OPTION_TEXT_SENTINEL, 'C', 'D'], correctAnswer: 'A' }],
  }
  const progress = { ...createInitialPackageProgress(item), answers: { 'p01-mc': { questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL, correct: false } } }
  savePackageProgress(item, progress)
  const key = createPackageProgressKey(item.packageId, createPackageBankFingerprint(item))
  const raw = storage.get(key)
  assert.equal(raw.includes(PRIVATE_OPTION_TEXT_SENTINEL), false)
  const loaded = loadPackageProgress(item)
  assert.deepEqual(loaded.answers['p01-mc'], { questionType: 'mc', selectedOptionIndex: 1, correct: false })
})

test('Phase 5A.3: Legacy-MC-Datensatz mit privatem Optionstext wird beim Laden auf Index saniert', () => {
  const item = {
    packageId: 'p01',
    packageTitle: 'Paket p01',
    questions: [{ questionId: 'p01-mc', questionType: 'mc', question: 'MC?', options: ['A', PRIVATE_OPTION_TEXT_SENTINEL, 'C', 'D'], correctAnswer: 'A' }],
  }
  const key = createPackageProgressKey(item.packageId, createPackageBankFingerprint(item))
  const legacy = { ...createInitialPackageProgress(item), answers: { 'p01-mc': { questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL, correct: false } } }
  storage.set(key, JSON.stringify(legacy))

  const loaded = loadPackageProgress(item)
  assert.equal('selectedAnswer' in loaded.answers['p01-mc'], false)
  assert.equal(loaded.answers['p01-mc'].selectedOptionIndex, 1)

  // re-saving after migration must not resurrect the raw option text
  savePackageProgress(item, loaded)
  assert.equal(storage.get(key).includes(PRIVATE_OPTION_TEXT_SENTINEL), false)
})

test('Phase 5A.1: Legacy-Paket-Datensatz mit roher Antwort wird beim Laden saniert', () => {
  const item = bank()
  const key = createPackageProgressKey(item.packageId, createPackageBankFingerprint(item))
  const legacy = {
    schemaVersion: 1,
    packageId: item.packageId,
    bankFingerprint: createPackageBankFingerprint(item),
    packageTitle: item.packageTitle,
    currentQuestionIndex: 1,
    sessionSize: 'all',
    questionTypeFilter: 'mixed',
    orderedQuestionIds: [`${item.packageId}-free`],
    sessionStatus: 'inProgress',
    answers: { [`${item.packageId}-free`]: { questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL, status: 'yellow' } },
    statistics: { mcYesNoCorrect: 0, mcYesNoWrong: 0, freeTextGreen: 0, freeTextYellow: 1, freeTextRed: 0 },
    updatedAt: null,
  }
  storage.set(key, JSON.stringify(legacy))

  const loaded = loadPackageProgress(item)
  assert.equal('userAnswer' in loaded.answers[`${item.packageId}-free`], false)
  assert.equal(loaded.answers[`${item.packageId}-free`].status, 'yellow')

  // re-saving after migration must not resurrect the raw answer
  savePackageProgress(item, loaded)
  const raw = storage.get(key)
  assert.equal(raw.includes(RAW_USER_ANSWER_SENTINEL), false)
})

test('Phase 5A.1: fehlerhafter Paket-Storage-Inhalt crasht nicht', () => {
  const item = bank()
  const key = createPackageProgressKey(item.packageId, createPackageBankFingerprint(item))
  storage.set(key, '{not valid json')
  assert.doesNotThrow(() => loadPackageProgress(item))
  const loaded = loadPackageProgress(item)
  assert.deepEqual(loaded.answers, {})
})

test('Phase 4: bestehende Modi und Paketmodus verwenden getrennte Storage-Namespaces', async () => {
  const [mcSessionStore, freeTextStore, packageStore] = await Promise.all([
    readFile(new URL('../src/utils/mcSessionStore.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/utils/progressStore.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/utils/packageProgressStore.js', import.meta.url), 'utf8'),
  ])
  assert.match(mcSessionStore, /pwl-quiz-mc-session:v1/)
  assert.match(freeTextStore, /pwl-quiz-progress:v1:/)
  assert.match(packageStore, /pwl-quiz-package-progress:v1:/)
  assert.doesNotMatch(packageStore, /pwl-quiz-mc-session:v1|pwl-quiz-progress:v1:(?!')/)
})
