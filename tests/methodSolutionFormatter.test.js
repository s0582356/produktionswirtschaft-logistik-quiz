import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatMethodSolution } from '../src/utils/methodSolutionFormatter.js'
import { evaluateMethodStep } from '../src/utils/methodTrainerEvaluator.js'

const bank = JSON.parse(readFileSync(new URL('../src/data/public/sampleMethodTrainerTasks.json', import.meta.url)))
const abc = bank.methods.find(method => method.engine === 'abcAnalysis')
const abcTask = abc.tasks[0]
const format = (step, answers = {}) => formatMethodSolution(evaluateMethodStep(abc.engine, abcTask, step, answers).correctValues, abc.engine, step)

test('ABC step 1 stays green and displays currency', () => {
  const answers = { 'value.P1': 24000, 'value.P2': 15000, 'value.P3': 5000, 'value.P4': 4000, 'value.P5': 1600, total: 49600 }
  assert.equal(evaluateMethodStep(abc.engine, abcTask, 1, answers).status, 'green')
  assert.equal(format(1, answers).find(row => row.label === 'Gesamtverbrauchswert').value, '49.600,00 €')
})

test('ABC step 2 reveal, empty and wrong answers display order and percentages', () => {
  for (const answers of [{}, { 'rank.0': 'P5', 'share.P1': 0, 'cumulative.P1': 0 }]) {
    assert.equal(evaluateMethodStep(abc.engine, abcTask, 2, answers).status, 'red')
    const rows = format(2, answers)
    const value = label => rows.find(row => row.label === label)?.value
    assert.equal(value('Sortierung'), 'P1 → P2 → P3 → P4 → P5')
    assert.equal(value('Anteile · P1'), '48,39 %')
    assert.equal(value('Anteile · P2'), '30,24 %')
    assert.equal(value('Kumuliert · P2'), '78,63 %')
    assert.equal(value('Kumuliert · P5'), '100,00 %')
    assert(!JSON.stringify(rows).includes('[object Object]'))
  }
})

test('ABC step 3 displays each class', () => {
  assert.deepEqual(format(3), ['A', 'A', 'B', 'C', 'C'].map((value, index) => ({ label: `P${index + 1}`, value })))
})

test('all demo methods and steps produce readable reveal values without mutations', () => {
  assert.equal(bank.methods.length, 3)
  for (const method of bank.methods) {
    assert.equal(method.examples.length, 2)
    for (const task of method.tasks) for (let step = 1; step <= 3; step++) {
      const result = evaluateMethodStep(method.engine, task, step, {})
      const before = structuredClone(result)
      const rows = formatMethodSolution(result.correctValues, method.engine, step)
      assert(rows.length > 0)
      assert(rows.every(row => typeof row.value === 'string' && !row.value.includes('[object Object]')))
      assert.deepEqual(result, before)
    }
  }
  const bom = bank.methods.find(method => method.engine === 'billOfMaterials')
  assert.equal(formatMethodSolution(evaluateMethodStep(bom.engine, bom.tasks[0], 3, {}).correctValues, bom.engine, 3).find(row => row.label === 'X2').value, '1.050 Stück')
  const monthly = bank.methods.find(method => method.engine === 'monthlyDemandSplit')
  assert.deepEqual(formatMethodSolution(evaluateMethodStep(monthly.engine, monthly.tasks[0], 3, {}).correctValues, monthly.engine, 3), [
    { label: 'Sondermonat', value: '400 Stück' }, { label: 'Kontrollsumme Jahr', value: '2.600 Stück' },
  ])
})

test('generic nested objects, arrays, empty and nonfinite values are readable', () => {
  assert.deepEqual(formatMethodSolution({ group: [{ amount: 12 }, { amount: null }], order: ['X', 'Y'], shares: { X: 12.345 }, empty: [], invalid: NaN }), [
    { label: 'group · Eintrag 1 · amount', value: '12' },
    { label: 'group · Eintrag 2 · amount', value: '–' },
    { label: 'Sortierung', value: 'X → Y' },
    { label: 'Anteile · X', value: '12,35 %' },
    { label: 'empty', value: '–' },
    { label: 'invalid', value: '–' },
  ])
})

test('ABC empty and wrong answers show only the fields belonging to each step', () => {
  const ids = ['P1', 'P2', 'P3', 'P4', 'P5']
  const expectedLabels = {
    1: [...ids, 'Gesamtverbrauchswert'],
    2: ['Sortierung', ...ids.map(id => `Anteile · ${id}`), ...ids.map(id => `Kumuliert · ${id}`)],
    3: ids,
  }
  const wrongAnswers = { 'value.P1': -1, total: -1, 'rank.0': 'P5', 'share.P1': -1, 'class.P1': 'C' }
  for (let step = 1; step <= 3; step++) for (const answers of [{}, wrongAnswers]) {
    const evaluation = evaluateMethodStep(abc.engine, abcTask, step, answers)
    assert.equal(evaluation.status, 'red')
    const rows = format(step, answers)
    assert.deepEqual(rows.map(row => row.label), expectedLabels[step])
    assert(rows.every(row => !row.value.includes('[object Object]')))
    if (step === 3) assert.deepEqual(rows.map(row => row.value), ['A', 'A', 'B', 'C', 'C'])
  }
})

test('bill of materials and monthly demand expose only their own step values', () => {
  const expected = {
    billOfMaterials: [
      [{ label: 'BG1', value: '2 Stück' }, { label: 'BG2', value: '1 Stück' }],
      [{ label: 'X1', value: '2 Stück' }, { label: 'X2', value: '7 Stück' }, { label: 'X3', value: '2 Stück' }],
      [{ label: 'X1', value: '300 Stück' }, { label: 'X2', value: '1.050 Stück' }, { label: 'X3', value: '300 Stück' }],
    ],
    monthlyDemandSplit: [
      [{ label: 'Gleichung', value: '11x + 2x = J' }, { label: 'Bedarfseinheiten', value: '13' }],
      [{ label: 'Normaler Monatsbedarf', value: '200 Stück' }],
      [{ label: 'Sondermonat', value: '400 Stück' }, { label: 'Kontrollsumme Jahr', value: '2.600 Stück' }],
    ],
  }
  for (const [engine, steps] of Object.entries(expected)) {
    const method = bank.methods.find(item => item.engine === engine)
    for (let step = 1; step <= 3; step++) {
      const evaluation = evaluateMethodStep(engine, method.tasks[0], step, {})
      assert.deepEqual(formatMethodSolution(evaluation.correctValues, engine, step), steps[step - 1])
    }
  }
})
