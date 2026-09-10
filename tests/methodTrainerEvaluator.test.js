import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateMethodStep, getMethodReference } from '../src/utils/methodTrainerEvaluator.js'
import { formatMethodSolution } from '../src/utils/methodSolutionFormatter.js'

const bank = JSON.parse(readFileSync(new URL('../src/data/public/sampleMethodTrainerTasks.json', import.meta.url)))
const taskFor = engine => bank.methods.find(method => method.engine === engine).tasks[0]
const evaluate = (engine, step, answers) => evaluateMethodStep(engine, taskFor(engine), step, answers)

test('XYZ classifications and ABC/XYZ combinations, including wrong and normalized choices', () => {
  const engine = 'xyzAbcMatrix'
  assert.deepEqual(getMethodReference(engine, taskFor(engine)), { xyz: { R1: 'X', R2: 'Y', R3: 'Z' }, matrix: { R1: 'AX', R2: 'BY', R3: 'CZ' } })
  assert.equal(evaluate(engine, 1, { 'xyz.R1': ' x ', 'xyz.R2': 'saisonal', 'xyz.R3': 'U' }).status, 'green')
  assert.equal(evaluate(engine, 2, { 'matrix.R1': 'a/x', 'matrix.R2': 'BY', 'matrix.R3': ' cz ' }).status, 'green')
  assert.equal(evaluate(engine, 1, { 'xyz.R1': 'Z', 'xyz.R2': 'Z', 'xyz.R3': 'X' }).status, 'red')
  assert.equal(evaluate(engine, 2, { 'matrix.R1': 'XA', 'matrix.R2': 'YB', 'matrix.R3': 'ZC' }).status, 'red')
  for (const abc of 'ABC') for (const xyz of 'XYZ') {
    const task = { givenData: { articles: [{ id: 'item', abc, xyz }] } }
    assert.equal(evaluateMethodStep(engine, task, 2, { 'matrix.item': abc + xyz }).status, 'green')
  }
})

test('Sourcing material, risk and total for every strategy accept euro and decimal comma', () => {
  const engine = 'sourcingCostComparison'
  const expected = [
    ['single', 6400, 1620, 8140], ['dual', 6640, 630, 7550], ['multiple', 6880, 270, 7670],
  ]
  expected.forEach(([id, material, risk, cost], index) => {
    const answers = { [`material.${id}`]: material.toLocaleString('de-DE') + ',00 €', [`risk.${id}`]: 'EUR ' + risk + ',00', [`cost.${id}`]: cost + '.00' }
    const result = evaluate(engine, index + 1, answers)
    assert.equal(result.status, 'green')
    for (const [key, value] of Object.entries({ material, risk, cost })) assert(Math.abs(result.correctValues[key] - value) < 1e-8)
    assert(formatMethodSolution(result.correctValues, engine, index + 1).every(row => row.value.endsWith(' €')))
    assert.equal(evaluate(engine, index + 1, { ...answers, [`risk.${id}`]: 999, [`cost.${id}`]: 999 }).status, 'red')
  })
  assert.equal(evaluate(engine, 4, { cheapest: 'Dual Sourcing' }).status, 'green')
  assert.equal(evaluate(engine, 4, { cheapest: 'single' }).status, 'red')
  assert.equal(evaluate(engine, 5, { reason: 'resilience' }).status, 'green')
  assert.equal(evaluate(engine, 5, { reason: 'noRisk' }).status, 'red')
})

test('Sourcing currency tolerance remains absolute and tied cheapest strategies are accepted', () => {
  const engine = 'sourcingCostComparison'
  const task = structuredClone(taskFor(engine))
  task.givenData.strategies = task.givenData.strategies.map(s => ({ ...s, unitPrice: 3.25, quantity: 100, coordination: 40, riskPercent: 5 }))
  const reference = getMethodReference(engine, task)
  assert.equal(reference.strategies[0].cost, 815)
  for (const cheapest of ['single', 'dual', 'multiple']) assert.equal(evaluateMethodStep(engine, task, 4, { cheapest }).status, 'green')
  const answers = { 'material.single': '325,00 €', 'risk.single': 450, 'cost.single': '815,009 €' }
  assert.equal(evaluateMethodStep(engine, task, 1, answers).status, 'green')
  assert.equal(evaluateMethodStep(engine, task, 1, { ...answers, 'cost.single': '815,02 €' }).status, 'yellow')
})

