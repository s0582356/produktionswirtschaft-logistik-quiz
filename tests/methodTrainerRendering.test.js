import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

const bank = JSON.parse(readFileSync(new URL('../src/data/public/sampleMethodTrainerTasks.json', import.meta.url)))

test('Method selection renders all six methods with explanation and practice actions', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
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
