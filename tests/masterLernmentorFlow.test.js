import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer } from 'vue'
import { validateMasterLernmentorLibrary } from '../src/utils/masterLernmentorLibrary.js'
import { createMasterLernmentorProgressKey } from '../src/utils/masterLernmentorProgressStore.js'

const storage = new Map()
global.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
}
afterEach(() => storage.clear())

// Generic headless SFC mounting: compiles only the <script setup> block (no
// template render), recursively resolving relative imports - including child
// .vue components, needed here because MasterLernmentor.vue imports
// MasterLernmentorTopicView.vue - into loadable data: URLs. Behavior is then
// driven directly through the exposed setup bindings (vm.$.setupState),
// exactly like the existing ExamMode headless-mount tests do.
const moduleUrlCache = new Map()

async function compileVueModule(fileUrl) {
  if (moduleUrlCache.has(fileUrl.href)) return moduleUrlCache.get(fileUrl.href)
  const source = readFileSync(fileUrl, 'utf8')
  const { descriptor } = parse(source, { filename: fileUrl.pathname })
  let content = compileScript(descriptor, { id: fileUrl.pathname }).content
  content = content.replace(/from 'vue'/g, `from '${import.meta.resolve('vue')}'`)

  const specifiers = [...content.matchAll(/from '(\.\.?\/[^']+)'/g)].map((match) => match[1])
  for (const spec of specifiers) {
    const targetUrl = new URL(spec, fileUrl)
    const replacement = spec.endsWith('.vue') ? await compileVueModule(targetUrl) : targetUrl.href
    content = content.split(`from '${spec}'`).join(`from '${replacement}'`)
  }

  const dataUrl = `data:text/javascript;base64,${Buffer.from(content).toString('base64')}`
  moduleUrlCache.set(fileUrl.href, dataUrl)
  return dataUrl
}

async function mountHeadless(relativePath, props) {
  const fileUrl = new URL(relativePath, import.meta.url)
  const dataUrl = await compileVueModule(fileUrl)
  const { default: component } = await import(dataUrl)
  component.render = () => null
  const renderer = createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {} })
  const app = renderer.createApp(component, props)
  const vm = app.mount({})
  return { state: vm.$.setupState, unmount: () => app.unmount() }
}

function question(id, overrides = {}) {
  return {
    questionId: id,
    question: `Frage ${id}?`,
    hint: 'Ein Hinweis.',
    sourceStatus: 'SOURCE_OK',
    questionType: 'knowledge',
    coreConcepts: [{ conceptId: `${id}-c01`, label: 'Kernpunkt', acceptedPhrases: ['kernpunkt erkannt'] }],
    optionalConcepts: [{ conceptId: `${id}-o01`, label: 'Zusatz', acceptedPhrases: ['zusatzinfo'] }],
    minimumSufficientAnswer: 'Minimalantwort.',
    shortModelAnswer: 'Kurze Musterantwort.',
    masterExcerpt: 'GEHEIMER_MASTER_AUSZUG_TEXT',
    ...overrides,
  }
}

function topic(id, questions, overrides = {}) {
  return {
    topicId: id,
    topicNumber: '1.1',
    topicTitle: `Topic ${id}`,
    learningPhase: { masterContent: `Masterinhalt ${id}` },
    questions,
    ...overrides,
  }
}

function chapterEntry(id, topics) {
  return { chapter: { chapterId: id, chapterNumber: '1', chapterTitle: `Kapitel ${id}` }, topics }
}

function library() {
  return validateMasterLernmentorLibrary({
    libraryId: 'pwl-master-lernmentor',
    chapters: [
      chapterEntry('c01', [
        topic('t01', [question('q01'), question('q02', { sourceStatus: 'SOURCE_GAP_CONFIRMED' })]),
        topic('t02', [question('q03', { calculationRequirements: { formula: 'A = B / C', workedExample: '4 / 2 = 2' } })]),
      ]),
      chapterEntry('c02', [topic('t03', [question('q04')])]),
    ],
  })
}

