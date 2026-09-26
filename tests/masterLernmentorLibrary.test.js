import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MASTER_LERNMENTOR_LIBRARY_ID,
  countChapterQuestions,
  countLibraryQuestions,
  countTopicQuestions,
  createMasterLernmentorFingerprint,
  findChapter,
  findQuestion,
  findTopic,
  validateMasterLernmentorLibrary,
} from '../src/utils/masterLernmentorLibrary.js'

function question(id, overrides = {}) {
  return {
    questionId: id,
    question: `Frage ${id}?`,
    sourceStatus: 'SOURCE_OK',
    questionType: 'knowledge',
    coreConcepts: [{ conceptId: `${id}-c01`, label: 'Kernpunkt', description: 'Beschreibung', acceptedPhrases: ['kernpunkt'] }],
    optionalConcepts: [],
    minimumSufficientAnswer: 'Minimalantwort.',
    shortModelAnswer: 'Kurze Musterantwort.',
    masterExcerpt: 'Master-Auszug.',
    ...overrides,
  }
}

function topic(id, questions, overrides = {}) {
  return {
    topicId: id,
    topicNumber: '1.1',
    topicTitle: `Topic ${id}`,
    learningPhase: { masterContent: `Masterinhalt für ${id}` },
    questions,
    ...overrides,
  }
}

function chapterEntry(id, topics) {
  return { chapter: { chapterId: id, chapterNumber: '1', chapterTitle: `Kapitel ${id}` }, topics }
}

function minimalLibrary() {
  return {
    libraryId: 'pwl-master-lernmentor',
    version: 'v1',
    chapters: [
      chapterEntry('c01', [topic('t01', [question('q01'), question('q02')])]),
      chapterEntry('c02', [topic('t02', [question('q03')])]),
    ],
  }
}

test('gültige synthetische Bibliothek wird normalisiert und Zähler stimmen', () => {
  const library = validateMasterLernmentorLibrary(minimalLibrary())
  assert.equal(library.libraryId, 'pwl-master-lernmentor')
  assert.equal(library.chapters.length, 2)
  assert.equal(countTopicQuestions(library.chapters[0].topics[0]), 2)
  assert.equal(countChapterQuestions(library.chapters[0]), 2)
  assert.equal(countLibraryQuestions(library), 3)
  assert.ok(findChapter(library, 'c01'))
  assert.ok(findTopic(library, 'c01', 't01'))
  assert.ok(findQuestion(library, 'c01', 't01', 'q01'))
  assert.equal(findQuestion(library, 'c01', 't01', 'unknown'), null)
})

test('fehlendes learningPhase.masterContent wird abgelehnt', () => {
  const raw = minimalLibrary()
  delete raw.chapters[0].topics[0].learningPhase.masterContent
  assert.throws(() => validateMasterLernmentorLibrary(raw), /masterContent/)
})

test('leeres chapters-Array wird abgelehnt (generisch, nicht an 14 gekoppelt)', () => {
  assert.throws(() => validateMasterLernmentorLibrary({ libraryId: 'pwl-master-lernmentor', chapters: [] }), /nicht leeres Array/)
})

test('genau ein Kapitel/Topic/Frage wird akzeptiert (kein Hardcoding auf 14)', () => {
  const single = {
    libraryId: 'pwl-master-lernmentor',
    chapters: [chapterEntry('c01', [topic('t01', [question('q01')])])],
  }
  const library = validateMasterLernmentorLibrary(single)
  assert.equal(library.chapters.length, 1)
  assert.equal(countLibraryQuestions(library), 1)
})

test('doppelte questionId über Kapitelgrenzen hinweg wird abgelehnt', () => {
  const raw = minimalLibrary()
  raw.chapters[1].topics[0].questions[0].questionId = 'q01'
  assert.throws(() => validateMasterLernmentorLibrary(raw), /Doppelte questionId/)
})

test('doppelte topicId wird abgelehnt', () => {
  const raw = minimalLibrary()
  raw.chapters[1].topics[0].topicId = 't01'
  assert.throws(() => validateMasterLernmentorLibrary(raw), /Doppelte topicId/)
})

test('doppelte chapterId wird abgelehnt', () => {
  const raw = minimalLibrary()
  raw.chapters[1].chapter.chapterId = 'c01'
  assert.throws(() => validateMasterLernmentorLibrary(raw), /Doppelte chapterId/)
})

test('fehlende Pflichtfelder einer Frage (minimumSufficientAnswer) werden abgelehnt', () => {
  const raw = minimalLibrary()
  delete raw.chapters[0].topics[0].questions[0].minimumSufficientAnswer
  assert.throws(() => validateMasterLernmentorLibrary(raw), /minimumSufficientAnswer/)
})

test('leeres questions-Array in einem Topic wird abgelehnt', () => {
  const raw = minimalLibrary()
  raw.chapters[0].topics[0].questions = []
  assert.throws(() => validateMasterLernmentorLibrary(raw), /questions/)
})

