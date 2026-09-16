import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPackageRound } from '../src/utils/packageRoundLogic.js'
import { createInitialPackageProgress, loadPackageProgress, savePackageProgress } from '../src/utils/packageProgressStore.js'

const storage = new Map()
global.window = { localStorage: {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
} }

function questions() {
  return ['mc', 'yesNo', 'freeText'].flatMap((questionType) => Array.from({ length: 12 }, (_, index) => ({
    questionId: `${questionType}-${index + 1}`,
    questionType,
    question: `${questionType} ${index + 1}`,
    difficulty: 'later-metadata-is-retained',
  })))
}
function sequenceRandom(values) { let index = 0; return () => values[index++ % values.length] }

test('Phase 5a: Schnellrunde enthält höchstens 10 eindeutige Fragen', () => {
  const round = createPackageRound(questions(), { sessionSize: 10, questionTypeFilter: 'mixed' }, sequenceRandom([.1, .8, .3]))
  assert.equal(round.orderedQuestionIds.length, 10)
  assert.equal(new Set(round.orderedQuestionIds).size, 10)
})

test('Phase 5a: normale Runde enthält höchstens 20 Fragen', () => {
  assert.equal(createPackageRound(questions(), { sessionSize: 20 }, () => .4).orderedQuestionIds.length, 20)
})

test('Phase 5a: komplettes Paket enthält jede Frage genau einmal', () => {
  const round = createPackageRound(questions(), { sessionSize: 'all' }, () => .2)
  assert.equal(round.orderedQuestionIds.length, questions().length)
  assert.equal(new Set(round.orderedQuestionIds).size, questions().length)
})

test('Phase 5a: MC-Filter enthält ausschließlich MC-Fragen', () => {
  const round = createPackageRound(questions(), { sessionSize: 'all', questionTypeFilter: 'mc' }, () => .5)
  assert.ok(round.orderedQuestionIds.every((id) => id.startsWith('mc-')))
})

test('Phase 5a: Ja-Nein-Filter enthält ausschließlich Ja-Nein-Fragen', () => {
  const round = createPackageRound(questions(), { sessionSize: 'all', questionTypeFilter: 'yesNo' }, () => .5)
  assert.ok(round.orderedQuestionIds.every((id) => id.startsWith('yesNo-')))
})

test('Phase 5a: Freitext-Filter enthält ausschließlich Freitext-Fragen', () => {
  const round = createPackageRound(questions(), { sessionSize: 'all', questionTypeFilter: 'freeText' }, () => .5)
  assert.ok(round.orderedQuestionIds.every((id) => id.startsWith('freeText-')))
})

test('Phase 5a: Mixed deckt alle verfügbaren Typen ab und vermeidet unnötige Blöcke', () => {
  const source = questions()
  const round = createPackageRound(source, { sessionSize: 10, questionTypeFilter: 'mixed' }, sequenceRandom([.1, .7, .3, .9]))
  const types = round.orderedQuestionIds.map((id) => source.find((question) => question.questionId === id).questionType)
  assert.deepEqual(new Set(types), new Set(['mc', 'yesNo', 'freeText']))
  assert.ok(types.slice(1).some((type, index) => type !== types[index]), 'mindestens ein Typwechsel ist vorhanden')
  assert.ok(!types.some((type, index) => types[index + 1] === type && types[index + 2] === type), 'kein Dreierblock trotz verfügbarer Alternativen')
})

test('Phase 5a: kleinere Typbanken verwenden nur verfügbare Fragen ohne Duplikate', () => {
  const source = questions().filter((question) => question.questionType !== 'freeText').slice(0, 3)
  const round = createPackageRound(source, { sessionSize: 10, questionTypeFilter: 'mixed' }, () => .1)
  assert.equal(round.orderedQuestionIds.length, 3)
  assert.equal(new Set(round.orderedQuestionIds).size, 3)
})

test('Phase 5a: gespeicherte orderedQuestionIds und Rundeneinstellungen werden unverändert fortgesetzt', () => {
  const item = { packageId: 'p01', packageTitle: 'Test', questions: questions() }
  const round = createPackageRound(item.questions, { sessionSize: 10, questionTypeFilter: 'mixed' }, sequenceRandom([.2, .6]))
  savePackageProgress(item, { ...createInitialPackageProgress(item), ...round, currentQuestionIndex: 4 })
  const resumed = loadPackageProgress(item)
  assert.deepEqual(resumed.orderedQuestionIds, round.orderedQuestionIds)
  assert.equal(resumed.sessionSize, 10)
  assert.equal(resumed.questionTypeFilter, 'mixed')
  assert.equal(resumed.currentQuestionIndex, 4)
})

test('Phase 5a: neue Runde erhält mit neuer Zufallsfolge eine neue Reihenfolge', () => {
  const first = createPackageRound(questions(), { sessionSize: 10 }, () => .01)
  const restarted = createPackageRound(questions(), { sessionSize: 10 }, () => .99)
  assert.notDeepEqual(restarted.orderedQuestionIds, first.orderedQuestionIds)
})
