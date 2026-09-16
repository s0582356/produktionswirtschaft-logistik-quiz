<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import QuizCard from './QuizCard.vue'
import YesNoCard from './YesNoCard.vue'
import FreeTextCard from './FreeTextCard.vue'
import {
  createPackageSession, evaluateMcAnswer, evaluateYesNoAnswer, finishPackageSession,
  getCurrentQuestion, isLastPackageQuestion, recordObjectiveAnswer, resetPackageSession,
} from '../utils/packageTrainerLogic.js'
import {
  clearPackageProgress, createInitialPackageProgress, loadPackageProgress, savePackageProgress,
} from '../utils/packageProgressStore.js'

const props = defineProps({
  packageBank: { type: Object, required: true },
  resume: { type: Boolean, default: false },
})
const emit = defineEmits(['back-to-selection'])
const QUESTION_TYPE_LABELS = { mc: 'Multiple Choice', yesNo: 'Ja/Nein', freeText: 'Freitext' }
const session = reactive(createPackageSession())
session.answers = {}
const selectedAnswer = ref(null)
const isAnswered = ref(false)
const totalQuestions = computed(() => props.packageBank.questions.length)
const formattedPackageNumber = computed(() => String(props.packageBank.packageNumber).padStart(2, '0'))
const currentQuestion = computed(() => getCurrentQuestion(props.packageBank, session))
const isLastQuestion = computed(() => isLastPackageQuestion(props.packageBank, session))
const questionTypeLabel = computed(() => QUESTION_TYPE_LABELS[currentQuestion.value?.questionType] || '')
const currentAnswerRecord = computed(() => session.answers?.[currentQuestion.value?.questionId] || null)
const mcQuestionForCard = computed(() => ({ ...currentQuestion.value, category: props.packageBank.packageTitle }))
const freeTextQuestionForCard = computed(() => ({ ...currentQuestion.value, category: props.packageBank.packageTitle }))

function restoreCurrentAnswer() {
  const answer = session.answers?.[currentQuestion.value?.questionId]
  selectedAnswer.value = answer?.selectedAnswer ?? null
  isAnswered.value = Boolean(answer && ['mc', 'yesNo'].includes(answer.questionType))
}

function restoreProgress() {
  const progress = props.resume ? loadPackageProgress(props.packageBank) : createInitialPackageProgress(props.packageBank)
  session.currentIndex = progress.currentQuestionIndex
  session.isComplete = progress.sessionStatus === 'completed'
  session.answers = progress.answers
  session.stats = {
    answered: Object.keys(progress.answers).length,
    correct: progress.statistics.mcYesNoCorrect,
    wrong: progress.statistics.mcYesNoWrong,
    freeText: { green: progress.statistics.freeTextGreen, yellow: progress.statistics.freeTextYellow, red: progress.statistics.freeTextRed },
  }
  restoreCurrentAnswer()
}

function persistProgress() {
  savePackageProgress(props.packageBank, {
    ...createInitialPackageProgress(props.packageBank),
    currentQuestionIndex: session.currentIndex,
    sessionStatus: session.isComplete ? 'completed' : 'inProgress',
    answers: session.answers,
    statistics: {
      mcYesNoCorrect: session.stats.correct, mcYesNoWrong: session.stats.wrong,
      freeTextGreen: session.stats.freeText.green, freeTextYellow: session.stats.freeText.yellow, freeTextRed: session.stats.freeText.red,
    },
  })
}

