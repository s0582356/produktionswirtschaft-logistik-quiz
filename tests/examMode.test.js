import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const storage = new Map()
global.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) } }
afterEach(() => storage.clear())

function library() {
  return {
    p01: {
      packageId: 'p01', packageNumber: 1, packageTitle: 'Testpaket',
      questions: [
        { questionId: 'p01-mc-001', questionType: 'mc', question: 'MC?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'MC-Erklärung' },
        { questionId: 'p01-yn-001', questionType: 'yesNo', statement: 'Ja/Nein?', correctAnswer: true, explanation: 'YN-Erklärung' },
        { questionId: 'p01-free-001', questionType: 'freeText', question: 'Freitext?', modelAnswer: 'Musterlösung', checkpoints: [{ anyOf: ['korrekt'] }], minWords: 1 },
      ],
    },
  }
}

async function mountExamState(packageBanksById = library()) {
  const { parse, compileScript } = await import('@vue/compiler-sfc')
  const { createRenderer } = await import('vue')
  const source = readFileSync(new URL('../src/components/ExamMode.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const compiled = compileScript(descriptor, { id: 'exam-mode-test' }).content
    .replace(/from 'vue'/g, `from '${import.meta.resolve('vue')}'`)
    .replace(/from '(\.\.\/utils\/[^']+)'/g, (_, path) => `from '${new URL('../src/components/' + path, import.meta.url).href}'`)
  const { default: component } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  component.render = () => null
  const renderer = createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {} })
  const app = renderer.createApp(component, { packageBanksById })
  const vm = app.mount({})
  return { state: vm.$.setupState, unmount: () => app.unmount() }
}

function prepare(state, index = 0) {
  state.setup = false
  state.session.orderedQuestionRefs = [
    { packageId: 'p01', questionId: 'p01-mc-001' },
    { packageId: 'p01', questionId: 'p01-yn-001' },
    { packageId: 'p01', questionId: 'p01-free-001' },
  ]
  state.session.currentQuestionIndex = index
}

test('exam saves editable neutral answers and grades only on submission', async () => {
  const { state, unmount } = await mountExamState()
  try {
    prepare(state)
    state.saveAnswer('B')
    state.saveAnswer('A')
    assert.equal(state.session.answers['p01::p01-mc-001'].selectedAnswer, 'A')
    assert.equal('correct' in state.session.answers['p01::p01-mc-001'], false)

    state.move(1)
    state.saveAnswer(false)
    state.saveAnswer(true)
    assert.equal(state.session.answers['p01::p01-yn-001'].selectedAnswer, true)
    assert.equal('correct' in state.session.answers['p01::p01-yn-001'], false)

    state.move(1)
    state.saveAnswer('korrekt, weil erklärt.')
    assert.equal(state.session.answers['p01::p01-free-001'].userAnswer, 'korrekt, weil erklärt.')
    assert.equal('status' in state.session.answers['p01::p01-free-001'], false)

    state.move(-2)
    assert.equal(state.currentAnswer.selectedAnswer, 'A')
    state.finish()
    assert.equal(state.session.sessionStatus, 'completed')
    assert.equal(state.session.answers['p01::p01-mc-001'].correct, true)
    assert.equal(state.session.answers['p01::p01-yn-001'].correct, true)
    assert.equal(state.session.answers['p01::p01-free-001'].status, 'green')
  } finally { unmount() }
})

test('exam progress counts neutral answers once, supports direct navigation and removes empty free text', async () => {
  const { state, unmount } = await mountExamState()
  try {
    prepare(state)
    assert.equal(state.answeredCount, 0)
    assert.equal(state.openCount, 3)

    state.saveAnswer('B')
    assert.equal(state.currentAnswer.selectedAnswer, 'B')
    assert.equal(state.answeredCount, 1)
    state.saveAnswer('A')
    assert.equal(state.currentAnswer.selectedAnswer, 'A')
    assert.equal(state.answeredCount, 1)

    state.jumpTo(1)
    assert.equal(state.session.currentQuestionIndex, 1)
    state.saveAnswer(false)
    assert.equal(state.answeredCount, 2)
    state.jumpTo(2)
    state.saveAnswer('kurze Antwort')
    assert.equal(state.answeredCount, 3)
    state.saveAnswer('   ')
    assert.equal(state.answeredCount, 2)
    assert.equal(state.openCount, 1)

    state.jumpTo(0)
    assert.equal(state.currentAnswer.selectedAnswer, 'A')
    assert.equal('correct' in state.currentAnswer, false)
  } finally { unmount() }
})