// --- MasterLernmentorTopicView.vue: question-flow behavior ---

test('Lernphase zeigt masterContent, "Jetzt abfragen" wechselt in den Fragenfluss', async () => {
  const lib = library()
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentorTopicView.vue', {
    topic: lib.chapters[0].topics[0], chapterTitle: 'Kapitel c01', ratings: {}, resumeQuestionIndex: 0, initialPhase: 'learning', hasNextTopic: true,
  })
  try {
    assert.equal(state.phase, 'learning')
    state.startQuestions()
    assert.equal(state.phase, 'questions')
    assert.equal(state.currentIndex, 0)
  } finally { unmount() }
})

test('Freitext-Antwort bleibt nur im Component-State, wird bei Fragenwechsel geleert', async () => {
  const lib = library()
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentorTopicView.vue', {
    topic: lib.chapters[0].topics[0], chapterTitle: 'Kapitel c01', ratings: {}, resumeQuestionIndex: 0, initialPhase: 'questions', hasNextTopic: false,
  })
  try {
    state.freeAnswer = 'Meine private Antwort mit Details.'
    assert.equal(state.freeAnswer, 'Meine private Antwort mit Details.')
    state.revealSolution()
    assert.equal(state.revealed, true)
    assert.ok(state.evaluation)
    state.rate('safe')
    state.goToNextQuestion()
    assert.equal(state.currentIndex, 1)
    assert.equal(state.freeAnswer, '')
    assert.equal(state.revealed, false)
    assert.equal(state.evaluation, null)
  } finally { unmount() }
})

test('Lösung vergleichen deckt minimumSufficientAnswer/shortModelAnswer/coreConcepts/optionalConcepts/masterExcerpt und lokale Heuristik auf', async () => {
  const lib = library()
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentorTopicView.vue', {
    topic: lib.chapters[0].topics[0], chapterTitle: 'Kapitel c01', ratings: {}, resumeQuestionIndex: 0, initialPhase: 'questions', hasNextTopic: false,
  })
  try {
    assert.equal(state.revealed, false)
    state.freeAnswer = 'Kernpunkt erkannt, dazu noch Zusatzinfo.'
    state.revealSolution()
    assert.equal(state.revealed, true)
    assert.equal(state.currentQuestion.minimumSufficientAnswer, 'Minimalantwort.')
    assert.equal(state.currentQuestion.shortModelAnswer, 'Kurze Musterantwort.')
    assert.equal(state.currentQuestion.masterExcerpt, 'GEHEIMER_MASTER_AUSZUG_TEXT')
    assert.equal(state.evaluation.matchedCoreConceptCount, 1)
    assert.deepEqual(state.evaluation.matchedOptionalConceptIds, ['q01-o01'])
  } finally { unmount() }
})

test('Selbsteinschätzung: rate() emittiert Rating, "Nächste Frage" erscheint erst danach', async () => {
  const lib = library()
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentorTopicView.vue', {
    topic: lib.chapters[0].topics[0], chapterTitle: 'Kapitel c01', ratings: {}, resumeQuestionIndex: 0, initialPhase: 'questions', hasNextTopic: false,
  })
  try {
    state.freeAnswer = 'Kernpunkt erkannt.'
    state.revealSolution()
    assert.equal(state.lastRatedQuestionId, null)
    state.rate('learn')
    assert.equal(state.lastRatedQuestionId, 'q01')
  } finally { unmount() }
})

test('SOURCE_GAP_CONFIRMED-Frage wird als solche erkannt (Info-Box-Bedingung)', async () => {
  const lib = library()
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentorTopicView.vue', {
    topic: lib.chapters[0].topics[0], chapterTitle: 'Kapitel c01', ratings: {}, resumeQuestionIndex: 1, initialPhase: 'questions', hasNextTopic: false,
  })
  try {
    assert.equal(state.currentQuestion.questionId, 'q02')
    assert.equal(state.isSourceGap, true)
  } finally { unmount() }
})

