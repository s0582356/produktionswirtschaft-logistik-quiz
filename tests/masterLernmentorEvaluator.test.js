import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMasterLernmentorAnswer } from '../src/utils/masterLernmentorEvaluator.js'

function question(overrides = {}) {
  return {
    coreConcepts: [
      { conceptId: 'c01', label: 'Seeck-Definition', acceptedPhrases: ['alles ist da, wo es gebraucht wird'] },
      { conceptId: 'c02', label: 'Baumgarten-Definition', acceptedPhrases: ['Planung, Steuerung, Durchführung und Kontrolle'] },
    ],
    optionalConcepts: [
      { conceptId: 'o01', label: 'Herkunft', acceptedPhrases: ['HTW Berlin'] },
    ],
    answerFlexibility: { wordingMatchRequired: false },
    ...overrides,
  }
}

test('leere Antwort führt zu "Vergleiche mit der Musterlösung"', () => {
  const result = evaluateMasterLernmentorAnswer(question(), '')
  assert.equal(result.hint, 'Vergleiche deine Antwort mit der Musterlösung.')
  assert.equal(result.hasAnswer, false)
  assert.equal(result.matchedCoreConceptCount, 0)
})

test('Antwort mit äquivalenter, nicht wortgleicher Formulierung erkennt den Kernbegriff (wordingMatchRequired=false wird respektiert)', () => {
  // Deliberately paraphrased/typo'd, not copy-pasted from acceptedPhrases.
  const result = evaluateMasterLernmentorAnswer(question(), 'Logistik sorgt dafür, dass alles ist da wo es gebraucht wird, immer verfügbar.')
  assert.ok(result.matchedCoreConceptCount >= 1)
  assert.ok(result.matchedCoreConceptIds.includes('c01'))
})

test('beide Kernbegriffe erkannt => "Viele zentrale Punkte erkannt."', () => {
  const answer = 'Alles ist da, wo es gebraucht wird. Außerdem Planung, Steuerung, Durchführung und Kontrolle aller Flüsse.'
  const result = evaluateMasterLernmentorAnswer(question(), answer)
  assert.equal(result.matchedCoreConceptCount, 2)
  assert.equal(result.hint, 'Viele zentrale Punkte erkannt.')
})

test('nur ein Kernbegriff erkannt => "Einige Kernpunkte könnten noch fehlen."', () => {
  const answer = 'Alles ist da, wo es gebraucht wird.'
  const result = evaluateMasterLernmentorAnswer(question(), answer)
  assert.equal(result.matchedCoreConceptCount, 1)
  assert.equal(result.hint, 'Einige Kernpunkte könnten noch fehlen.')
})

test('unpassende Antwort ohne erkannte Kernbegriffe => "Vergleiche mit der Musterlösung."', () => {
  const result = evaluateMasterLernmentorAnswer(question(), 'Völlig unrelated text ohne jeden Bezug.')
  assert.equal(result.matchedCoreConceptCount, 0)
  assert.equal(result.hint, 'Vergleiche deine Antwort mit der Musterlösung.')
})

test('optionale Konzepte werden separat erkannt, ohne die Kernbewertung zu beeinflussen', () => {
  const result = evaluateMasterLernmentorAnswer(question(), 'Alles ist da, wo es gebraucht wird, laut HTW Berlin.')
  assert.equal(result.matchedCoreConceptCount, 1)
  assert.deepEqual(result.matchedOptionalConceptIds, ['o01'])
})

test('nie "Richtig"/"Falsch"/"bestanden" im Hinweistext (kein Hard-Scoring)', () => {
  const cases = ['', 'irgendetwas', 'alles ist da, wo es gebraucht wird', 'Planung, Steuerung, Durchführung und Kontrolle']
  for (const answer of cases) {
    const { hint } = evaluateMasterLernmentorAnswer(question(), answer)
    assert.doesNotMatch(hint, /richtig|falsch|bestanden/i)
  }
})

test('fehlende coreConcepts/optionalConcepts werden defensiv als leer behandelt', () => {
  const result = evaluateMasterLernmentorAnswer({}, 'irgendeine Antwort')
  assert.equal(result.coreConceptCount, 0)
  assert.equal(result.matchedCoreConceptCount, 0)
})

test('Konzept ohne acceptedPhrases fällt auf das Label als Suchbegriff zurück', () => {
  const q = question({ coreConcepts: [{ conceptId: 'c01', label: 'Fertigungstiefe' }] })
  const result = evaluateMasterLernmentorAnswer(q, 'Die Fertigungstiefe beschreibt den Eigenfertigungsanteil.')
  assert.equal(result.matchedCoreConceptCount, 1)
})
