import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { validateMasterLernmentorLibrary } from '../src/utils/masterLernmentorLibrary.js'
import {
  clearMasterLernmentorProgress,
  computeMasterLernmentorProgressSummary,
  createInitialMasterLernmentorProgress,
  createMasterLernmentorProgressKey,
  loadMasterLernmentorProgress,
  saveMasterLernmentorProgress,
} from '../src/utils/masterLernmentorProgressStore.js'

const storage = new Map()
global.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
}
afterEach(() => storage.clear())

const PRIVATE_QUESTION_SENTINEL = 'ML_PRIVATE_QUESTION_SENTINEL_4471'
const PRIVATE_MASTER_CONTENT_SENTINEL = 'ML_PRIVATE_MASTERCONTENT_SENTINEL_2290'
const RAW_ANSWER_SENTINEL = 'ML_RAW_ANSWER_SENTINEL_6603'

function library(overrides = {}) {
  return validateMasterLernmentorLibrary({
    libraryId: 'pwl-master-lernmentor',
    chapters: [{
      chapter: { chapterId: 'c01', chapterNumber: '1', chapterTitle: 'Kapitel 1' },
      topics: [{
        topicId: 't01',
        topicTitle: 'Topic 1',
        learningPhase: { masterContent: `${PRIVATE_MASTER_CONTENT_SENTINEL} Masterinhalt.` },
        questions: [
          {
            questionId: 'q01',
            question: `${PRIVATE_QUESTION_SENTINEL} Frage 1?`,
            sourceStatus: 'SOURCE_OK',
            questionType: 'knowledge',
            coreConcepts: [],
            optionalConcepts: [],
            minimumSufficientAnswer: 'Minimal.',
            shortModelAnswer: 'Kurz.',
            masterExcerpt: 'Auszug.',
          },
          {
            questionId: 'q02',
            question: 'Frage 2?',
            sourceStatus: 'SOURCE_OK',
            questionType: 'knowledge',
            coreConcepts: [],
            optionalConcepts: [],
            minimumSufficientAnswer: 'Minimal.',
            shortModelAnswer: 'Kurz.',
            masterExcerpt: 'Auszug.',
          },
        ],
      }],
    }],
    ...overrides,
  })
}

test('leerer initialer Fortschritt enthält nur technische Felder', () => {
  const lib = library()
  const initial = createInitialMasterLernmentorProgress(lib, 'datei.json')
  assert.deepEqual(Object.keys(initial).sort(), [
    'currentChapterId', 'currentQuestionIndex', 'currentTopicId', 'fileName',
    'fingerprint', 'libraryId', 'ratings', 'schemaVersion', 'updatedAt',
  ])
})

test('Privacy: weder Fragetext noch Masterinhalt noch rohe Freitextantwort landen im Storage', () => {
  const lib = library()
  const progress = {
    ...createInitialMasterLernmentorProgress(lib, 'datei.json'),
    currentTopicId: 't01',
    currentQuestionIndex: 1,
    ratings: { q01: 'learn', q02: 'safe', rawAnswerAttempt: RAW_ANSWER_SENTINEL },
  }
  saveMasterLernmentorProgress(lib, progress)

  const raw = storage.get(createMasterLernmentorProgressKey(lib.libraryId, lib.fingerprint))
  assert.equal(raw.includes(PRIVATE_QUESTION_SENTINEL), false)
  assert.equal(raw.includes(PRIVATE_MASTER_CONTENT_SENTINEL), false)
  assert.equal(raw.includes(RAW_ANSWER_SENTINEL), false)

  const loaded = loadMasterLernmentorProgress(lib, 'datei.json')
  assert.deepEqual(loaded.ratings, { q01: 'learn', q02: 'safe' })
})

test('nur gültige Rating-Werte werden übernommen, unbekannte werden verworfen', () => {
  const lib = library()
  saveMasterLernmentorProgress(lib, {
    ...createInitialMasterLernmentorProgress(lib),
    ratings: { q01: 'safe', q02: 'geheimwert', unknownQuestion: 'learn' },
  })
  const loaded = loadMasterLernmentorProgress(lib)
  assert.deepEqual(loaded.ratings, { q01: 'safe' })
})