function largeLibrary(questionCount = 60) {
  return {
    p01: {
      packageId: 'p01', packageNumber: 1, packageTitle: 'Großes Testpaket',
      questions: Array.from({ length: questionCount }, (_, index) => ({
        questionId: 'p01-mc-' + String(index + 1).padStart(3, '0'),
        questionType: 'mc', question: 'MC ' + index, options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'Erklärung',
      })),
    },
  }
}

test('a new exam replaces a completed session with a fresh selected size', async () => {
  const { state, unmount } = await mountExamState(largeLibrary())
  try {
    state.start(20)
    state.saveAnswer('A')
    state.finish()
    assert.equal(state.session.sessionStatus, 'completed')
    assert.equal(Object.keys(state.session.answers).length, 1)

    state.reset()
    assert.equal(state.setup, true)
    assert.equal(state.session.sessionStatus, 'inProgress')
    assert.deepEqual(state.session.answers, {})

    for (const size of [20, 35, 50]) {
      state.start(size)
      assert.equal(state.setup, false)
      assert.equal(state.session.sessionStatus, 'inProgress')
      assert.equal(state.session.currentQuestionIndex, 0)
      assert.equal(state.session.examSize, size)
      assert.equal(state.session.orderedQuestionRefs.length, size)
      assert.deepEqual(state.session.answers, {})
      assert.ok(state.current)
      state.reset()
    }
  } finally { unmount() }
})

test('zero package banks cannot create an empty exam session', async () => {
  const { state, unmount } = await mountExamState({})
  try {
    state.start(20)
    assert.equal(state.setup, true)
    assert.equal(state.session.sessionStatus, 'inProgress')
    assert.equal(state.session.orderedQuestionRefs.length, 0)
    assert.deepEqual(state.session.answers, {})
  } finally { unmount() }
})

test('an unfinished exam remains resumable', async () => {
  const packageBanksById = largeLibrary()
  const first = await mountExamState(packageBanksById)
  try {
    first.state.start(20)
    const savedKey = first.state.currentKey
    first.state.saveAnswer('B')
    first.savedKey = savedKey
  } finally { first.unmount() }

  const resumed = await mountExamState(packageBanksById)
  try {
    assert.equal(resumed.state.resume, true)
    assert.equal(resumed.state.session.sessionStatus, 'inProgress')
    assert.equal(resumed.state.session.orderedQuestionRefs.length, 20)
    assert.equal(resumed.state.session.answers[first.savedKey].selectedAnswer, 'B')
  } finally { resumed.unmount() }
})

test('exam template keeps feedback hidden until submitted and exposes it afterwards', () => {
  const source = readFileSync(new URL('../src/components/ExamMode.vue', import.meta.url), 'utf8')
  const inProgress = source.slice(source.indexOf("session.sessionStatus === 'inProgress'"), source.indexOf("<section v-else-if=\"session.sessionStatus === 'completed'\""))
  assert.match(inProgress, /exam-answer-selected/)
  assert.match(inProgress, /exam-choice-indicator/)
  assert.match(inProgress, /exam-question-navigation/)
  assert.match(inProgress, /Weiter →/)
  assert.match(inProgress, /exam-sidebar/)
  assert.match(inProgress, /exam-question-overview/)
  assert.match(inProgress, /@click="submit"/)
  assert.doesNotMatch(inProgress, /Richtige Antwort|Erklärung:|Musterlösung|Bewertung:|answer-correct|answer-wrong/)
  const completed = source.slice(source.indexOf("<section v-else-if=\"session.sessionStatus === 'completed'\""))
  assert.match(completed, /Richtige Antwort/)
  assert.match(completed, /Erklärung:/)
  assert.match(completed, /Musterlösung/)
  assert.match(completed, /Bewertung:/)
})

test('exam UX styles keep the sidebar compact and mobile status responsive', () => {
  const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  assert.match(styles, /\.exam-quiz-layout \{\n  grid-template-columns: minmax\(0, 1fr\) minmax\(180px, 22%\)/)
  assert.match(styles, /\.exam-sidebar \{ position: sticky/)
  assert.match(styles, /@media \(max-width: 900px\) \{[\s\S]*?\.exam-sidebar \{ display: none; \}/)
  assert.match(styles, /\.exam-mobile-status \{ display: flex/)
  assert.match(styles, /:root\[data-theme="dark"\] \.exam-mode \.exam-answer-selected/)
})
