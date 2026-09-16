import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateFreeText } from '../src/utils/freeTextEvaluator.js'
import {
  advanceToNextQuestion,
  createPackageSession,
  evaluateMcAnswer,
  evaluateYesNoAnswer,
  finishPackageSession,
  getCurrentQuestion,
  isLastPackageQuestion,
  isPackageLoaded,
  recordFreeTextEvaluation,
  recordObjectiveAnswer,
  resetPackageSession,
} from '../src/utils/packageTrainerLogic.js'

function demoPackageBank() {
  return {
    packageId: 'p01',
    packageTitle: 'Testpaket',
    packageNumber: 1,
    questions: [
      {
        questionId: 'p01-mc-001', questionType: 'mc', question: 'MC-Frage?',
        options: ['A', 'B', 'C', 'D'], correctAnswer: 'B', explanation: 'E.',
      },
      {
        questionId: 'p01-yn-001', questionType: 'yesNo', statement: 'Aussage.',
        correctAnswer: true, explanation: 'E.',
      },
      {
        questionId: 'p01-free-001', questionType: 'freeText', question: 'Freitextfrage?',
        modelAnswer: 'Musterantwort.',
        checkpoints: [{ label: 'Punkt', anyOf: ['schluesselwort'] }],
      },
    ],
  }
}

test('1. geladene Paket-Kachel ist startbar', () => {
  const importedPackages = { p01: demoPackageBank() }
  assert.equal(isPackageLoaded(importedPackages, 'p01'), true)
})

test('2. ungeladene Paket-Kachel ist nicht startbar', () => {
  const importedPackages = { p01: demoPackageBank() }
  assert.equal(isPackageLoaded(importedPackages, 'p02'), false)
  assert.equal(isPackageLoaded({}, 'p01'), false)
  assert.equal(isPackageLoaded({ p03: { questions: [] } }, 'p03'), false)
})

test('3. MC richtige Antwort wird korrekt erkannt', () => {
  const bank = demoPackageBank()
  assert.equal(evaluateMcAnswer(bank.questions[0], 'B'), true)
})

test('4. MC falsche Antwort wird korrekt erkannt', () => {
  const bank = demoPackageBank()
  assert.equal(evaluateMcAnswer(bank.questions[0], 'A'), false)
})

test('5. Ja = true korrekt erkannt', () => {
  const bank = demoPackageBank()
  assert.equal(evaluateYesNoAnswer(bank.questions[1], true), true)
})

test('6. Nein = false korrekt erkannt (bei correctAnswer false)', () => {
  const question = { statement: 'X', correctAnswer: false, explanation: 'E.' }
  assert.equal(evaluateYesNoAnswer(question, false), true)
})

test('7. falsche Ja/Nein-Antwort wird korrekt erkannt', () => {
  const bank = demoPackageBank()
  assert.equal(evaluateYesNoAnswer(bank.questions[1], false), false)
})

test('8. Freitext-Aufzeichnung nutzt das Ergebnis des bestehenden freeTextEvaluator.js', () => {
  const bank = demoPackageBank()
  const freeTextQuestion = bank.questions[2]
  const evaluation = evaluateFreeText(freeTextQuestion, 'Das schluesselwort taucht hier vollstaendig auf, weil es erklaert wird.')
  assert.ok(['green', 'yellow', 'red'].includes(evaluation.rating))

  const session = createPackageSession()
  recordFreeTextEvaluation(session, evaluation.rating)
  assert.equal(session.stats.freeText[evaluation.rating], 1)
  assert.equal(session.stats.answered, 1)
})

test('9. Frage-Navigation endet korrekt nach der letzten Frage', () => {
  const bank = demoPackageBank()
  const session = createPackageSession()

  assert.equal(isLastPackageQuestion(bank, session), false)
  advanceToNextQuestion(bank, session)
  assert.equal(session.currentIndex, 1)
  advanceToNextQuestion(bank, session)
  assert.equal(session.currentIndex, 2)
  assert.equal(isLastPackageQuestion(bank, session), true)

  advanceToNextQuestion(bank, session)
  assert.equal(session.currentIndex, 2, 'nach der letzten Frage darf der Index nicht weiterlaufen')
  assert.equal(getCurrentQuestion(bank, session).questionId, 'p01-free-001')
})

test('10. Abschlussstatistik trennt MC/Ja-Nein von Freitext', () => {
  const session = createPackageSession()
  recordObjectiveAnswer(session, true)
  recordObjectiveAnswer(session, false)
  recordFreeTextEvaluation(session, 'green')
  recordFreeTextEvaluation(session, 'yellow')
  recordFreeTextEvaluation(session, 'red')

  assert.equal(session.stats.correct, 1)
  assert.equal(session.stats.wrong, 1)
  assert.deepEqual(session.stats.freeText, { green: 1, yellow: 1, red: 1 })
  assert.equal(session.stats.answered, 5)
})

test('11. erneuter Paketstart setzt nur die Paket-Session zurück', () => {
  const bank = demoPackageBank()
  const session = createPackageSession()
  advanceToNextQuestion(bank, session)
  recordObjectiveAnswer(session, true)
  finishPackageSession(session)

  const untouchedBankSnapshot = JSON.stringify(bank)
  resetPackageSession(session)

  assert.equal(session.currentIndex, 0)
  assert.equal(session.isComplete, false)
  assert.deepEqual(session.stats, { answered: 0, correct: 0, wrong: 0, freeText: { green: 0, yellow: 0, red: 0 } })
  assert.equal(JSON.stringify(bank), untouchedBankSnapshot, 'die Paketbank selbst darf durch einen Reset nicht verändert werden')
})

test('12. Rückkehr zur Paketauswahl behält die importierte Paketbank In-Memory unverändert', () => {
  const bank = Object.freeze(demoPackageBank())
  const session = createPackageSession()

  advanceToNextQuestion(bank, session)
  recordObjectiveAnswer(session, true)
  recordFreeTextEvaluation(session, 'green')
  finishPackageSession(session)

  assert.equal(bank.questions.length, 3, 'die eingefrorene Paketbank darf von keiner Session-Funktion mutiert werden')
  assert.equal(bank.packageId, 'p01')
})