function selectMcAnswer(option) {
  if (isAnswered.value) return
  selectedAnswer.value = option
  isAnswered.value = true
  const correct = evaluateMcAnswer(currentQuestion.value, option)
  recordObjectiveAnswer(session, correct)
  session.answers[currentQuestion.value.questionId] = { questionType: 'mc', selectedAnswer: option, correct }
  persistProgress()
}
function selectYesNoAnswer(value) {
  if (isAnswered.value) return
  selectedAnswer.value = value
  isAnswered.value = true
  const correct = evaluateYesNoAnswer(currentQuestion.value, value)
  recordObjectiveAnswer(session, correct)
  session.answers[currentQuestion.value.questionId] = { questionType: 'yesNo', selectedAnswer: value, correct }
  persistProgress()
}
function handleFreeTextEvaluated(evaluation) {
  const previous = session.answers[currentQuestion.value.questionId]
  if (previous?.status in session.stats.freeText) session.stats.freeText[previous.status]--
  else session.stats.answered++
  if (evaluation.rating in session.stats.freeText) session.stats.freeText[evaluation.rating]++
  session.answers[currentQuestion.value.questionId] = { questionType: 'freeText', userAnswer: evaluation.userAnswer, status: evaluation.rating }
  persistProgress()
}
function goToNextQuestion() {
  if (!isLastQuestion.value) session.currentIndex++
  selectedAnswer.value = null
  isAnswered.value = false
  persistProgress()
}
function finishPackage() { finishPackageSession(session); persistProgress() }
function restartPackage() {
  clearPackageProgress(props.packageBank)
  resetPackageSession(session)
  session.answers = {}
  selectedAnswer.value = null
  isAnswered.value = false
}
function backToSelection() { persistProgress(); emit('back-to-selection') }
restoreProgress()
onBeforeUnmount(persistProgress)
</script>

<template>
  <section class="quiz-layout package-trainer">
    <aside class="score-card progress-card">
      <h2>Paket {{ formattedPackageNumber }}</h2>
      <p>{{ packageBank.packageTitle }}</p>
      <p v-if="!session.isComplete">Frage {{ session.currentIndex + 1 }} von {{ totalQuestions }}</p>
      <p v-if="!session.isComplete">Fragetyp: <strong>{{ questionTypeLabel }}</strong></p>
      <button class="secondary-button" type="button" @click="backToSelection">Zurück zur Paketauswahl</button>
      <button class="danger-button" type="button" @click="restartPackage">Fortschritt löschen / neu starten</button>
    </aside>
    <template v-if="!session.isComplete && currentQuestion">
      <QuizCard v-if="currentQuestion.questionType === 'mc'" :key="currentQuestion.questionId" :question="mcQuestionForCard" :selected-answer="selectedAnswer" :is-answered="isAnswered" :is-last-question="isLastQuestion" @select-answer="selectMcAnswer" @next-question="goToNextQuestion" @restart-quiz="finishPackage" />
      <YesNoCard v-else-if="currentQuestion.questionType === 'yesNo'" :key="currentQuestion.questionId" :question="currentQuestion" :selected-answer="selectedAnswer" :is-answered="isAnswered" :is-last-question="isLastQuestion" @select-answer="selectYesNoAnswer" @next-question="goToNextQuestion" @finish="finishPackage" />
      <FreeTextCard v-else-if="currentQuestion.questionType === 'freeText'" :key="currentQuestion.questionId" :question="freeTextQuestionForCard" :is-last-question="isLastQuestion" :initial-answer="currentAnswerRecord?.userAnswer || ''" :initial-status="currentAnswerRecord?.status || null" @evaluated="handleFreeTextEvaluated" @next-question="goToNextQuestion" @restart-training="finishPackage" />
    </template>
    <section v-else class="result-card package-summary">
      <p class="eyebrow">Paket abgeschlossen</p><h2>{{ packageBank.packageTitle }}</h2>
      <div class="result-grid" aria-label="Paket-Ergebnisübersicht">
        <div><span>Bearbeitet</span><strong>{{ session.stats.answered }}</strong></div>
        <div><span>MC/Ja-Nein korrekt</span><strong>{{ session.stats.correct }}</strong></div>
        <div><span>MC/Ja-Nein falsch</span><strong>{{ session.stats.wrong }}</strong></div>
        <div><span>Freitext Grün</span><strong>{{ session.stats.freeText.green }}</strong></div>
        <div><span>Freitext Gelb</span><strong>{{ session.stats.freeText.yellow }}</strong></div>
        <div><span>Freitext Rot</span><strong>{{ session.stats.freeText.red }}</strong></div>
      </div>
      <div class="result-actions"><button class="primary-button" type="button" @click="restartPackage">Paket erneut trainieren</button><button class="secondary-button" type="button" @click="backToSelection">Zur Paketauswahl</button></div>
    </section>
  </section>
</template>
