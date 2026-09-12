import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { solutionDerivation } from '../src/utils/methodSolutionDerivation.js'
import { evaluateMethodStep, getMethodReference } from '../src/utils/methodTrainerEvaluator.js'
const bank = JSON.parse(readFileSync(new URL('../src/data/public/sampleMethodTrainerTasks.json', import.meta.url)))

test('All twenty-seven tasks have readable derivations, block empty fields and accept complete correct inputs', () => {
  for (const m of bank.methods) for (const t of m.tasks) {
    const r = getMethodReference(m.engine, t), answers = {}
    const add = (prefix, values) => Object.entries(values).forEach(([key, value]) => { answers[`${prefix}.${key}`] = value })
    if (m.engine === 'abcAnalysis') {
      add('value', r.values); answers.total = r.total; add('rank', r.order); add('share', r.shares); add('cumulative', r.cumulative); add('class', r.classes)
    } else if (m.engine === 'billOfMaterials') {
      add('assembly', r.assemblyQuantities); add('part', r.perProduct); add('yearly', r.yearly)
    } else if (m.engine === 'monthlyDemandSplit') Object.assign(answers, { equation: '11x + 2x = J', normal: r.normal, special: r.adjusted, sum: r.yearlyDemand })
    else if (m.engine === 'xyzAbcMatrix') { add('xyz', r.xyz); add('matrix', r.matrix) }
    else if (m.engine === 'sourcingCostComparison') {
      for (const s of r.strategies) for (const key of ['material', 'risk', 'cost']) answers[`${key}.${s.id}`] = s[key]
      answers.cheapest = r.cheapest[0]; answers.reason = 'resilience'
    } else if (t.solutionDerivation) { for (const [key, value] of Object.entries(r)) answers[key] = Array.isArray(value) ? value[0] : value }
    else { add('formula', { exact: 'exact', approximate: 'approximate' }); add('depth', r); answers.interpretation = 'ownShare' }
    for (let step = 1; step <= m.steps.length; step++) {
      const rows = solutionDerivation(m, t, step)
      assert(rows.length > 4)
      assert(rows.every(row => typeof row.value === 'string' && !row.value.includes('[object Object]')))
      assert.equal(evaluateMethodStep(m.engine, t, step, {}).status, 'red')
      assert.equal(evaluateMethodStep(m.engine, t, step, answers).status, 'green', `${t.taskId} step ${step}`)
    }
    for (const fields of t.inputSteps || []) for (const field of fields) if (field.options) assert(field.options.some(o => o.value === answers[field.key]))
  }
})

test('Second tasks change outcomes and independently known calculations match', () => {
  for (const m of bank.methods) assert.notDeepEqual(getMethodReference(m.engine, m.tasks[0]), getMethodReference(m.engine, m.tasks[1]))
  const task = engine => bank.methods.find(m => m.engine === engine).tasks[1]
  assert.equal(getMethodReference('abcAnalysis', task('abcAnalysis')).total, 11200)
  assert.deepEqual(getMethodReference('billOfMaterials', task('billOfMaterials')).yearly, { X1: 240, X2: 1200, X3: 160 })
  assert.equal(getMethodReference('monthlyDemandSplit', task('monthlyDemandSplit')).adjusted, 605)
  assert.deepEqual(getMethodReference('sourcingCostComparison', task('sourcingCostComparison')).cheapest, ['dual'])
  assert.deepEqual(getMethodReference('verticalIntegration', task('verticalIntegration')), { exact: 30, approximate: 75 })
})

test('Learning UI retains responsive and dark theme styles and no persistence', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  assert(css.includes(':root[data-theme="dark"] .learning-card'))
  assert(css.includes('.task-selector > button { width: 100%; }'))
  const component = readFileSync(new URL('../src/components/MethodTrainer.vue', import.meta.url), 'utf8')
  assert(!component.includes('localStorage'))
  assert(component.includes(':value="option.value"'))
})

