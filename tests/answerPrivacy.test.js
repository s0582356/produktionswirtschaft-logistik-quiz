import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCompositeQuestionLookup,
  buildQuestionLookup,
  sanitizeAnswerRecord,
  sanitizeAnswerRecords,
} from '../src/utils/answerPrivacy.js'

const RAW_USER_ANSWER_SENTINEL = 'RAW_USER_ANSWER_SENTINEL_5921'
const PRIVATE_OPTION_TEXT_SENTINEL = 'PRIVATE_OPTION_TEXT_SENTINEL_7319'

function mcQuestion(options = ['A', PRIVATE_OPTION_TEXT_SENTINEL, 'C', 'D']) {
  return { questionId: 'q-mc', questionType: 'mc', options, correctAnswer: options[0] }
}

test('sanitizeAnswerRecord: Freitext behält nur answered/status, nie den Antworttext', () => {
  const sanitized = sanitizeAnswerRecord({ questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL, status: 'yellow' })
  assert.deepEqual(sanitized, { questionType: 'freeText', answered: true, status: 'yellow' })
})

test('sanitizeAnswerRecord: ungegradete Freitextantwort bleibt als "answered" ohne Status erkennbar', () => {
  const sanitized = sanitizeAnswerRecord({ questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL })
  assert.deepEqual(sanitized, { questionType: 'freeText', answered: true })
})

test('sanitizeAnswerRecord: ungültiger Freitext-Status wird verworfen, nicht durchgereicht', () => {
  const sanitized = sanitizeAnswerRecord({ questionType: 'freeText', userAnswer: 'x', status: 'purple' })
  assert.deepEqual(sanitized, { questionType: 'freeText', answered: true })
})

test('Phase 5A.3: sanitizeAnswerRecord: MC-Optionstext wird zu kanonischem Index aufgelöst, nie als Text übernommen', () => {
  const question = mcQuestion()
  const sanitized = sanitizeAnswerRecord({ questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL, correct: false }, question)
  assert.deepEqual(sanitized, { questionType: 'mc', selectedOptionIndex: 1, correct: false })
  assert.equal('selectedAnswer' in sanitized, false)
  assert.equal(JSON.stringify(sanitized).includes(PRIVATE_OPTION_TEXT_SENTINEL), false)
})

test('Phase 5A.3: sanitizeAnswerRecord: bereits kanonischer MC-Index bleibt unverändert (idempotent)', () => {
  const question = mcQuestion()
  const sanitized = sanitizeAnswerRecord({ questionType: 'mc', selectedOptionIndex: 1, correct: false }, question)
  assert.deepEqual(sanitized, { questionType: 'mc', selectedOptionIndex: 1, correct: false })
})

test('Phase 5A.3: sanitizeAnswerRecord: MC ohne bekannte Frage/Optionen verwirft die Auswahl defensiv statt Text zu übernehmen', () => {
  const sanitized = sanitizeAnswerRecord({ questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL, correct: false })
  assert.deepEqual(sanitized, { questionType: 'mc', correct: false })
  assert.equal('selectedOptionIndex' in sanitized, false)
})

test('Phase 5A.3: sanitizeAnswerRecord: MC-Index außerhalb des gültigen Bereichs wird verworfen', () => {
  const question = mcQuestion()
  const sanitized = sanitizeAnswerRecord({ questionType: 'mc', selectedOptionIndex: 99, correct: false }, question)
  assert.deepEqual(sanitized, { questionType: 'mc', correct: false })
})

test('Phase 5A.3: sanitizeAnswerRecord: unbekannter Legacy-Optionstext (Frage inzwischen geändert) wird verworfen', () => {
  const question = mcQuestion(['X', 'Y', 'Z', 'W']) // different options than the stored text could ever match
  const sanitized = sanitizeAnswerRecord({ questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL, correct: false }, question)
  assert.deepEqual(sanitized, { questionType: 'mc', correct: false })
})

