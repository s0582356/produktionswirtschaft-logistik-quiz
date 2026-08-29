<script setup>
import { computed, ref } from 'vue'
import QuizCard from './components/QuizCard.vue'
import ScoreBox from './components/ScoreBox.vue'
import PrivateQuestionImporter from './components/PrivateQuestionImporter.vue'
import FreeTextCard from './components/FreeTextCard.vue'
import sampleQuestions from './data/public/sampleQuestions.json'
import sampleFreeTextQuestions from './data/public/sampleFreeTextQuestions.json'
import {
  calculateProgressTotals,
  createBankFingerprint,
  createEmptyProgress,
  getBetterStatus,
  getQuestionId,
  loadProgress,
  removeProgress,
  saveProgress,
} from './utils/progressStore.js'

const activeMode = ref('mc')
const questions = ref(sampleQuestions)
const mcQuestionBankName = ref('Öffentliche MC-Beispiel-Fragen')
const freeTextQuestions = ref(sampleFreeTextQuestions)
const freeTextQuestionBankName = ref('Öffentliche Freitext-Demo')
const isQuizStarted = ref(false)
const isQuizComplete = ref(false)
const isReviewMode = ref(false)
const originalQuestions = ref(sampleQuestions)
const currentQuestionIndex = ref(0)
const selectedAnswer = ref(null)
const isAnswered = ref(false)
const score = ref(0)
const currentStreak = ref(0)
const bestStreak = ref(0)
const incorrectlyAnsweredQuestions = ref([])
const answeredQuestions = ref([])
const freeTextQuestionIndex = ref(0)
const freeTextFilter = ref('all')
const freeTextSessionQuestionIds = ref(null)
const freeTextBankId = ref(createBankFingerprint('freeText', sampleFreeTextQuestions))
const freeTextProgress = ref(
  loadProgress(freeTextBankId.value, 'freeText', sampleFreeTextQuestions.length),
)

const THEME_STORAGE_KEY = 'pwl-quiz-theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const theme = ref(getInitialTheme())

function applyTheme(nextTheme) {
  theme.value = nextTheme
  document.documentElement.dataset.theme = nextTheme
  document.documentElement.style.colorScheme = nextTheme
}

function toggleTheme() {
  const nextTheme = theme.value === 'dark' ? 'light' : 'dark'
  applyTheme(nextTheme)
  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
}

applyTheme(theme.value)

const questionBankName = computed(() => (
  activeMode.value === 'mc' ? mcQuestionBankName.value : freeTextQuestionBankName.value
))
const isFreeTextMode = computed(() => activeMode.value === 'freeText')
const filteredFreeTextQuestions = computed(() => {
  if (!freeTextSessionQuestionIds.value) return freeTextQuestions.value

  const includedIds = new Set(freeTextSessionQuestionIds.value)
  return freeTextQuestions.value.filter((question, index) => {
    return includedIds.has(getQuestionId(question, index))
  })
})
const currentFreeTextQuestion = computed(
  () => filteredFreeTextQuestions.value[freeTextQuestionIndex.value],
)
const isLastFreeTextQuestion = computed(
  () => freeTextQuestionIndex.value === filteredFreeTextQuestions.value.length - 1,
)
const freeTextStats = computed(
  () => calculateProgressTotals(freeTextProgress.value, freeTextQuestions.value.length),
)
const hasSavedFreeTextProgress = computed(() => freeTextStats.value.answered > 0)
const freeTextProgressPercent = computed(() => {
  if (!freeTextStats.value.questions) return 0
  return Math.round((freeTextStats.value.answered / freeTextStats.value.questions) * 100)
})
const freeTextFilterLabel = computed(() => ({
  all: 'Alle Fragen',
  new: 'Neue Fragen',
  review: 'Gelb/Rot wiederholen',
}[freeTextFilter.value]))
const freeTextCategoryStats = computed(() => {
  const categories = new Map()

  freeTextQuestions.value.forEach((question, index) => {
    const category = question.category || 'Ohne Kategorie'
    if (!categories.has(category)) {
      categories.set(category, { name: category, answered: 0, green: 0, yellow: 0, red: 0 })
    }

    const record = freeTextProgress.value.questions[getQuestionId(question, index)]
    if (!record) return

    const item = categories.get(category)
    item.answered++
    if (record.lastStatus in item) item[record.lastStatus]++
  })

  return [...categories.values()].filter((category) => category.answered > 0)
})