test('Vertical integration exact and approximate percentage, optional percent sign and tolerance boundaries', () => {
  const engine = 'verticalIntegration'
  assert.deepEqual(getMethodReference(engine, taskFor(engine)), { exact: 65, approximate: 35 })
  for (const [exact, approximate] of [[65, 35], ['65 %', '35,0%'], ['65.1', '34,9 %'], ['64,9%', '35.1%']]) {
    assert.equal(evaluate(engine, 2, { 'depth.exact': exact, 'depth.approximate': approximate }).status, 'green')
  }
  for (const [exact, approximate] of [['65,11', '35,11'], ['0,65', '0,35'], ['', ''], ['NaN', 'Infinity']]) {
    assert.equal(evaluate(engine, 2, { 'depth.exact': exact, 'depth.approximate': approximate }).status, 'red')
  }
  assert.equal(evaluate(engine, 1, { 'formula.exact': 'exact', 'formula.approximate': 'approximate' }).status, 'green')
  assert.equal(evaluate(engine, 3, { interpretation: 'ownShare' }).status, 'green')
  assert.equal(evaluate(engine, 3, { interpretation: 'reversed' }).status, 'red')
  assert.deepEqual(formatMethodSolution(evaluate(engine, 2, {}).correctValues, engine, 2).map(row => row.value), ['65,00 %', '35,00 %'])
})

test('All new tasks expose complete inputs and readable solutions, empty input never passes', () => {
  for (const method of bank.methods.slice(3)) {
    assert.equal(method.tasks.length, 3)
    assert.equal(method.examples.length, 2)
    const task = method.tasks[0]
    assert.equal(task.inputSteps.length, method.steps.length)
    for (let step = 1; step <= method.steps.length; step++) {
      assert(task.inputSteps[step - 1].length)
      const result = evaluateMethodStep(method.engine, task, step, {})
      assert.equal(result.status, 'red')
      const rows = formatMethodSolution(result.correctValues, method.engine, step)
      assert(rows.length > 0)
      assert(rows.every(row => !row.value.includes('[object Object]')))
    }
  }
})

test('Existing 0.5.0 methods retain their reference calculations', () => {
  const bom = getMethodReference('billOfMaterials', taskFor('billOfMaterials'))
  assert.deepEqual(bom.perProduct, { X1: 2, X2: 7, X3: 2 })
  assert.equal(evaluate('billOfMaterials', 3, { 'yearly.X1': 300, 'yearly.X2': 1050, 'yearly.X3': 300 }).status, 'green')
  assert.equal(evaluate('monthlyDemandSplit', 1, { equation: '11x + 2x = J' }).status, 'green')
  assert.equal(evaluate('monthlyDemandSplit', 2, { normal: 200 }).status, 'green')
  assert.equal(evaluate('monthlyDemandSplit', 3, { special: 400, sum: 2600 }).status, 'green')
})

test('Missing required values block every method step, including otherwise correct partial answers', () => {
  for (const method of bank.methods) for (let step = 1; step <= method.steps.length; step++) {
    const task = method.tasks[0]
    const empty = evaluateMethodStep(method.engine, task, step, {})
    assert.equal(empty.status, 'red')
    assert(empty.missingFields.length > 0)
    assert.match(empty.reason, /Eingabe fehlt.*alle Felder/)
  }
  const cases = [
    ['xyzAbcMatrix', 1, { 'xyz.R1': 'X', 'xyz.R2': 'Y', 'xyz.R3': ' ' }, 'xyz.R3'],
    ['xyzAbcMatrix', 2, { 'matrix.R1': 'AX', 'matrix.R2': 'BY' }, 'matrix.R3'],
    ['abcAnalysis', 3, { 'class.P1': 'A', 'class.P2': 'A', 'class.P3': 'B', 'class.P4': 'C' }, 'class.P5'],
    ['billOfMaterials', 2, { 'part.X1': 2, 'part.X2': 7 }, 'part.X3'],
    ['monthlyDemandSplit', 3, { special: 400 }, 'sum'],
    ['sourcingCostComparison', 1, { 'material.single': 6400, 'risk.single': 1620 }, 'cost.single'],
    ['verticalIntegration', 1, { 'formula.exact': 'exact' }, 'formula.approximate'],
    ['verticalIntegration', 2, { 'depth.exact': 65 }, 'depth.approximate'],
  ]
  for (const [engine, step, answers, missing] of cases) {
    const result = evaluate(engine, step, answers)
    assert.equal(result.status, 'red')
    assert.deepEqual(result.missingFields, [missing])
  }
})
