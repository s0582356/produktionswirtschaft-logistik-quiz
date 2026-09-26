import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isMasterLernmentorLibrary, readMasterLernmentorFile } from '../src/utils/masterLernmentorImport.js'
import { MASTER_LERNMENTOR_LIBRARY_ID } from '../src/utils/masterLernmentorLibrary.js'
import { classifyPrivateLibraryData } from '../src/utils/privateLibraryImport.js'

function validRaw() {
  return {
    libraryId: 'pwl-master-lernmentor',
    chapters: [{
      chapter: { chapterId: 'c01', chapterNumber: '1', chapterTitle: 'Kapitel 1' },
      topics: [{
        topicId: 't01',
        topicTitle: 'Topic 1',
        learningPhase: { masterContent: 'Masterinhalt.' },
        questions: [{
          questionId: 'q01',
          question: 'Frage?',
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
  }
}

function fakeFile(content, name = 'bank.json') {
  return { name, text: async () => content }
}

test('isMasterLernmentorLibrary erkennt eine gültige Master-Lernmentor-Struktur', () => {
  assert.equal(isMasterLernmentorLibrary(validRaw()), true)
})

test('isMasterLernmentorLibrary lehnt eine MC-Fragenliste ab', () => {
  assert.equal(isMasterLernmentorLibrary([{ question: 'x', options: ['a', 'b'], correctAnswer: 'a', explanation: 'y' }]), false)
})

test('isMasterLernmentorLibrary lehnt eine Paketbank ab', () => {
  assert.equal(isMasterLernmentorLibrary({ type: 'package', packageId: 'p01', questions: [] }), false)
})

test('isMasterLernmentorLibrary lehnt beliebige andere private JSON-Dateien ab', () => {
  assert.equal(isMasterLernmentorLibrary({ foo: 'bar' }), false)
  assert.equal(isMasterLernmentorLibrary(null), false)
  assert.equal(isMasterLernmentorLibrary([1, 2, 3]), false)
})

test('readMasterLernmentorFile importiert eine gültige FINAL-artige Bank', async () => {
  const result = await readMasterLernmentorFile(fakeFile(JSON.stringify(validRaw()), 'MEIN_MASTER.json'))
  assert.equal(result.fileName, 'MEIN_MASTER.json')
  assert.equal(result.library.libraryId, 'pwl-master-lernmentor')
  assert.equal(result.library.chapters.length, 1)
})

test('readMasterLernmentorFile lehnt kaputtes JSON mit klarer Fehlermeldung ab', async () => {
  await assert.rejects(
    () => readMasterLernmentorFile(fakeFile('{not valid json')),
    /gültige[s]? JSON/,
  )
})

test('readMasterLernmentorFile lehnt falschen Library-Typ mit klarer Fehlermeldung ab', async () => {
  await assert.rejects(
    () => readMasterLernmentorFile(fakeFile(JSON.stringify({ type: 'package', packageId: 'p01', questions: [] }))),
    /keine gültige Master-Lernmentor-Datei/,
  )
})

test('readMasterLernmentorFile lehnt fehlende Chapter/Topic-Struktur ab, ohne Stacktrace in der Nachricht', async () => {
  const raw = validRaw()
  delete raw.chapters[0].topics[0].learningPhase
  await assert.rejects(
    () => readMasterLernmentorFile(fakeFile(JSON.stringify(raw))),
    (error) => {
      assert.equal(error instanceof Error, true)
      assert.doesNotMatch(error.message, /at Object|node_modules|\.js:\d+:\d+/)
      return true
    },
  )
})

test('readMasterLernmentorFile lehnt doppelte IDs mit klarer Fehlermeldung ab', async () => {
  const raw = validRaw()
  raw.chapters[0].topics.push(JSON.parse(JSON.stringify(raw.chapters[0].topics[0])))
  await assert.rejects(
    () => readMasterLernmentorFile(fakeFile(JSON.stringify(raw))),
    /Doppelte topicId/,
  )
})

test('readMasterLernmentorFile ohne Datei liefert eine klare Fehlermeldung', async () => {
  await assert.rejects(() => readMasterLernmentorFile(null), /Keine Datei/)
})

// --- Phase 5C.1: Codex ML-001 - fremde libraryId darf trotz identischer Struktur nicht akzeptiert werden ---

const PRIVATE_QUESTION_SENTINEL = 'ML001_PRIVATE_QUESTION_SENTINEL_6614'
const PRIVATE_MASTER_CONTENT_SENTINEL = 'ML001_PRIVATE_MASTERCONTENT_SENTINEL_2837'

// Exact Codex repro shape: structurally identical chapters -> topics ->
// learningPhase.masterContent -> questions tree, all required fields present,
// but a foreign libraryId - the negative probe the red-team report used to
// get { classifier: true, accepted: true }.
function foreignLibraryWithValidStructure(libraryId = 'other-private-bank') {
  const raw = validRaw()
  raw.libraryId = libraryId
  raw.chapters[0].topics[0].learningPhase.masterContent = `${PRIVATE_MASTER_CONTENT_SENTINEL} Masterinhalt.`
  raw.chapters[0].topics[0].questions[0].question = `${PRIVATE_QUESTION_SENTINEL} Frage?`
  return raw
}

test('B. isMasterLernmentorLibrary: fremde libraryId + ansonsten identischer Baum => false (Codex ML-001 Repro, Classifier-Ebene)', () => {
  assert.equal(isMasterLernmentorLibrary(foreignLibraryWithValidStructure()), false)
})

test('C. isMasterLernmentorLibrary: fehlende libraryId => false', () => {
  const raw = foreignLibraryWithValidStructure()
  delete raw.libraryId
  assert.equal(isMasterLernmentorLibrary(raw), false)
})

test('D. isMasterLernmentorLibrary: ähnliche/prefix libraryId => false (kein Substring-/Prefix-Match)', () => {
  for (const libraryId of ['pwl-master-lernmentor-v2', 'pwl-master-lernmentor-alt', 'PWL-MASTER-LERNMENTOR', 'pwl-master-lernmentors']) {
    assert.equal(isMasterLernmentorLibrary(foreignLibraryWithValidStructure(libraryId)), false, `libraryId "${libraryId}" hätte abgelehnt werden müssen`)
  }
})

test('A. isMasterLernmentorLibrary: korrekte libraryId + valide Struktur => true', () => {
  assert.equal(isMasterLernmentorLibrary(foreignLibraryWithValidStructure(MASTER_LERNMENTOR_LIBRARY_ID)), true)
})

test('F. direkter Importer-Aufruf (readMasterLernmentorFile) mit fremder libraryId + valider Struktur => REJECT, keine privaten Inhalte im Fehler', async () => {
  const raw = foreignLibraryWithValidStructure()
  await assert.rejects(
    () => readMasterLernmentorFile(fakeFile(JSON.stringify(raw))),
    (error) => {
      assert.match(error.message, /keine gültige Master-Lernmentor-Datei/)
      assert.doesNotMatch(error.message, new RegExp(PRIVATE_QUESTION_SENTINEL))
      assert.doesNotMatch(error.message, new RegExp(PRIVATE_MASTER_CONTENT_SENTINEL))
      return true
    },
  )
})

test('G. andere private Library-Typen werden weiterhin korrekt klassifiziert und nicht versehentlich Master-Lernmentor', () => {
  // MC
  const mc = classifyPrivateLibraryData([{ question: 'x?', options: ['a', 'b'], correctAnswer: 'a', explanation: 'y' }])
  assert.equal(mc.type, 'mc')
  // Freitext
  const freeText = classifyPrivateLibraryData([{ question: 'x?', modelAnswer: 'y', checkpoints: ['y'] }])
  assert.equal(freeText.type, 'freeText')
  // Package Bank
  const pkg = classifyPrivateLibraryData({
    type: 'package', schemaVersion: 1, packageId: 'p01', packageTitle: 'Paket 1', packageNumber: 1,
    questions: [{ questionId: 'q1', questionType: 'yesNo', statement: 's', correctAnswer: true, explanation: 'e' }],
  })
  assert.equal(pkg.type, 'package')
  // Und umgekehrt: eine valide Master-Lernmentor-Struktur darf NICHT über den
  // allgemeinen privaten Importer (MC/Freitext/Paket) durchrutschen.
  assert.throws(() => classifyPrivateLibraryData(validRaw()), /Unbekanntes JSON-Format/)
})

test('H. UI-Import einer fremden Library liefert eine saubere Fehlermeldung ohne Stacktrace', async () => {
  const raw = foreignLibraryWithValidStructure()
  await assert.rejects(
    () => readMasterLernmentorFile(fakeFile(JSON.stringify(raw), 'fremde-bank.json')),
    (error) => {
      assert.equal(error instanceof Error, true)
      assert.doesNotMatch(error.message, /at Object|node_modules|\.js:\d+:\d+|TypeError|undefined is not/)
      return true
    },
  )
})