test('fehlende optionale Felder werden defensiv defaultet, ohne Inhalte zu erfinden', () => {
  const raw = minimalLibrary()
  delete raw.chapters[0].topics[0].questions[0].optionalConcepts
  delete raw.chapters[0].topics[0].questions[0].hint
  delete raw.chapters[0].topics[0].questions[0].answerFlexibility
  const library = validateMasterLernmentorLibrary(raw)
  const normalizedQuestion = library.chapters[0].topics[0].questions[0]
  assert.deepEqual(normalizedQuestion.optionalConcepts, [])
  assert.equal(normalizedQuestion.hint, null)
  assert.deepEqual(normalizedQuestion.answerFlexibility, {
    wordingMatchRequired: false,
    equivalentOwnExamplesAllowed: false,
    caseBound: false,
  })
})

test('calculationRequirements bleibt unverändert erhalten, wenn vorhanden', () => {
  const raw = minimalLibrary()
  raw.chapters[0].topics[0].questions[0].calculationRequirements = {
    methodId: 'test-formel', formula: 'A = B / C', requiredVariables: ['B', 'C'],
  }
  const library = validateMasterLernmentorLibrary(raw)
  assert.deepEqual(library.chapters[0].topics[0].questions[0].calculationRequirements, {
    methodId: 'test-formel', formula: 'A = B / C', requiredVariables: ['B', 'C'],
  })
})

test('fehlt calculationRequirements, bleibt es null (kein Erfinden von Formeln)', () => {
  const library = validateMasterLernmentorLibrary(minimalLibrary())
  assert.equal(library.chapters[0].topics[0].questions[0].calculationRequirements, null)
})

test('Fingerprint ist deterministisch für identischen Inhalt und ändert sich bei Inhaltsänderung', () => {
  const libraryA = validateMasterLernmentorLibrary(minimalLibrary())
  const libraryB = validateMasterLernmentorLibrary(minimalLibrary())
  assert.equal(libraryA.fingerprint, libraryB.fingerprint)

  const changed = minimalLibrary()
  changed.chapters[0].topics[0].questions[0].question = 'Eine andere Frage?'
  const libraryC = validateMasterLernmentorLibrary(changed)
  assert.notEqual(libraryA.fingerprint, libraryC.fingerprint)
})

test('createMasterLernmentorFingerprint arbeitet direkt auf normalisierten chapters', () => {
  const library = validateMasterLernmentorLibrary(minimalLibrary())
  assert.equal(createMasterLernmentorFingerprint(library.chapters), library.fingerprint)
})

// --- Phase 5C.1: Codex ML-001 - libraryId-Identitätsprüfung im Validator ---

test('A. korrekte Master-Lernmentor libraryId + valide Struktur => ACCEPT', () => {
  const library = validateMasterLernmentorLibrary({ ...minimalLibrary(), libraryId: MASTER_LERNMENTOR_LIBRARY_ID })
  assert.equal(library.libraryId, MASTER_LERNMENTOR_LIBRARY_ID)
})

test('B. fremde libraryId + ansonsten identische valide Struktur => REJECT', () => {
  const foreign = { ...minimalLibrary(), libraryId: 'other-private-bank' }
  assert.throws(() => validateMasterLernmentorLibrary(foreign), /keine gültige Master-Lernmentor-Datei/)
})

test('C. fehlende libraryId => REJECT', () => {
  const raw = minimalLibrary()
  delete raw.libraryId
  assert.throws(() => validateMasterLernmentorLibrary(raw), /keine gültige Master-Lernmentor-Datei/)
})

test('D. ähnliche/prefix libraryId (kein Substring-/Prefix-Treffer erlaubt) => REJECT', () => {
  const variants = [
    'pwl-master-lernmentor-v2',
    'pwl-master-lernmentor-alt',
    'PWL-MASTER-LERNMENTOR',
    'pwl-master-lernmentor ',
    ' pwl-master-lernmentor',
    'pwl-master-lernment',
  ]
  for (const libraryId of variants) {
    assert.throws(
      () => validateMasterLernmentorLibrary({ ...minimalLibrary(), libraryId }),
      /keine gültige Master-Lernmentor-Datei/,
      `libraryId "${libraryId}" hätte abgelehnt werden müssen`,
    )
  }
})

test('E. korrekte libraryId + invalide Struktur (kaputte chapters) => REJECT', () => {
  assert.throws(
    () => validateMasterLernmentorLibrary({ libraryId: MASTER_LERNMENTOR_LIBRARY_ID, chapters: 'not-an-array' }),
    /nicht leeres Array/,
  )
  assert.throws(
    () => validateMasterLernmentorLibrary({ libraryId: MASTER_LERNMENTOR_LIBRARY_ID, chapters: [] }),
    /nicht leeres Array/,
  )
})