test('Resume: gleiche Bibliothek und gleicher Fingerprint stellen Position und Ratings wieder her', () => {
  const lib = library()
  saveMasterLernmentorProgress(lib, {
    ...createInitialMasterLernmentorProgress(lib),
    currentChapterId: 'c01',
    currentTopicId: 't01',
    currentQuestionIndex: 1,
    ratings: { q01: 'partial' },
  })
  const loaded = loadMasterLernmentorProgress(lib)
  assert.equal(loaded.currentChapterId, 'c01')
  assert.equal(loaded.currentTopicId, 't01')
  assert.equal(loaded.currentQuestionIndex, 1)
  assert.deepEqual(loaded.ratings, { q01: 'partial' })
})

test('Fingerprint-Isolation: andere Fragebank-Inhalte erzeugen keinen falschen Resume', () => {
  const libA = library()
  saveMasterLernmentorProgress(libA, {
    ...createInitialMasterLernmentorProgress(libA),
    ratings: { q01: 'learn' },
  })

  const libB = library({ chapters: [{
    chapter: { chapterId: 'c01', chapterNumber: '1', chapterTitle: 'Kapitel 1' },
    topics: [{
      topicId: 't01',
      topicTitle: 'Topic 1',
      learningPhase: { masterContent: 'Ein komplett anderer Inhalt.' },
      questions: [{
        questionId: 'q01',
        question: 'Eine ganz andere Frage?',
        sourceStatus: 'SOURCE_OK',
        questionType: 'knowledge',
        coreConcepts: [],
        optionalConcepts: [],
        minimumSufficientAnswer: 'Minimal.',
        shortModelAnswer: 'Kurz.',
        masterExcerpt: 'Auszug.',
      }],
    }],
  }] })

  assert.notEqual(libA.fingerprint, libB.fingerprint)
  const loadedForB = loadMasterLernmentorProgress(libB)
  assert.deepEqual(loadedForB.ratings, {})
  assert.equal(loadedForB.updatedAt, null)
})

test('andere libraryId erzeugt ebenfalls keinen falschen Resume', () => {
  const lib = library()
  saveMasterLernmentorProgress(lib, { ...createInitialMasterLernmentorProgress(lib), ratings: { q01: 'safe' } })
  const otherLib = { ...lib, libraryId: 'anderes-lernmentor-bank' }
  const loaded = loadMasterLernmentorProgress(otherLib)
  assert.deepEqual(loaded.ratings, {})
})

test('fehlerhafter Storage-Inhalt crasht nicht und liefert einen leeren Fortschritt', () => {
  const lib = library()
  storage.set(createMasterLernmentorProgressKey(lib.libraryId, lib.fingerprint), '{not valid json')
  assert.doesNotThrow(() => loadMasterLernmentorProgress(lib))
  assert.deepEqual(loadMasterLernmentorProgress(lib).ratings, {})
})

test('currentQuestionIndex wird auf die tatsächliche Fragenanzahl des Topics begrenzt', () => {
  const lib = library()
  saveMasterLernmentorProgress(lib, {
    ...createInitialMasterLernmentorProgress(lib),
    currentChapterId: 'c01',
    currentTopicId: 't01',
    currentQuestionIndex: 999,
  })
  const loaded = loadMasterLernmentorProgress(lib)
  assert.equal(loaded.currentQuestionIndex, 1)
})

test('clearMasterLernmentorProgress entfernt nur den Eintrag dieser Bibliothek', () => {
  const lib = library()
  saveMasterLernmentorProgress(lib, { ...createInitialMasterLernmentorProgress(lib), ratings: { q01: 'safe' } })
  storage.set('sonstiger-key', 'unberuehrt')
  clearMasterLernmentorProgress(lib)
  assert.equal(storage.has(createMasterLernmentorProgressKey(lib.libraryId, lib.fingerprint)), false)
  assert.equal(storage.get('sonstiger-key'), 'unberuehrt')
})

test('computeMasterLernmentorProgressSummary berechnet Zähler und Review-relevante Fragen aus ratings', () => {
  const lib = library()
  const progress = { ratings: { q01: 'learn', q02: 'safe' } }
  const summary = computeMasterLernmentorProgressSummary(lib, progress)
  assert.equal(summary.total, 2)
  assert.equal(summary.rated, 2)
  assert.equal(summary.percent, 100)
  assert.equal(summary.safe, 1)
  assert.equal(summary.learn, 1)
  assert.equal(summary.reviewRelevantCount, 1)
})
