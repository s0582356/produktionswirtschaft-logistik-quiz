<script setup>
import { computed, ref } from 'vue'
import QuizCard from './components/QuizCard.vue'
import ScoreBox from './components/ScoreBox.vue'
import PrivateQuestionImporter from './components/PrivateQuestionImporter.vue'
import FreeTextCard from './components/FreeTextCard.vue'
import sampleQuestions from './data/public/sampleQuestions.json'
import sampleFreeTextQuestions from './data/public/sampleFreeTextQuestions.json'

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
const currentFreeTextQuestion = computed(() => freeTextQuestions.value[freeTextQuestionIndex.value])
const isLastFreeTextQuestion = computed(() => freeTextQuestionIndex.value === freeTextQuestions.value.length - 1)

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
    freeTextQuestionIndex.value = 0
    isQuizStarted.value = true
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
  resetQuizProgress()
}

function nextFreeTextQuestion() {
  if (!isLastFreeTextQuestion.value) freeTextQuestionIndex.value++
}

function restartFreeTextTraining() {
  freeTextQuestionIndex.value = 0
}

function loadPrivateQuestions({ type, questions: importedQuestions, fileName }) {
  if (type === 'freeText') {
    freeTextQuestions.value = importedQuestions
    freeTextQuestionBankName.value = `Eigene Freitext-Fragebank: ${fileName}`
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

        <button class="start-button" type="button" @click="startQuiz">
          {{ isFreeTextMode ? 'Freitext-Training starten' : 'Mit aktueller Fragebank starten' }}
        </button>
      </section>
    </section>

    <section v-else-if="isFreeTextMode && currentFreeTextQuestion" class="quiz-layout">
      <aside class="score-card">
        <h2>Fortschritt</h2>
        <p>Frage {{ freeTextQuestionIndex + 1 }} von {{ freeTextQuestions.length }}</p>
        <p>Bewertung erfolgt lokal im Browser.</p>
      </aside>

      <FreeTextCard
        :key="currentFreeTextQuestion.id"
        :question="currentFreeTextQuestion"
        :is-last-question="isLastFreeTextQuestion"
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
      <span>Version 0.4.2</span>
      <span>Produktionswirtschaft & Logistik edition</span>
      <span>MC-Quiz und lokales Freitext-Training</span>
    </footer>
  </main>
</template>
