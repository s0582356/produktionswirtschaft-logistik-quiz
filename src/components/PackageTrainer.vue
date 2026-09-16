<script setup>
import { computed, reactive, ref } from 'vue'
import QuizCard from './QuizCard.vue'
import YesNoCard from './YesNoCard.vue'
import FreeTextCard from './FreeTextCard.vue'
import {
  advanceToNextQuestion,
  createPackageSession,
  evaluateMcAnswer,
  evaluateYesNoAnswer,
  finishPackageSession,
  getCurrentQuestion,
  isLastPackageQuestion,
  recordFreeTextEvaluation,
  recordObjectiveAnswer,
  resetPackageSession,
} from '../utils/packageTrainerLogic.js'

const props = defineProps({
  packageBank: { type: Object, required: true },
})

const emit = defineEmits(['back-to-selection'])

const QUESTION_TYPE_LABELS = { mc: 'Multiple Choice', yesNo: 'Ja/Nein', freeText: 'Freitext' }

const session = reactive(createPackageSession())
const selectedAnswer = ref(null)
const isAnswered = ref(false)

const totalQuestions = computed(() => props.packageBank.questions.length)
const formattedPackageNumber = computed(() => String(props.packageBank.packageNumber).padStart(2, '0'))
const currentQuestion = computed(() => getCurrentQuestion(props.packageBank, session))
const isLastQuestion = computed(() => isLastPackageQuestion(props.packageBank, session))
const questionTypeLabel = computed(() => QUESTION_TYPE_LABELS[currentQuestion.value?.questionType] || '')

const mcQuestionForCard = computed(() => ({
  ...currentQuestion.value,
  category: props.packageBank.packageTitle,
}))
const freeTextQuestionForCard = computed(() => ({
  ...currentQuestion.value,
  category: props.packageBank.packageTitle,
}))

function selectMcAnswer(option) {
  if (isAnswered.value) return
  selectedAnswer.value = option
  isAnswered.value = true
  recordObjectiveAnswer(session, evaluateMcAnswer(currentQuestion.value, option))
}

function selectYesNoAnswer(value) {
  if (isAnswered.value) return
  selectedAnswer.value = value
  isAnswered.value = true
  recordObjectiveAnswer(session, evaluateYesNoAnswer(currentQuestion.value, value))
}

function handleFreeTextEvaluated(evaluation) {
  recordFreeTextEvaluation(session, evaluation.rating)
}

function goToNextQuestion() {
  advanceToNextQuestion(props.packageBank, session)
  selectedAnswer.value = null
  isAnswered.value = false
}

function finishPackage() {
  finishPackageSession(session)
}

function restartPackage() {
  resetPackageSession(session)
  selectedAnswer.value = null
  isAnswered.value = false
}

function backToSelection() {
  emit('back-to-selection')
}
</script>

<template>
  <section class="quiz-layout package-trainer">
    <aside class="score-card progress-card">
      <h2>Paket {{ formattedPackageNumber }}</h2>
      <p>{{ packageBank.packageTitle }}</p>
      <p v-if="!session.isComplete">Frage {{ session.currentIndex + 1 }} von {{ totalQuestions }}</p>
      <p v-if="!session.isComplete">Fragetyp: <strong>{{ questionTypeLabel }}</strong></p>
      <button class="secondary-button" type="button" @click="backToSelection">
        Zurück zur Paketauswahl
      </button>
    </aside>

    <template v-if="!session.isComplete && currentQuestion">
      <QuizCard
        v-if="currentQuestion.questionType === 'mc'"
        :key="currentQuestion.questionId"
        :question="mcQuestionForCard"
        :selected-answer="selectedAnswer"
        :is-answered="isAnswered"
        :is-last-question="isLastQuestion"
        @select-answer="selectMcAnswer"
        @next-question="goToNextQuestion"
        @restart-quiz="finishPackage"
      />

      <YesNoCard
        v-else-if="currentQuestion.questionType === 'yesNo'"
        :key="currentQuestion.questionId"
        :question="currentQuestion"
        :selected-answer="selectedAnswer"
        :is-answered="isAnswered"
        :is-last-question="isLastQuestion"
        @select-answer="selectYesNoAnswer"
        @next-question="goToNextQuestion"
        @finish="finishPackage"
      />

      <FreeTextCard
        v-else-if="currentQuestion.questionType === 'freeText'"
        :key="currentQuestion.questionId"
        :question="freeTextQuestionForCard"
        :is-last-question="isLastQuestion"
        @evaluated="handleFreeTextEvaluated"
        @next-question="goToNextQuestion"
        @restart-training="finishPackage"
      />
    </template>

    <section v-else class="result-card package-summary">
      <p class="eyebrow">Paket abgeschlossen</p>
      <h2>{{ packageBank.packageTitle }}</h2>

      <div class="result-grid" aria-label="Paket-Ergebnisübersicht">
        <div>
          <span>Bearbeitet</span>
          <strong>{{ session.stats.answered }}</strong>
        </div>
        <div>
          <span>MC/Ja-Nein korrekt</span>
          <strong>{{ session.stats.correct }}</strong>
        </div>
        <div>
          <span>MC/Ja-Nein falsch</span>
          <strong>{{ session.stats.wrong }}</strong>
        </div>
        <div>
          <span>Freitext Grün</span>
          <strong>{{ session.stats.freeText.green }}</strong>
        </div>
        <div>
          <span>Freitext Gelb</span>
          <strong>{{ session.stats.freeText.yellow }}</strong>
        </div>
        <div>
          <span>Freitext Rot</span>
          <strong>{{ session.stats.freeText.red }}</strong>
        </div>
      </div>

      <div class="result-actions">
        <button class="primary-button" type="button" @click="restartPackage">
          Paket erneut trainieren
        </button>
        <button class="secondary-button" type="button" @click="backToSelection">
          Zur Paketauswahl
        </button>
      </div>
    </section>
  </section>
</template>
