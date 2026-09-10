import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ASSIGNMENT_ENGINES, evaluateMethodStep } from '../src/utils/methodTrainerEvaluator.js'
import { solutionDerivation } from '../src/utils/methodSolutionDerivation.js'
const bank = JSON.parse(readFileSync(new URL('../src/data/public/sampleMethodTrainerTasks.json', import.meta.url)))
const methods = bank.methods.filter(m => ASSIGNMENT_ENGINES.includes(m.engine))
const correctAnswers = task => Object.fromEntries(Object.entries(task.expectedResults).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))

test('Transport module has exactly three methods and nine synthetic tasks with closed fields', () => {
  assert.deepEqual(methods.map(m => m.methodId), ['verkehrstraeger-vergleich', 'transportkonzepte-zuordnung', 'routenplanung-tourenplanung'])
  assert.equal(bank.methods.length, 9)
  assert.equal(bank.methods.flatMap(m => m.tasks).length, 27)
  for (const m of methods) {
    assert.equal(m.category, 'Verkehr & Transport')
    assert.equal(m.tasks.length, 3)
    for (const t of m.tasks) {
      assert.equal(t.synthetic, true)
      assert.equal(t.inputSteps.length, m.steps.length)
      assert.equal(t.solutionDerivation.length, m.steps.length)
      assert.deepEqual(Object.keys(t.expectedResults).sort(), t.inputSteps.flat().map(f => f.key).sort())
      for (const fields of t.inputSteps) for (const f of fields) {
        assert(f.options.length > 1)
        const expected = t.expectedResults[f.key]
        for (const v of Array.isArray(expected) ? expected : [expected]) assert(f.options.some(o => o.value === v))
      }
    }
  }
})

test('Comparison uses only the five evidenced criteria and three levels, with ungraded special features', () => {
  const m = methods[0]
  const allowed = ['Distanz', 'Erreichbarkeit/Flexibilität', 'Abfertigungsgeschwindigkeit', 'Transportgeschwindigkeit', 'Kosten']
  assert.deepEqual(m.tasks[0].givenData.criteria, allowed)
  assert.deepEqual(m.tasks[1].givenData.carriers, ['Straße', 'Schiene', 'Pipeline'])
  assert.deepEqual(m.tasks[2].givenData.carriers, ['Schiene', 'Binnenschifffahrt'])
  for (const t of m.tasks) {
    assert(t.givenData.criteria.every(c => allowed.includes(c)))
    assert.equal(t.inputSteps[0].length, t.givenData.carriers.length * t.givenData.criteria.length)
    for (const f of t.inputSteps[0]) assert.equal(f.options.length, 3)
    assert(!JSON.stringify(t.inputSteps).includes('Besonderheiten'))
  }
  assert.deepEqual(m.tasks[0].inputSteps[0].map(f => m.tasks[0].expectedResults[f.key]), [
    'mittel', 'hoch', 'schnell', 'mittel', 'mittel',
    'weit', 'gering', 'aufwendig', 'hoch', 'hoch',
    'weit', 'gering', 'aufwendig', 'niedrig', 'gering',
  ])
  assert.deepEqual(m.tasks.map(t => [t.expectedResults.carrier, t.expectedResults.criterion]), [
    ['Luft', 'Transportgeschwindigkeit'], ['Straße', 'Erreichbarkeit/Flexibilität'], ['Binnenschifffahrt', 'Kosten'],
  ])
  const t = m.tasks[1], answers = correctAnswers(t)
  for (const distance of ['mittel', 'weit']) assert.equal(evaluateMethodStep(m.engine, t, 1, { ...answers, 'matrix.2.0': distance }).status, 'green')
  assert.equal(evaluateMethodStep(m.engine, t, 1, { ...answers, 'matrix.2.0': 'kurz' }).status, 'yellow')
})

test('Only core transport concepts are checked, including each confusion pair', () => {
  const m = methods[1]
  const allowed = ['Direktbelieferung', 'Konsignationslager', 'Speditionslager', 'Ansiedlung in Kundennähe', 'Milkrun', 'Gebietsspediteur', 'Cross-Docking I', 'Cross-Docking II']
  for (const t of m.tasks) for (const f of t.inputSteps[0]) assert.deepEqual(f.options.map(o => o.value), allowed)
  assert.deepEqual(m.tasks.map(t => t.inputSteps[0].map(f => t.expectedResults[f.key])), [
    allowed.slice(0, 4), ['Gebietsspediteur', 'Milkrun', 'Cross-Docking I', 'Cross-Docking II'], ['Konsignationslager', 'Milkrun', 'Cross-Docking II'],
  ])
})

test('Route planning follows module definitions and has only concept and tour-type assignments', () => {
  const m = methods[2]
  assert.deepEqual(m.tasks.map(t => t.inputSteps[0].map(f => t.expectedResults[f.key])), [
    ['Tourenplanung', 'Routenplanung'], ['Direktverkehr', 'Sternverkehr', 'Ringverkehr'], ['Routenplanung', 'Tourenplanung', 'Sternverkehr'],
  ])
  assert.match(m.formula[0], /mittel- und langfristig/)
  assert.match(m.formula[1], /kurzfristig.*Auslieferreihenfolge.*konkreten Tour/)
  for (const t of m.tasks) {
    assert.deepEqual(Object.keys(t.givenData).sort(), ['scenarios', 'terms'])
    assert(Object.values(t.expectedResults).every(v => typeof v === 'string'))
    assert(t.inputSteps.flat().every(f => f.options))
  }
})

test('Public transport content excludes ungrounded criteria, concepts and optimization content', () => {
  const text = JSON.stringify(methods)
  for (const forbidden of ['Umweltbelastung', 'Zuverlässigkeit', 'Kapazität', 'Reichweite', 'Gütereignung', 'Termindruck', 'Sammelverkehr', 'Sternfahrt', 'Rundfahrt', 'Traveling', 'Travelling', 'TSP', 'Graphalgorithmus', 'kürzester Weg', 'Routenoptimierung', 'Distanzmatrix']) assert(!text.includes(forbidden), forbidden)
})

test('Each transport field blocks omission, whitespace, invalid and wrong choices; solutions stay readable', () => {
  for (const m of methods) for (const t of m.tasks) {
    const answers = correctAnswers(t)
    for (let step = 1; step <= m.steps.length; step++) {
      assert.equal(evaluateMethodStep(m.engine, t, step, answers).status, 'green')
      const fields = t.inputSteps[step - 1]
      for (const f of fields) {
        for (const value of [undefined, '', ' ']) {
          const result = evaluateMethodStep(m.engine, t, step, { ...answers, [f.key]: value })
          assert.equal(result.status, 'red')
          assert.deepEqual(result.missingFields, [f.key])
        }
        const accepted = [].concat(t.expectedResults[f.key])
        const wrong = f.options.find(o => !accepted.includes(o.value)).value
        for (const value of [wrong, 'nicht in der Auswahl']) assert.notEqual(evaluateMethodStep(m.engine, t, step, { ...answers, [f.key]: value }).status, 'green')
      }
      const wrongAnswers = Object.fromEntries(fields.map(f => [f.key, 'nicht in der Auswahl']))
      assert.equal(evaluateMethodStep(m.engine, t, step, wrongAnswers).status, 'red')
      const rows = solutionDerivation(m, t, step)
      assert(rows.some(r => r.label === 'Herleitung / Modulmerkmal'))
      assert(rows.every(r => typeof r.value === 'string' && !r.value.includes('[object Object]')))
      assert.equal(t.solutionDerivation[step - 1].length, fields.length)
    }
  }
})