test('sanitizeAnswerRecord: Ja/Nein behält selectedAnswer/correct', () => {
  const sanitized = sanitizeAnswerRecord({ questionType: 'yesNo', selectedAnswer: true, correct: true })
  assert.deepEqual(sanitized, { questionType: 'yesNo', selectedAnswer: true, correct: true })
})

test('sanitizeAnswerRecord: unbekannter/fehlender questionType wird verworfen', () => {
  assert.equal(sanitizeAnswerRecord({ questionType: 'unknown', foo: 'bar' }), null)
  assert.equal(sanitizeAnswerRecord({ selectedAnswer: 'A' }), null)
  assert.equal(sanitizeAnswerRecord(null), null)
  assert.equal(sanitizeAnswerRecord('a string'), null)
})

test('sanitizeAnswerRecords: verwirft ungültige Einträge, behält gültige, crasht nicht bei Fehlformat', () => {
  assert.deepEqual(sanitizeAnswerRecords(null), {})
  assert.deepEqual(sanitizeAnswerRecords(undefined), {})
  assert.deepEqual(sanitizeAnswerRecords('not-an-object'), {})
  const questionsById = new Map([['q1', mcQuestion(['A', 'B', 'C', 'D'])]])
  assert.deepEqual(
    sanitizeAnswerRecords({
      q1: { questionType: 'mc', selectedAnswer: 'A', correct: true },
      q2: { questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL, status: 'green' },
      q3: { bogus: true },
    }, questionsById),
    {
      q1: { questionType: 'mc', selectedOptionIndex: 0, correct: true },
      q2: { questionType: 'freeText', answered: true, status: 'green' },
    },
  )
})

test('Phase 5A.3: buildQuestionLookup indiziert nach bare questionId (PackageTrainer-Schema)', () => {
  const bank = { packageId: 'p01', questions: [mcQuestion(), { questionId: 'q-free', questionType: 'freeText' }] }
  const lookup = buildQuestionLookup(bank)
  assert.equal(lookup.get('q-mc').questionType, 'mc')
  assert.equal(lookup.get('q-free').questionType, 'freeText')
  assert.equal(lookup.get('unknown'), undefined)
})

test('Phase 5A.3: buildCompositeQuestionLookup indiziert nach packageId::questionId (TopicCheck/Exam-Schema)', () => {
  const library = { p01: { packageId: 'p01', questions: [mcQuestion()] }, p02: { packageId: 'p02', questions: [mcQuestion(['E', 'F', 'G', 'H'])] } }
  const lookup = buildCompositeQuestionLookup(library)
  assert.equal(lookup.get('p01::q-mc').options[0], 'A')
  assert.equal(lookup.get('p02::q-mc').options[0], 'E')
})

test('sanitizeAnswerRecords: Sentinel taucht in keiner serialisierten Ausgabe auf', () => {
  const sanitized = sanitizeAnswerRecords({
    q1: { questionType: 'freeText', userAnswer: RAW_USER_ANSWER_SENTINEL, status: 'red' },
  })
  assert.equal(JSON.stringify(sanitized).includes(RAW_USER_ANSWER_SENTINEL), false)
})

test('Phase 5A.3: sanitizeAnswerRecords: privater MC-Options-Sentinel taucht in keiner serialisierten Ausgabe auf', () => {
  const questionsById = new Map([['q1', mcQuestion()]])
  const sanitized = sanitizeAnswerRecords({
    q1: { questionType: 'mc', selectedAnswer: PRIVATE_OPTION_TEXT_SENTINEL, correct: false },
  }, questionsById)
  assert.equal(JSON.stringify(sanitized).includes(PRIVATE_OPTION_TEXT_SENTINEL), false)
  assert.equal(sanitized.q1.selectedOptionIndex, 1)
})

test('sanitizeAnswerRecord ist idempotent', () => {
  const once = sanitizeAnswerRecord({ questionType: 'freeText', userAnswer: 'x', status: 'green', extra: 'ignored' })
  const twice = sanitizeAnswerRecord(once)
  assert.deepEqual(once, twice)
})
