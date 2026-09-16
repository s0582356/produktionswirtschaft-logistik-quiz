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

test('Phase 4: MC-Antwort bleibt erhalten', () => {
  const item = bank()
  savedProgress(item)
  assert.deepEqual(loadPackageProgress(item).answers['p01-mc'], { questionType: 'mc', selectedAnswer: 'A', correct: true })
})

test('Phase 4: Ja-Nein-Antwort bleibt erhalten', () => {
  const item = bank()
  savedProgress(item)
  assert.deepEqual(loadPackageProgress(item).answers['p01-yn'], { questionType: 'yesNo', selectedAnswer: false, correct: false })
})

test('Phase 4: Freitext userAnswer bleibt erhalten', () => {
  const item = bank()
  savedProgress(item)
  assert.equal(loadPackageProgress(item).answers['p01-free'].userAnswer, 'Meine gespeicherte Antwort')
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

test('Phase 4: bestehende Modi und Paketmodus verwenden getrennte Storage-Namespaces', async () => {
  const [app, freeTextStore, packageStore] = await Promise.all([
    readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/utils/progressStore.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/utils/packageProgressStore.js', import.meta.url), 'utf8'),
  ])
  assert.match(app, /pwl-quiz-mc-session:v1/)
  assert.match(freeTextStore, /pwl-quiz-progress:v1:/)
  assert.match(packageStore, /pwl-quiz-package-progress:v1:/)
  assert.doesNotMatch(packageStore, /pwl-quiz-mc-session:v1|pwl-quiz-progress:v1:(?!')/)
})