test('Exactly twenty-seven distinct tasks train three different situations per method', () => {
  assert.equal(bank.methods.length, 9)
  assert.equal(bank.methods.flatMap(m => m.tasks).length, 27)
  const ids = new Set()
  for (const method of bank.methods) {
    assert.equal(method.tasks.length, 3)
    assert.equal(new Set(method.tasks.map(t => t.learningFocus)).size, 3)
    for (const task of method.tasks) { assert(!ids.has(task.taskId)); ids.add(task.taskId) }
    assert(method.tasks[2].solutionContext)
    assert(method.tasks[2].taskPitfall)
    assert(method.commonMistakeExamples.length >= 2)
    for (const mistake of method.commonMistakeExamples) for (const key of ['wrong', 'whyWrong', 'correct', 'memoryHint']) assert(mistake[key])
  }
})

test('Every micro step provides solution-independent, guided thinking support', () => {
  for (const method of bank.methods) {
    assert.equal(method.microSteps.length, method.steps.length)
    for (const step of method.microSteps) {
      assert(Array.isArray(step.guidanceSteps))
      assert(step.guidanceSteps.length >= 3)
      assert(step.guidanceSteps.every(item => typeof item === 'string' && item.length > 25 && !item.includes('[object Object]')))
      assert.equal(typeof step.controlQuestion, 'string')
      assert(step.controlQuestion.endsWith('?'))
      assert(![...step.guidanceSteps, step.controlQuestion].join(' ').match(/\d/))
    }
  }
})

test('ABC variation changes actual classes and explicitly explains task limits and quantity trap', () => {
  const m = bank.methods.find(m => m.engine === 'abcAnalysis')
  assert.deepEqual(m.tasks[0].params.classLimits, { A: 80, B: 95 })
  assert.deepEqual(m.tasks[1].params.classLimits, { A: 70, B: 90 })
  assert.equal(getMethodReference(m.engine, m.tasks[1]).classes.P3, 'B')
  const standard = structuredClone(m.tasks[1]); standard.params.classLimits = { A: 80, B: 95 }
  assert.equal(getMethodReference(m.engine, standard).classes.P3, 'A')
  const text = solutionDerivation(m, m.tasks[1], 3).map(r => r.value).join(' ')
  assert(text.includes('nicht die Standardgrenzen'))
  assert(text.includes('vorgegebenen Grenzen'))
  const r = getMethodReference(m.engine, m.tasks[2])
  assert.deepEqual(r.order, ['P1', 'P2', 'P4', 'P3', 'P5'])
  assert.equal(r.classes.P3, 'B')
  assert.equal(r.total, 7020)
  assert(solutionDerivation(m, m.tasks[2], 3).some(r => r.value.includes('Hohe Stückzahl bedeutet nicht automatisch A-Artikel')))
})

test('Third tasks exercise additional levels, upward rounding, matrix effects and outsourcing', () => {
  const third = engine => bank.methods.find(m => m.engine === engine).tasks[2]
  const bom = getMethodReference('billOfMaterials', third('billOfMaterials'))
  assert.deepEqual(bom.assemblyQuantities, { BG1: 2, BG2: 1, BG3: 6 })
  assert.deepEqual(bom.yearly, { X1: 720, X2: 600, X3: 180 })
  const monthly = getMethodReference('monthlyDemandSplit', third('monthlyDemandSplit'))
  assert.equal(monthly.normal, 201)
  assert.equal(monthly.adjusted, 399)
  assert.equal(11 * monthly.normal + monthly.adjusted, 2610)
  assert.deepEqual(getMethodReference('xyzAbcMatrix', third('xyzAbcMatrix')).matrix, { R1: 'AZ', R2: 'CX', R3: 'AY' })
  assert.deepEqual(getMethodReference('sourcingCostComparison', third('sourcingCostComparison')).cheapest, ['single'])
  const sourcing = bank.methods.find(m => m.engine === 'sourcingCostComparison')
  assert.deepEqual(getMethodReference(sourcing.engine, sourcing.tasks[0]).cheapest, ['dual'])
  const depth = bank.methods.find(m => m.engine === 'verticalIntegration')
  const rows = solutionDerivation(depth, depth.tasks[2], 3)
  assert(rows.some(r => r.value.includes('nachher 40 %: 20 Prozentpunkte')))
  assert.equal(evaluateMethodStep(depth.engine, depth.tasks[2], 3, { interpretation: 'reversed' }).status, 'red')
})