test('calculationRequirements wird nur gerendert, wenn tatsächlich vorhanden', async () => {
  const lib = library()
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentorTopicView.vue', {
    topic: lib.chapters[0].topics[1], chapterTitle: 'Kapitel c01', ratings: {}, resumeQuestionIndex: 0, initialPhase: 'questions', hasNextTopic: false,
  })
  try {
    assert.deepEqual(state.currentQuestion.calculationRequirements, { formula: 'A = B / C', workedExample: '4 / 2 = 2' })
  } finally { unmount() }
})

test('letzte Frage eines Themas führt nach "Nächste Frage" in die Abschluss-Phase', async () => {
  const lib = library()
  const single = lib.chapters[1].topics[0]
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentorTopicView.vue', {
    topic: single, chapterTitle: 'Kapitel c02', ratings: {}, resumeQuestionIndex: 0, initialPhase: 'questions', hasNextTopic: false,
  })
  try {
    assert.equal(state.isLastQuestion, true)
    state.freeAnswer = 'irgendeine Antwort'
    state.revealSolution()
    state.rate('safe')
    state.goToNextQuestion()
    assert.equal(state.phase, 'complete')
  } finally { unmount() }
})

// --- MasterLernmentor.vue: import, chapter/topic navigation, resume, persistence ---

test('ohne geladene Library ist "library" leer (Import-Ansicht erwartet)', async () => {
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentor.vue', { library: null, fileName: null })
  try {
    assert.equal(state.currentChapterId, null)
    assert.equal(state.currentChapter, null)
    assert.equal(state.progress, null)
  } finally { unmount() }
})

function fakeFile(content, name = 'bank.json') {
  return { name, text: async () => content }
}

test('H. UI-Import: fremde libraryId mit valider Struktur wird abgelehnt und zeigt eine saubere Fehlermeldung, keine Library übernommen', async () => {
  const foreign = {
    libraryId: 'other-private-bank',
    chapters: [chapterEntry('c01', [topic('t01', [question('q01')])])],
  }
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentor.vue', { library: null, fileName: null })
  try {
    await state.handleFileChange({ target: { files: [fakeFile(JSON.stringify(foreign), 'fremde-bank.json')], value: 'fremde-bank.json' } })
    assert.match(state.importError, /keine gültige Master-Lernmentor-Datei/)
    assert.doesNotMatch(state.importError, /at Object|node_modules|\.js:\d+:\d+|TypeError/)
  } finally { unmount() }
})

test('Kapitelnavigation: openChapter setzt Kapitel, openTopic setzt Thema, currentTopic wird korrekt aufgelöst', async () => {
  const lib = library()
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentor.vue', { library: lib, fileName: 'bank.json' })
  try {
    assert.equal(state.currentChapter, null)
    state.openChapter('c01')
    assert.equal(state.currentChapter.chapterId, 'c01')
    assert.equal(state.currentTopic, null)
    state.openTopic('t02')
    assert.equal(state.currentTopic.topicId, 't02')
  } finally { unmount() }
})

test('handleRate/handlePosition persistieren nur technische Felder unter dem Fingerprint-Key dieser Library', async () => {
  const lib = library()
  const { state, unmount } = await mountHeadless('../src/components/MasterLernmentor.vue', { library: lib, fileName: 'bank.json' })
  try {
    state.openChapter('c01')
    state.openTopic('t01')
    state.handlePosition(1)
    state.handleRate('q01', 'partial')
    assert.equal(state.progress.currentQuestionIndex, 1)
    assert.deepEqual(state.progress.ratings, { q01: 'partial' })

    const raw = storage.get(createMasterLernmentorProgressKey(lib.libraryId, lib.fingerprint))
    assert.ok(raw)
    assert.equal(raw.includes('GEHEIMER_MASTER_AUSZUG_TEXT'), false)
    assert.equal(raw.includes('Masterinhalt'), false)
  } finally { unmount() }
})

