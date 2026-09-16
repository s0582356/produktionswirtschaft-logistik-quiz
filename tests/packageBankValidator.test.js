import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPackageBank, validatePackageBank } from '../src/utils/packageBankValidator.js'

function validPackage(overrides = {}) {
  return {
    type: 'package',
    schemaVersion: 1,
    packageId: 'p01',
    packageTitle: 'Rechenblock: ABC/XYZ, Stücklisten',
    packageNumber: 1,
    packagePriority: 'A',
    tags: ['ABC', 'XYZ'],
    questions: [
      {
        questionId: 'p01-mc-001',
        questionType: 'mc',
        difficulty: 'easy',
        question: 'Synthetische Testfrage MC?',
        options: ['Antwort A', 'Antwort B', 'Antwort C', 'Antwort D'],
        correctAnswer: 'Antwort A',
        explanation: 'Synthetische Erklärung.',
      },
      {
        questionId: 'p01-yn-001',
        questionType: 'yesNo',
        difficulty: 'medium',
        statement: 'Synthetische Testaussage.',
        correctAnswer: true,
        explanation: 'Synthetische Erklärung.',
      },
      {
        questionId: 'p01-free-001',
        questionType: 'freeText',
        difficulty: 'medium',
        question: 'Synthetische Freitextfrage?',
        modelAnswer: 'Synthetische Musterantwort.',
        checkpoints: [{ label: 'Testpunkt', anyOf: ['test'] }],
      },
    ],
    ...overrides,
  }
}

test('isPackageBank erkennt gültige Paket-Container und lehnt andere Formate ab', () => {
  assert.equal(isPackageBank(validPackage()), true)
  assert.equal(isPackageBank([{ options: [], correctAnswer: 'a' }]), false)
  assert.equal(isPackageBank({ type: 'methodTrainer', methods: [] }), false)
  assert.equal(isPackageBank(null), false)
})

test('1. gültige Paketbank wird erkannt und akzeptiert', () => {
  const result = validatePackageBank(validPackage())
  assert.equal(result.type, 'package')
  assert.equal(result.packageId, 'p01')
})

test('2. packageId p01 wird packageNumber 1 (Paket 01) zugeordnet', () => {
  const result = validatePackageBank(validPackage())
  assert.equal(result.packageId, 'p01')
  assert.equal(result.packageNumber, 1)
})

test('3. Metadaten und Frageanzahlen werden korrekt berechnet', () => {
  const result = validatePackageBank(validPackage())
  assert.equal(result.packageTitle, 'Rechenblock: ABC/XYZ, Stücklisten')
  assert.equal(result.packagePriority, 'A')
  assert.deepEqual(result.tags, ['ABC', 'XYZ'])
  assert.deepEqual(result.counts, { total: 3, mc: 1, yesNo: 1, freeText: 1 })
})

test('5. ungültige packageId wird abgelehnt', () => {
  assert.throws(() => validatePackageBank(validPackage({ packageId: 'p99', packageNumber: 99 })), /Unbekannte packageId/)
})

test('6. packageNumber-Mismatch wird abgelehnt', () => {
  assert.throws(() => validatePackageBank(validPackage({ packageNumber: 2 })), /passt nicht zu/)
})

test('7. ungültiger questionType wird abgelehnt', () => {
  const bank = validPackage()
  bank.questions[0].questionType = 'calculation'
  assert.throws(() => validatePackageBank(bank), /unbekannter questionType/)
})

test('8. MC-Frage mit ungleich 4 Optionen wird abgelehnt', () => {
  const bank = validPackage()
  bank.questions[0].options = ['Nur zwei', 'Optionen']
  assert.throws(() => validatePackageBank(bank), /genau 4 Antwortoptionen/)
})

test('9. Ja/Nein-Frage mit nicht-booleschem correctAnswer wird abgelehnt', () => {
  const bank = validPackage()
  bank.questions[1].correctAnswer = 'ja'
  assert.throws(() => validatePackageBank(bank), /Wahrheitswert/)
})

test('10. Freitext-Frage ohne checkpoints wird abgelehnt', () => {
  const bank = validPackage()
  bank.questions[2].checkpoints = []
  assert.throws(() => validatePackageBank(bank), /checkpoints/)
})

test('Freitext-Checkpoint als leeres Objekt {} wird abgelehnt', () => {
  const bank = validPackage()
  bank.questions[2].checkpoints = [{}]
  assert.throws(() => validatePackageBank(bank), /Checkpoint 1 ist ungültig/)
})

test('Freitext-Checkpoint ohne anyOf/allOf/keywords/synonyms (nur label) wird abgelehnt', () => {
  const bank = validPackage()
  bank.questions[2].checkpoints = [{ label: 'Nur ein Label, keine Suchbegriffe' }]
  assert.throws(() => validatePackageBank(bank), /Checkpoint 1 ist ungültig/)
})

test('Freitext-Checkpoint mit leerem anyOf-Array wird abgelehnt', () => {
  const bank = validPackage()
  bank.questions[2].checkpoints = [{ label: 'Leeres anyOf', anyOf: [] }]
  assert.throws(() => validatePackageBank(bank), /Checkpoint 1 ist ungültig/)
})

test('Freitext-Checkpoint als leerer String wird abgelehnt', () => {
  const bank = validPackage()
  bank.questions[2].checkpoints = ['   ']
  assert.throws(() => validatePackageBank(bank), /Checkpoint 1 ist ungültig/)
})

test('gültige, von der App tatsächlich unterstützte Checkpoint-Varianten werden akzeptiert', () => {
  const variants = [
    { label: 'anyOf-Form', anyOf: ['begriff eins', 'begriff zwei'] },
    { label: 'keywords-Form (Alias von anyOf)', keywords: ['stichwort'] },
    {
      label: 'allOf-Form mit Gruppen',
      allOf: [['weniger', 'reduzieren'], ['einweg', 'einwegflasche']],
    },
    { label: 'synonyms-Form', synonyms: ['begriff'] },
    {
      label: 'anyOf kombiniert mit near-Beziehung',
      anyOf: ['verbesserung'],
      near: { terms: [['verbesserung'], ['umsetzbar']], maxDistance: 10 },
    },
    'Reiner String-Checkpoint ohne Objektform',
  ]

  variants.forEach((checkpoint) => {
    const bank = validPackage()
    bank.questions[2].checkpoints = [checkpoint]
    assert.doesNotThrow(() => validatePackageBank(bank), `Variante sollte akzeptiert werden: ${JSON.stringify(checkpoint)}`)
  })
})

test('fehlende Pflichtfelder auf Container-Ebene werden abgelehnt', () => {
  assert.throws(() => validatePackageBank(validPackage({ schemaVersion: 2 })), /schemaVersion/)
  assert.throws(() => validatePackageBank(validPackage({ packageTitle: '' })), /packageTitle/)
  assert.throws(() => validatePackageBank(validPackage({ packageNumber: 'eins' })), /packageNumber/)
  assert.throws(() => validatePackageBank(validPackage({ questions: [] })), /questions/)
})

test('doppelte questionId wird abgelehnt', () => {
  const bank = validPackage()
  bank.questions[1].questionId = bank.questions[0].questionId
  assert.throws(() => validatePackageBank(bank), /Doppelte questionId/)
})

test('optionale Felder packagePriority und tags werden bei falschem Typ abgelehnt', () => {
  assert.throws(() => validatePackageBank(validPackage({ packagePriority: 5 })), /packagePriority/)
  assert.throws(() => validatePackageBank(validPackage({ tags: 'ABC' })), /tags/)
})
