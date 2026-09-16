<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import QuizCard from './QuizCard.vue'
import YesNoCard from './YesNoCard.vue'
import FreeTextCard from './FreeTextCard.vue'
import { createPackageSession, evaluateMcAnswer, evaluateYesNoAnswer, finishPackageSession, recordObjectiveAnswer } from '../utils/packageTrainerLogic.js'
import { clearPackageProgress, createInitialPackageProgress, loadPackageProgress, savePackageProgress } from '../utils/packageProgressStore.js'
import { createPackageRound, getFilterLabel, getRoundLabel } from '../utils/packageRoundLogic.js'

const props = defineProps({ packageBank: { type: Object, required: true }, resume: { type: Boolean, default: false }, roundSettings: { type: Object, default: null } })
const emit = defineEmits(['back-to-selection'])
const QUESTION_TYPE_LABELS = { mc: 'Multiple Choice', yesNo: 'Ja/Nein', freeText: 'Freitext' }
const session = reactive(createPackageSession())
session.answers = {}
session.orderedQuestionIds = []
session.sessionSize = 'all'
session.questionTypeFilter = 'mixed'
const selectedAnswer = ref(null)
const isAnswered = ref(false)
const persistOnUnmount = ref(true)
const questionsById = computed(() => new Map(props.packageBank.questions.map((question) => [question.questionId, question])))
const roundQuestions = computed(() => session.orderedQuestionIds.map((id) => questionsById.value.get(id)).filter(Boolean))
const totalQuestions = computed(() => roundQuestions.value.length)
const formattedPackageNumber = computed(() => String(props.packageBank.packageNumber).padStart(2, '0'))
const currentQuestion = computed(() => roundQuestions.value[session.currentIndex] || null)
const isLastQuestion = computed(() => totalQuestions.value > 0 && session.currentIndex === totalQuestions.value - 1)
const questionTypeLabel = computed(() => QUESTION_TYPE_LABELS[currentQuestion.value?.questionType] || '')
const currentAnswerRecord = computed(() => session.answers?.[currentQuestion.value?.questionId] || null)
const mcQuestionForCard = computed(() => ({ ...currentQuestion.value, category: props.packageBank.packageTitle }))
const freeTextQuestionForCard = computed(() => ({ ...currentQuestion.value, category: props.packageBank.packageTitle }))
const roundLabel = computed(() => getRoundLabel(session.sessionSize))
const filterLabel = computed(() => getFilterLabel(session.questionTypeFilter))

function restoreCurrentAnswer() { const answer = session.answers?.[currentQuestion.value?.questionId]; selectedAnswer.value = answer?.selectedAnswer ?? null; isAnswered.value = Boolean(answer && ['mc', 'yesNo'].includes(answer.questionType)) }
function applyProgress(progress) {
  const fallbackIds = props.packageBank.questions.map((question) => question.questionId)
  const validIds = (progress.orderedQuestionIds || []).filter((id) => questionsById.value.has(id))
  session.orderedQuestionIds = validIds.length ? validIds : fallbackIds
  session.sessionSize = validIds.length ? progress.sessionSize : 'all'
  session.questionTypeFilter = validIds.length ? progress.questionTypeFilter : 'mixed'
  session.currentIndex = Math.max(0, Math.min(progress.currentQuestionIndex, Math.max(0, session.orderedQuestionIds.length - 1)))
  session.isComplete = progress.sessionStatus === 'completed'
  session.answers = progress.answers
  session.stats = { answered: Object.keys(progress.answers).length, correct: progress.statistics.mcYesNoCorrect, wrong: progress.statistics.mcYesNoWrong, freeText: { green: progress.statistics.freeTextGreen, yellow: progress.statistics.freeTextYellow, red: progress.statistics.freeTextRed } }
  restoreCurrentAnswer()
}
function restoreProgress() {
  if (props.resume) applyProgress(loadPackageProgress(props.packageBank))
  else {
    const progress = createInitialPackageProgress(props.packageBank)
    const round = createPackageRound(props.packageBank.questions, props.roundSettings || undefined)
    applyProgress({ ...progress, ...round })
  }
}
function persistProgress() {
  savePackageProgress(props.packageBank, { ...createInitialPackageProgress(props.packageBank), currentQuestionIndex: session.currentIndex, sessionStatus: session.isComplete ? 'completed' : 'inProgress', sessionSize: session.sessionSize, questionTypeFilter: session.questionTypeFilter, orderedQuestionIds: session.orderedQuestionIds, answers: session.answers, statistics: { mcYesNoCorrect: session.stats.correct, mcYesNoWrong: session.stats.wrong, freeTextGreen: session.stats.freeText.green, freeTextYellow: session.stats.freeText.yellow, freeTextRed: session.stats.freeText.red } })
}
function selectMcAnswer(option) { if (isAnswered.value) return; selectedAnswer.value = option; isAnswered.value = true; const correct = evaluateMcAnswer(currentQuestion.value, option); recordObjectiveAnswer(session, correct); session.answers[currentQuestion.value.questionId] = { questionType: 'mc', selectedAnswer: option, correct }; persistProgress() }
function selectYesNoAnswer(value) { if (isAnswered.value) return; selectedAnswer.value = value; isAnswered.value = true; const correct = evaluateYesNoAnswer(currentQuestion.value, value); recordObjectiveAnswer(session, correct); session.answers[currentQuestion.value.questionId] = { questionType: 'yesNo', selectedAnswer: value, correct }; persistProgress() }
function handleFreeTextEvaluated(evaluation) { const previous = session.answers[currentQuestion.value.questionId]; if (previous?.status in session.stats.freeText) session.stats.freeText[previous.status]--; else session.stats.answered++; if (evaluation.rating in session.stats.freeText) session.stats.freeText[evaluation.rating]++; session.answers[currentQuestion.value.questionId] = { questionType: 'freeText', userAnswer: evaluation.userAnswer, status: evaluation.rating }; persistProgress() }
function goToNextQuestion() { if (!isLastQuestion.value) session.currentIndex++; selectedAnswer.value = null; isAnswered.value = false; persistProgress() }
function finishPackage() { finishPackageSession(session); persistProgress() }
function restartPackage() { persistOnUnmount.value = false; clearPackageProgress(props.packageBank); emit('back-to-selection') }
function backToSelection() { persistProgress(); emit('back-to-selection') }
restoreProgress()
persistProgress()
onBeforeUnmount(() => { if (persistOnUnmount.value) persistProgress() })
</script>

