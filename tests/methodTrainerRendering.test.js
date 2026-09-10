import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

const bank = JSON.parse(readFileSync(new URL('../src/data/public/sampleMethodTrainerTasks.json', import.meta.url)))

test('Method selection renders all six methods with explanation and practice actions', async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { default: MethodTrainer } = await server.ssrLoadModule('/src/components/MethodTrainer.vue')
    const html = await renderToString(createSSRApp(MethodTrainer, { bank }))
    for (const method of bank.methods) assert(html.includes(method.methodTitle))
    assert.equal((html.match(/class="method-card"/g) || []).length, 6)
    assert.equal((html.match(/>Erklärung<\/button>/g) || []).length, 6)
    assert.equal((html.match(/>Üben<\/button>/g) || []).length, 6)
    assert(!html.includes('[object Object]'))
  } finally {
    await server.close()
  }
})

// Mount the real script-setup logic with Vue's in-memory renderer. No DOM or
// browser dependency is needed to exercise the actual check/reveal handlers.
async function mountTrainerState() {
  const { parse, compileScript } = await import('@vue/compiler-sfc')
  const { createRenderer } = await import('vue')
  const source = readFileSync(new URL('../src/components/MethodTrainer.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const compiled = compileScript(descriptor, { id: 'method-trainer-test' }).content
    .replace(/import MethodLearningNotes from '[^']+'/g, 'const MethodLearningNotes = {}')
    .replace(/from 'vue'/g, `from '${import.meta.resolve('vue')}'`)
    .replace(/from '(\.\.\/utils\/[^']+)'/g, (_, path) => `from '${new URL('../src/components/' + path, import.meta.url).href}'`)
  const { default: component } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  component.render = () => null
  const renderer = createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {} })
  const app = renderer.createApp(component, { bank })
  const vm = app.mount({})
  return { state: vm.$.setupState, unmount: () => app.unmount() }
}

test('XYZ only completes after both fully correct steps; checking or revealing cannot skip inputs', async () => {
  const { state, unmount } = await mountTrainerState()
  try {
    const method = bank.methods.find(method => method.engine === 'xyzAbcMatrix')
    state.selectMethod(method)
    state.checkStep()
    assert.equal(state.currentStep, 1)
    assert.equal(state.feedbackLabel(state.feedback[1]), 'Eingabe fehlt')
    for (let i = 0; i < 4; i++) state.revealCurrentStep()
    assert.equal(state.currentStep, 1)
    assert.equal(state.allStepsDone, false)
    assert.deepEqual({ ...state.sessionProgress }, {})
    assert.equal(state.feedbackLabel(state.feedback[1]), 'Musterlösung')
    Object.assign(state.answers, { 'xyz.R1': 'X', 'xyz.R2': 'Y' })
    state.checkStep()
    assert.equal(state.currentStep, 1)
    state.answers['xyz.R3'] = 'X'
    state.checkStep()
    assert.equal(state.feedback[1].status, 'yellow')
    assert.equal(state.currentStep, 1)
    state.answers['xyz.R3'] = 'Z'
    state.checkStep()
    assert.equal(state.currentStep, 2)
    state.checkStep()
    assert.equal(state.currentStep, 2)
    Object.assign(state.answers, { 'matrix.R1': 'AX', 'matrix.R2': 'BY', 'matrix.R3': 'CX' })
    state.checkStep()
    assert.equal(state.currentStep, 2)
    state.revealCurrentStep()
    assert.equal(state.allStepsDone, false)
    state.answers['matrix.R3'] = 'CZ'
    state.checkStep()
    assert.equal(state.allStepsDone, true)
    assert.equal(state.sessionProgress[method.methodId].yellow, 1)
    state.checkStep()
    assert.equal(state.sessionProgress[method.methodId].yellow, 1)
    state.retryTask()
    assert.equal(state.allStepsDone, false)
    assert.equal(state.currentStep, 1)
    assert.deepEqual({ ...state.answers }, {})
  } finally { unmount() }
})

test('Every method blocks empty submission and repeated solution reveals without recording completion', async () => {
  const { state, unmount } = await mountTrainerState()
  try {
    for (const method of bank.methods) {
      state.selectMethod(method)
      for (let i = 0; i <= method.steps.length; i++) {
        state.revealCurrentStep()
        state.checkStep()
      }
      assert.equal(state.currentStep, 1)
      assert.equal(state.allStepsDone, false)
      assert.equal(state.feedbackLabel(state.feedback[1]), 'Eingabe fehlt')
    }
    assert.deepEqual({ ...state.sessionProgress }, {})
  } finally { unmount() }
})


