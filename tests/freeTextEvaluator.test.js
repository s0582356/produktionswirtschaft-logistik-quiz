import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateFreeText } from '../src/utils/freeTextEvaluator.js'

const relationQuestion = {
  minWords: 8, greenThreshold: 1,
  checkpoints: [
    { label: 'gebrochen', anyOf: ['umgeladen', 'umladung'], critical: true, relationship: { subject: ['gebrochener Verkehr', 'gebrochenen Verkehr'], predicate: ['umgeladen', 'umladung'], sameClause: true } },
    { label: 'kombiniert', anyOf: ['geschlossen'], critical: true, relationship: { subject: ['kombinierter Verkehr', 'kombinierten Verkehr'], predicate: ['geschlossen', 'nicht umgepackt'], sameClause: true } },
  ],
}

const sequenceQuestion = {
  minWords: 5, greenThreshold: 1,
  checkpoints: [{
    label: 'Abfallhierarchie in Reihenfolge', critical: true,
    sequence: [['vermeidung'], ['vorbereitung zur wiederverwendung', 'wiederverwendung'], ['recycling'], ['sonstige verwertung', 'verwertung'], ['beseitigung']],
  }],
}

test('subject/predicate relationship binds concepts to their properties within one clause', () => {
  const correct = 'Beim gebrochenen Verkehr wird umgeladen. Beim kombinierten Verkehr bleibt die Ladeeinheit geschlossen und wird nicht umgepackt.'
  const variation = 'Gebrochener Verkehr bedeutet eine Umladung, während beim kombinierten Verkehr die Ladeeinheit geschlossen bleibt.'
  const reversed = 'Beim gebrochenen Verkehr bleibt alles geschlossen. Beim kombinierten Verkehr wird umgeladen.'
  assert.equal(evaluateFreeText(relationQuestion, correct).rating, 'green')
  assert.equal(evaluateFreeText(relationQuestion, variation).rating, 'green')
  assert.notEqual(evaluateFreeText(relationQuestion, reversed).rating, 'green')
})

test('sequence accepts ordered enumerations and natural wording, but rejects wrong order', () => {
  const ordered = 'Vermeidung, Vorbereitung zur Wiederverwendung, Recycling, sonstige Verwertung, Beseitigung.'
  const natural = 'Zuerst steht die Vermeidung. An zweiter Stelle folgt die Vorbereitung zur Wiederverwendung. Danach kommt Recycling, dann die sonstige Verwertung und zuletzt die Beseitigung.'
  const swapped = 'Vermeidung, Recycling, Vorbereitung zur Wiederverwendung, sonstige Verwertung, Beseitigung.'
  const reversed = 'Beseitigung, sonstige Verwertung, Recycling, Vorbereitung zur Wiederverwendung, Vermeidung.'
  const missing = 'Vermeidung, Vorbereitung zur Wiederverwendung, Recycling, Beseitigung.'
  assert.equal(evaluateFreeText(sequenceQuestion, ordered).rating, 'green')
  assert.equal(evaluateFreeText(sequenceQuestion, natural).rating, 'green')
  assert.notEqual(evaluateFreeText(sequenceQuestion, swapped).rating, 'green')
  assert.notEqual(evaluateFreeText(sequenceQuestion, reversed).rating, 'green')
  assert.notEqual(evaluateFreeText(sequenceQuestion, missing).rating, 'green')
})


test('competing subjects bound the predicate scope inside one sentence', () => {
  const question = {
    minWords: 8, greenThreshold: 1,
    checkpoints: [
      { label: 'gebrochen', anyOf: ['umladung'], critical: true, relationship: { subject: ['gebrochener verkehr'], predicate: ['umladung'], competingSubjects: ['gebrochener verkehr', 'kombinierter verkehr'], sameClause: true } },
      { label: 'kombiniert', anyOf: ['geschlossen'], critical: true, relationship: { subject: ['kombinierter verkehr'], predicate: ['geschlossen'], competingSubjects: ['gebrochener verkehr', 'kombinierter verkehr'], sameClause: true } },
    ],
  }
  const correctWithAnd = 'Beim gebrochenen Verkehr erfolgt eine Umladung und beim kombinierten Verkehr bleibt die Ladeeinheit geschlossen.'
  const reversed = 'Gebrochener Verkehr bedeutet derselbe Behälter geschlossen und kombinierter Verkehr bedeutet eine Umladung findet statt.'
  assert.equal(evaluateFreeText(question, correctWithAnd).rating, 'green')
  assert.notEqual(evaluateFreeText(question, reversed).rating, 'green')
})