test('Fortsetzen (resumeSavedSession) springt zu Kapitel/Thema/Frage aus dem Fortschritt', async () => {
  const lib = library()
  const first = await mountHeadless('../src/components/MasterLernmentor.vue', { library: lib, fileName: 'bank.json' })
  try {
    first.state.openChapter('c01')
    first.state.openTopic('t02')
    first.state.handlePosition(0)
    first.state.handleRate('q03', 'safe')
  } finally { first.unmount() }

  const resumed = await mountHeadless('../src/components/MasterLernmentor.vue', { library: lib, fileName: 'bank.json' })
  try {
    assert.equal(resumed.state.hasSavedProgress, true)
    resumed.state.resumeSavedSession()
    assert.equal(resumed.state.currentChapterId, 'c01')
    assert.equal(resumed.state.currentTopicId, 't02')
    assert.equal(resumed.state.topicEntryPhase, 'questions')
  } finally { resumed.unmount() }
})

test('andere Library (anderer Fingerprint) bietet keinen falschen Fortsetzen-Zustand', async () => {
  const libA = library()
  const first = await mountHeadless('../src/components/MasterLernmentor.vue', { library: libA, fileName: 'bank.json' })
  try {
    first.state.openChapter('c01')
    first.state.openTopic('t01')
    first.state.handleRate('q01', 'learn')
  } finally { first.unmount() }

  const libB = validateMasterLernmentorLibrary({
    libraryId: 'pwl-master-lernmentor',
    chapters: [chapterEntry('c99', [topic('t99', [question('q99')])])],
  })
  const other = await mountHeadless('../src/components/MasterLernmentor.vue', { library: libB, fileName: 'other.json' })
  try {
    assert.equal(other.state.hasSavedProgress, false)
  } finally { other.unmount() }
})

// --- Structural template guarantees (kein Hard-Scoring, Reveal-Reihenfolge) ---

test('Template enthüllt masterExcerpt/Kernbegriffe erst innerhalb des revealed-Blocks', () => {
  const source = readFileSync(new URL('../src/components/MasterLernmentorTopicView.vue', import.meta.url), 'utf8')
  const beforeReveal = source.slice(source.indexOf('phase === \'questions\''), source.indexOf('v-if="revealed"'))
  assert.doesNotMatch(beforeReveal, /masterExcerpt|minimumSufficientAnswer|shortModelAnswer|coreConcepts/)
  const revealedBlock = source.slice(source.indexOf('v-if="revealed"'))
  assert.match(revealedBlock, /masterExcerpt/)
  assert.match(revealedBlock, /minimumSufficientAnswer/)
  assert.match(revealedBlock, /shortModelAnswer/)
})

test('Kein Hard-Scoring: Template enthält keine Richtig/Falsch/Punktzahl/Noten-Formulierungen', () => {
  const source = readFileSync(new URL('../src/components/MasterLernmentorTopicView.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /Richtig\b|Falsch\b|bestanden|Punktzahl|Schulnote|Prüfungsergebnis/)
})

test('Mobile CSS-Regeln für Master-Lernmentor existieren (schmale Breiten, keine horizontale Überbreite)', () => {
  const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  assert.match(styles, /@media \(max-width: 480px\) \{[\s\S]*?\.ml-self-rating \{ flex-direction: column; \}/)
  assert.match(styles, /\.ml-card-grid \{ grid-template-columns: 1fr; \}/)
})

// Phase 5D: at true 320px width, an unbroken long master-content/formula token
// (e.g. no-space text, a long calculation formula) previously overflowed the
// viewport - .master-lernmentor now sets overflow-wrap so every descendant
// text block (master content, question text, excerpt, calculation panel,
// card titles) wraps instead of forcing horizontal scroll. h1 needed the same
// treatment for the pre-existing hero title at exactly 320px.
test('Phase 5D: overflow-wrap-Absicherung gegen horizontalen Overflow bei 320px (h1 und Master-Lernmentor-Bereich)', () => {
  const styles = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  assert.match(styles, /^h1 \{[\s\S]*?overflow-wrap: break-word;[\s\S]*?\}/m)
  assert.match(styles, /\.master-lernmentor \{[^}]*overflow-wrap: anywhere;[^}]*\}/)
})