<template>
  <section class="quiz-layout package-trainer">
    <aside class="score-card progress-card"><h2>Paket {{ formattedPackageNumber }}</h2><p>{{ packageBank.packageTitle }}</p><p>{{ roundLabel }} · {{ filterLabel }}</p><p v-if="!session.isComplete">Frage {{ session.currentIndex + 1 }} von {{ totalQuestions }}</p><p v-if="!session.isComplete">Fragetyp: <strong>{{ questionTypeLabel }}</strong></p><button class="secondary-button" type="button" @click="backToSelection">Zurück zur Paketauswahl</button><button class="danger-button" type="button" @click="restartPackage">Fortschritt löschen / neue Runde wählen</button></aside>
    <template v-if="!session.isComplete && currentQuestion"><QuizCard v-if="currentQuestion.questionType === 'mc'" :key="currentQuestion.questionId" :question="mcQuestionForCard" :selected-answer="selectedAnswer" :is-answered="isAnswered" :is-last-question="isLastQuestion" @select-answer="selectMcAnswer" @next-question="goToNextQuestion" @restart-quiz="finishPackage" /><YesNoCard v-else-if="currentQuestion.questionType === 'yesNo'" :key="currentQuestion.questionId" :question="currentQuestion" :selected-answer="selectedAnswer" :is-answered="isAnswered" :is-last-question="isLastQuestion" @select-answer="selectYesNoAnswer" @next-question="goToNextQuestion" @finish="finishPackage" /><FreeTextCard v-else-if="currentQuestion.questionType === 'freeText'" :key="currentQuestion.questionId" :question="freeTextQuestionForCard" :is-last-question="isLastQuestion" :initial-answer="currentAnswerRecord?.userAnswer || ''" :initial-status="currentAnswerRecord?.status || null" :show-model-answer-toggle="true" @evaluated="handleFreeTextEvaluated" @next-question="goToNextQuestion" @restart-training="finishPackage" /></template>
    <section v-else class="result-card package-summary"><p class="eyebrow">Paket abgeschlossen</p><h2>{{ packageBank.packageTitle }}</h2><p>{{ roundLabel }} · {{ filterLabel }}</p><div class="result-grid" aria-label="Paket-Ergebnisübersicht"><div><span>Bearbeitet</span><strong>{{ session.stats.answered }}</strong></div><div><span>MC/Ja-Nein korrekt</span><strong>{{ session.stats.correct }}</strong></div><div><span>MC/Ja-Nein falsch</span><strong>{{ session.stats.wrong }}</strong></div><div><span>Freitext Grün</span><strong>{{ session.stats.freeText.green }}</strong></div><div><span>Freitext Gelb</span><strong>{{ session.stats.freeText.yellow }}</strong></div><div><span>Freitext Rot</span><strong>{{ session.stats.freeText.red }}</strong></div></div><div class="result-actions"><button class="primary-button" type="button" @click="restartPackage">Neue Runde wählen</button><button class="secondary-button" type="button" @click="backToSelection">Zur Paketauswahl</button></div></section>
  </section>
</template>