test('Task switching retains answers, checked steps and revealed help independently', async () => {
  const { state, unmount } = await mountTrainerState()
  try {
    for (const method of bank.methods) {
      assert.equal(method.tasks.length, 3)
      state.selectMethod(method)
      state.answers.example = 'Entwurf'
      state.revealCurrentStep()
      state.switchTask(1)
      assert.deepEqual({ ...state.answers }, {})
      assert.equal(state.currentStep, 1)
      assert.equal(state.revealedSteps.size, 0)
      state.answers.example = 'Zweiter Entwurf'
      state.switchTask(0)
      assert.equal(state.answers.example, 'Entwurf')
      assert(state.revealedSteps.has(1))
      state.showSelection()
      state.selectMethod(method)
      assert.equal(state.answers.example, 'Entwurf')
      state.switchTask(1)
      assert.equal(state.answers.example, 'Zweiter Entwurf')
      state.retryTask()
      assert.deepEqual({ ...state.answers }, {})
    }
  } finally { unmount() }
})

test('Structured learning notes render labeled examples and legacy mistakes', async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { default: Notes } = await server.ssrLoadModule('/src/components/MethodLearningNotes.vue')
    for (const method of bank.methods) {
      const html = await renderToString(createSSRApp(Notes, { method }))
      for (const label of ['Falsch', 'Warum falsch?', 'Richtig', 'Merksatz', 'Mini-Beispiel (fiktiv):', 'Was mache ich?', 'Warum?']) assert(html.includes(label))
      assert(!html.includes('[object Object]'))
      assert.equal(method.commonMistakeExamples.length, 2)
      assert.equal(method.microSteps.length, method.steps.length)
    }
    const html = await renderToString(createSSRApp(Notes, { method: { formula: [], steps: [], commonMistakes: ['Alter Hinweis'] } }))
    assert(html.includes('Alter Hinweis'))
  } finally { await server.close() }
})

test('Checked steps survive task changes and revisiting completion does not count twice', async () => {
  const { state, unmount } = await mountTrainerState()
  try {
    const method = bank.methods.find(m => m.engine === 'monthlyDemandSplit')
    state.selectMethod(method)
    state.answers.equation = '11x + 2x = J'
    state.checkStep()
    assert.equal(state.currentStep, 2)
    state.switchTask(1)
    state.checkStep()
    assert.equal(state.currentStep, 1)
    state.switchTask(0)
    assert.equal(state.currentStep, 2)
    assert.equal(state.feedback[1].status, 'green')
    assert.equal(state.answers.equation, '11x + 2x = J')
    state.answers.normal = 200
    state.checkStep()
    Object.assign(state.answers, { special: 400, sum: 2600 })
    state.checkStep()
    assert.equal(state.allStepsDone, true)
    state.switchTask(1)
    state.switchTask(0)
    state.checkStep()
    assert.equal(state.allStepsDone, true)
    assert.equal(state.sessionProgress[method.methodId].green, 1)
    state.retryTask()
    state.switchTask(1)
    state.switchTask(0)
    assert.equal(state.currentStep, 1)
    assert.deepEqual({ ...state.answers }, {})
  } finally { unmount() }
})

test('All three tasks keep separate drafts and revealing task three never skips a required step', async () => {
  const { state, unmount } = await mountTrainerState()
  try {
    for (const method of bank.methods) {
      state.selectMethod(method)
      for (let index = 0; index < 3; index++) {
        state.switchTask(index)
        state.answers.draft = `Entwurf ${index}`
        state.revealCurrentStep()
        state.checkStep()
        assert.equal(state.currentStep, 1)
        assert.equal(state.allStepsDone, false)
      }
      for (const index of [0, 2, 1, 2]) {
        state.switchTask(index)
        assert.equal(state.answers.draft, `Entwurf ${index}`)
        assert.equal(state.currentTaskIndex, index)
        assert(state.revealedSteps.has(1))
        assert.equal(state.currentStep, 1)
      }
      state.nextTask()
      assert.equal(state.currentTaskIndex, 0)
      assert.equal(state.answers.draft, 'Entwurf 0')
    }
    assert.deepEqual({ ...state.sessionProgress }, {})
  } finally { unmount() }
})