const totalQuestions = computed(() => questions.value.length)
const wrongAnswerCount = computed(() => totalQuestions.value - score.value)
const scorePercentage = computed(() => {
  if (totalQuestions.value === 0) {
    return 0
  }

  return Math.round((score.value / totalQuestions.value) * 100)
})

const currentQuestion = computed(() => {
  return questions.value[currentQuestionIndex.value]
})

const isLastQuestion = computed(() => {
  return currentQuestionIndex.value === totalQuestions.value - 1
})

const resultMessage = computed(() => {
  if (scorePercentage.value >= 90) {
    return 'Prozesse, Material und Logistik sitzen'
  }

  if (scorePercentage.value >= 75) {
    return 'Starke Grundlage - Details vertiefen'
  }

  if (scorePercentage.value >= 60) {
    return 'Solide Basis - typische Verwechslungen wiederholen'
  }

  return 'Noch unsicher - Grundlagen gezielt wiederholen'
})

const categoryResults = computed(() => {
  const categories = new Map()

  answeredQuestions.value.forEach((answer) => {
    const categoryName = answer.category || 'Allgemein'

    if (!categories.has(categoryName)) {
      categories.set(categoryName, {
        name: categoryName,
        correct: 0,
        total: 0,
      })
    }

    const category = categories.get(categoryName)
    category.total++

    if (answer.isCorrect) {
      category.correct++
    }
  })

  return [...categories.values()]
    .map((category) => {
      const percentage = Math.round((category.correct / category.total) * 100)
      let label = 'Wiederholen'
      let statusClass = 'category-review'

      if (percentage >= 80) {
        label = 'Stark'
        statusClass = 'category-strong'
      } else if (percentage >= 60) {
        label = 'Solide'
        statusClass = 'category-solid'
      }

      return {
        ...category,
        percentage,
        label,
        statusClass,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

const weakCategories = computed(() => {
  return categoryResults.value
    .filter((category) => category.percentage < 60)
    .map((category) => category.name)
})

const learningRecommendation = computed(() => {
  if (weakCategories.value.length > 0) {
    return `Wiederhole besonders: ${weakCategories.value.join(', ')}`
  }

  return 'Keine klare Schwachstelle in diesem Durchlauf.'
})

function getQuestionKey(question) {
  return [
    question.id,
    question.category,
    question.difficulty,
    question.question,
  ]
    .filter(Boolean)
    .join('::')
}

function shuffleOptions(options = []) {
  const shuffledOptions = [...options]

  for (let index = shuffledOptions.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const currentOption = shuffledOptions[index]
    shuffledOptions[index] = shuffledOptions[randomIndex]
    shuffledOptions[randomIndex] = currentOption
  }

  return shuffledOptions
}

function shuffleOptionsForQuestions(questionList) {
  return questionList.map((question) => ({
    ...question,
    options: shuffleOptions(question.options),
  }))
}

function resetQuizProgress({ clearIncorrectAnswers = true } = {}) {
  currentQuestionIndex.value = 0
  selectedAnswer.value = null
  isAnswered.value = false
  score.value = 0
  currentStreak.value = 0
  bestStreak.value = 0
  answeredQuestions.value = []
  isQuizComplete.value = false

  if (clearIncorrectAnswers) {
    incorrectlyAnsweredQuestions.value = []
  }
}

function startQuiz() {
  if (isFreeTextMode.value) {
    startFreeTextTraining('all')
    return
  }

  questions.value = shuffleOptionsForQuestions(originalQuestions.value)
  isReviewMode.value = false
  resetQuizProgress()
  isQuizStarted.value = true
}

function selectAnswer(option) {
  if (isAnswered.value) {
    return
  }

  selectedAnswer.value = option
  isAnswered.value = true

  const isCorrect = option === currentQuestion.value.correctAnswer

  answeredQuestions.value.push({
    key: getQuestionKey(currentQuestion.value),
    category: currentQuestion.value.category || 'Allgemein',
    isCorrect,
  })

  if (isCorrect) {
    score.value++
    currentStreak.value++
    bestStreak.value = Math.max(bestStreak.value, currentStreak.value)
    return
  }

  currentStreak.value = 0

  const alreadyTracked = incorrectlyAnsweredQuestions.value.some((question) => {
    return getQuestionKey(question) === getQuestionKey(currentQuestion.value)
  })

  if (!alreadyTracked) {
    incorrectlyAnsweredQuestions.value.push(currentQuestion.value)
  }
}

function nextQuestion() {
  if (isLastQuestion.value) {
    return
  }

  currentQuestionIndex.value++
  selectedAnswer.value = null
  isAnswered.value = false
}

function finishQuiz() {
  isQuizComplete.value = true
}

function restartWithCurrentQuestionBank() {
  questions.value = shuffleOptionsForQuestions(originalQuestions.value)
  isReviewMode.value = false
  resetQuizProgress()
  isQuizStarted.value = true
}

function repeatIncorrectQuestions() {
  if (incorrectlyAnsweredQuestions.value.length === 0) {
    return
  }

  questions.value = shuffleOptionsForQuestions(incorrectlyAnsweredQuestions.value)
  isReviewMode.value = true
  resetQuizProgress()
  isQuizStarted.value = true
}

function showQuestionBankSelection() {
  questions.value = originalQuestions.value
  isReviewMode.value = false
  isQuizStarted.value = false
  resetQuizProgress()
}

function switchMode(mode) {
  activeMode.value = mode
  isQuizStarted.value = false
  freeTextQuestionIndex.value = 0
  freeTextSessionQuestionIds.value = null
  resetQuizProgress()
}

function persistFreeTextProgress() {
  freeTextProgress.value = saveProgress(
    freeTextBankId.value,
    freeTextProgress.value,
    freeTextQuestions.value.length,
  )
}

function setFreeTextPosition(index) {
  freeTextQuestionIndex.value = Math.max(
    0,
    Math.min(index, Math.max(0, filteredFreeTextQuestions.value.length - 1)),
  )

  const question = currentFreeTextQuestion.value
  if (!question) return

  freeTextProgress.value.currentIndex = freeTextQuestions.value.indexOf(question)
  freeTextProgress.value.currentQuestionId = getQuestionId(
    question,
    freeTextProgress.value.currentIndex,
  )
  persistFreeTextProgress()
}

function getFreeTextQuestionsForFilter(filter) {
  if (filter === 'new') {
    return freeTextQuestions.value.filter((question, index) => {
      return !freeTextProgress.value.questions[getQuestionId(question, index)]
    })
  }

  if (filter === 'review') {
    return freeTextQuestions.value.filter((question, index) => {
      const record = freeTextProgress.value.questions[getQuestionId(question, index)]
      return record && (
        ['yellow', 'red'].includes(record.lastStatus)
        || ['yellow', 'red'].includes(record.bestStatus)
      )
    })
  }

  return freeTextQuestions.value
}

function prepareFreeTextFilter(filter) {
  freeTextFilter.value = filter
  freeTextSessionQuestionIds.value = getFreeTextQuestionsForFilter(filter).map((question) => {
    const bankIndex = freeTextQuestions.value.indexOf(question)
    return getQuestionId(question, bankIndex)
  })
}

function startFreeTextTraining(filter = 'all', resume = false) {
  prepareFreeTextFilter(filter)
  let targetIndex = 0

  if (resume && freeTextProgress.value.currentQuestionId) {
    const savedIndex = filteredFreeTextQuestions.value.findIndex((question, index) => {
      return getQuestionId(question, index) === freeTextProgress.value.currentQuestionId
    })
    if (savedIndex >= 0) targetIndex = savedIndex
  }

  isQuizStarted.value = true
  setFreeTextPosition(targetIndex)
}

function changeFreeTextFilter(filter) {
  if (filter === 'new' && freeTextStats.value.open === 0) return
  if (filter === 'review' && filteredQuestionCount('review') === 0) return

  prepareFreeTextFilter(filter)
  setFreeTextPosition(0)
}

function filteredQuestionCount(filter) {
  return getFreeTextQuestionsForFilter(filter).length
}

function handleFreeTextEvaluation(evaluation) {
  const question = currentFreeTextQuestion.value
  if (!question) return

  const bankIndex = freeTextQuestions.value.indexOf(question)
  const questionId = getQuestionId(question, bankIndex)
  const previous = freeTextProgress.value.questions[questionId]
  const practicedAt = new Date().toISOString()

  freeTextProgress.value.questions[questionId] = {
    lastStatus: evaluation.rating,
    bestStatus: getBetterStatus(previous?.bestStatus, evaluation.rating),
    attempts: (previous?.attempts || 0) + 1,
    fulfilledCheckpoints: evaluation.fulfilledCheckpoints,
    totalCheckpoints: evaluation.totalCheckpoints,
    lastPracticedAt: practicedAt,
  }
  freeTextProgress.value.answeredQuestionIds = [
    ...new Set([...freeTextProgress.value.answeredQuestionIds, questionId]),
  ]
  freeTextProgress.value.currentIndex = bankIndex
  freeTextProgress.value.currentQuestionId = questionId
  freeTextProgress.value.lastPracticedAt = practicedAt
  persistFreeTextProgress()
}

function nextFreeTextQuestion() {
  if (!isLastFreeTextQuestion.value) setFreeTextPosition(freeTextQuestionIndex.value + 1)
}

function restartFreeTextTraining() {
  setFreeTextPosition(0)
}

function resetCurrentFreeTextProgress() {
  const confirmed = window.confirm(
    'Fortschritt dieser Fragenbank wirklich löschen? Andere Fragenbanken bleiben erhalten.',
  )
  if (!confirmed) return

  removeProgress(freeTextBankId.value)
  freeTextProgress.value = createEmptyProgress('freeText', freeTextQuestions.value.length)
  freeTextFilter.value = 'all'
  freeTextSessionQuestionIds.value = null
  freeTextQuestionIndex.value = 0
  isQuizStarted.value = false
}

function loadPrivateQuestions({ type, questions: importedQuestions, fileName }) {
  if (type === 'freeText') {
    freeTextQuestions.value = importedQuestions
    freeTextQuestionBankName.value = `Eigene Freitext-Fragebank: ${fileName}`
    freeTextBankId.value = createBankFingerprint('freeText', importedQuestions)
    freeTextProgress.value = loadProgress(
      freeTextBankId.value,
      'freeText',
      importedQuestions.length,
    )
    switchMode('freeText')
    return
  }

  originalQuestions.value = importedQuestions
  questions.value = shuffleOptionsForQuestions(importedQuestions)
  mcQuestionBankName.value = `Eigene MC-Fragebank: ${fileName}`
  activeMode.value = 'mc'
  isReviewMode.value = false
  isQuizStarted.value = false
  resetQuizProgress()
}
</script>

<template>
  <main class="app-shell">
    <div class="theme-toolbar">
      <button
        class="theme-toggle"
        type="button"
        :aria-pressed="theme === 'dark'"
        :aria-label="theme === 'dark' ? 'Hellmodus aktivieren' : 'Dunkelmodus aktivieren'"
        @click="toggleTheme"
      >
        {{ theme === 'dark' ? '☀️ Hellmodus' : '🌙 Dunkelmodus' }}
      </button>
    </div>

    <section class="hero-section">
      <p class="eyebrow">Produktionswirtschaft & Logistik Quiz</p>
      <h1>Trainiere Produktionswirtschaft und Logistik</h1>
      <p class="intro">
        Eine kleine Vue.js-Lern-App mit neutralen Beispiel-Fragen zu
        Logistik-Grundlagen, Beschaffung, Materialbedarf, Lager, PPS,
        Lean Management, Industrie 4.0 und Umweltmanagement.
      </p>
      <p class="question-bank-label">{{ questionBankName }}</p>
      <p v-if="isReviewMode" class="review-mode-label">Wiederholung falscher Fragen</p>
    </section>

    <nav class="mode-switcher" aria-label="Lernmodus auswählen">
      <button
        type="button"
        :class="{ active: activeMode === 'mc' }"
        :aria-pressed="activeMode === 'mc'"
        @click="switchMode('mc')"
      >
        Multiple Choice
      </button>
      <button
        type="button"
        :class="{ active: activeMode === 'freeText' }"
        :aria-pressed="activeMode === 'freeText'"
        @click="switchMode('freeText')"
      >
        Freitext Training
      </button>
    </nav>

    <section v-if="!isQuizStarted" class="start-layout" aria-label="Quiz vorbereiten">
      <PrivateQuestionImporter @questions-loaded="loadPrivateQuestions" />

      <section class="start-card">
        <h2>{{ isFreeTextMode ? 'Freitext-Training bereit' : 'Quiz bereit' }}</h2>
        <p>
          Du kannst mit der öffentlichen Demo starten oder vorher eine eigene
          lokale JSON-Fragebank auswählen.
        </p>

        <div v-if="isFreeTextMode" class="training-start-options">
          <p v-if="hasSavedFreeTextProgress" class="saved-progress-notice">
            Für diese Fragenbank gibt es gespeicherten Fortschritt.
          </p>
          <div class="progress-summary compact-progress">
            <span>Bearbeitet: <strong>{{ freeTextStats.answered }} / {{ freeTextStats.questions }}</strong></span>
            <span class="status-green">Grün: <strong>{{ freeTextStats.green }}</strong></span>
            <span class="status-yellow">Gelb: <strong>{{ freeTextStats.yellow }}</strong></span>
            <span class="status-red">Rot: <strong>{{ freeTextStats.red }}</strong></span>
            <span>Offen: <strong>{{ freeTextStats.open }}</strong></span>
          </div>
          <div class="start-actions">
            <button
              v-if="hasSavedFreeTextProgress"
              class="start-button"
              type="button"
              @click="startFreeTextTraining('all', true)"
            >
              Fortsetzen
            </button>
            <button class="secondary-button" type="button" @click="startFreeTextTraining('all')">
              {{ hasSavedFreeTextProgress ? 'Von vorne starten' : 'Freitext-Training starten' }}
            </button>
            <button
              v-if="hasSavedFreeTextProgress"
              class="danger-button"
              type="button"
              @click="resetCurrentFreeTextProgress"
            >
              Fortschritt zurücksetzen
            </button>
          </div>
        </div>

        <button v-else class="start-button" type="button" @click="startQuiz">
          Mit aktueller Fragebank starten
        </button>
      </section>
    </section>

    <section v-else-if="isFreeTextMode && currentFreeTextQuestion" class="quiz-layout">
      <aside class="score-card progress-card">
        <h2>Fortschritt</h2>
        <p>Frage {{ freeTextQuestionIndex + 1 }} von {{ filteredFreeTextQuestions.length }}</p>
        <p>Bearbeitet: <strong>{{ freeTextStats.answered }} / {{ freeTextStats.questions }}</strong></p>
        <div
          class="progress-track"
          role="progressbar"
          :aria-valuenow="freeTextProgressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span :style="{ width: freeTextProgressPercent + '%' }"></span>
        </div>
        <div class="progress-summary">
          <span class="status-green">Grün: <strong>{{ freeTextStats.green }}</strong></span>
          <span class="status-yellow">Gelb: <strong>{{ freeTextStats.yellow }}</strong></span>
          <span class="status-red">Rot: <strong>{{ freeTextStats.red }}</strong></span>
          <span>Offen: <strong>{{ freeTextStats.open }}</strong></span>
        </div>

        <fieldset class="filter-picker">
          <legend>Fragenauswahl</legend>
          <button
            type="button"
            :class="{ active: freeTextFilter === 'all' }"
            @click="changeFreeTextFilter('all')"
          >
            Alle Fragen
          </button>
          <button
            type="button"
            :class="{ active: freeTextFilter === 'new' }"
            :disabled="freeTextStats.open === 0"
            @click="changeFreeTextFilter('new')"
          >
            Neue Fragen
          </button>
          <button
            type="button"
            :class="{ active: freeTextFilter === 'review' }"
            :disabled="filteredQuestionCount('review') === 0"
            @click="changeFreeTextFilter('review')"
          >
            Gelb/Rot wiederholen
          </button>
        </fieldset>

        <p class="active-filter">Aktuell: <strong>{{ freeTextFilterLabel }}</strong></p>
        <details v-if="freeTextCategoryStats.length" class="topic-progress">
          <summary>Themenübersicht</summary>
          <div v-for="category in freeTextCategoryStats" :key="category.name">
            <strong>{{ category.name }}</strong>
            <span>
              {{ category.answered }} bearbeitet ·
              <span class="status-green">{{ category.green }} G</span> ·
              <span class="status-yellow">{{ category.yellow }} Y</span> ·
              <span class="status-red">{{ category.red }} R</span>
            </span>
          </div>
        </details>
        <button class="danger-link" type="button" @click="resetCurrentFreeTextProgress">
          Fortschritt dieser Fragenbank löschen
        </button>
        <p class="local-progress-hint">Nur Lernmetadaten werden lokal gespeichert.</p>
      </aside>

      <FreeTextCard
        :key="currentFreeTextQuestion.id"
        :question="currentFreeTextQuestion"
        :is-last-question="isLastFreeTextQuestion"
        @evaluated="handleFreeTextEvaluation"
        @next-question="nextFreeTextQuestion"
        @restart-training="restartFreeTextTraining"
      />
    </section>

    <section v-else-if="isQuizComplete" class="result-card">
      <p class="eyebrow">
        {{ isReviewMode ? 'Wiederholung abgeschlossen' : 'Quiz abgeschlossen' }}
      </p>
      <h2>Auswertung</h2>

      <div class="result-grid" aria-label="Ergebnisübersicht">
        <div>
          <span>Gesamtfragen</span>
          <strong>{{ totalQuestions }}</strong>
        </div>
        <div>
          <span>Richtige Antworten</span>
          <strong>{{ score }}</strong>
        </div>
        <div>
          <span>Falsche Antworten</span>
          <strong>{{ wrongAnswerCount }}</strong>
        </div>
        <div>
          <span>Prozentwert</span>
          <strong>{{ scorePercentage }}%</strong>
        </div>
        <div>
          <span>Beste Serie</span>
          <strong>{{ bestStreak }}</strong>
        </div>
      </div>

      <p class="result-message">{{ resultMessage }}</p>

      <section class="category-summary" aria-label="Kategorie-Auswertung">
        <h3>Kategorie-Auswertung</h3>
        <div class="category-list">
          <article
            v-for="category in categoryResults"
            :key="category.name"
            class="category-card"
            :class="category.statusClass"
          >
            <div>
              <h4>{{ category.name }}</h4>
              <p>{{ category.correct }}/{{ category.total }} richtig ({{ category.percentage }}%)</p>
            </div>
            <span>{{ category.label }}</span>
          </article>
        </div>
        <p class="learning-recommendation">{{ learningRecommendation }}</p>
      </section>
      <p v-if="incorrectlyAnsweredQuestions.length === 0" class="perfect-message">
        Perfekt – keine Fehler zum Wiederholen.
      </p>

      <div class="result-actions">
        <button
          v-if="incorrectlyAnsweredQuestions.length > 0"
          class="primary-button"
          type="button"
          @click="repeatIncorrectQuestions"
        >
          Falsche Fragen wiederholen
        </button>
        <button class="secondary-button" type="button" @click="restartWithCurrentQuestionBank">
          Neu starten
        </button>
        <button class="secondary-button" type="button" @click="showQuestionBankSelection">
          Andere Fragebank laden
        </button>
      </div>
    </section>

    <section v-else-if="currentQuestion" class="quiz-layout">
      <ScoreBox
        :current-question-index="currentQuestionIndex"
        :total-questions="totalQuestions"
        :score="score"
        :current-streak="currentStreak"
        :best-streak="bestStreak"
      />

      <QuizCard
        :question="currentQuestion"
        :selected-answer="selectedAnswer"
        :is-answered="isAnswered"
        :is-last-question="isLastQuestion"
        @select-answer="selectAnswer"
        @next-question="nextQuestion"
        @restart-quiz="finishQuiz"
      />
    </section>

    <section v-else class="question-card">
      <h2>Keine Fragen gefunden</h2>
      <p>Bitte prüfe die Datei src/data/public/sampleQuestions.json.</p>
    </section>

    <footer class="app-footer" aria-label="Projektinformationen">
      <span>Version 0.4.3</span>
      <span>Produktionswirtschaft & Logistik edition</span>
      <span>MC-Quiz und lokales Freitext-Training</span>
    </footer>
  </main>
</template>
