<script setup>
import { computed, reactive, ref } from 'vue'
import QuizCard from './QuizCard.vue'
import YesNoCard from './YesNoCard.vue'
import FreeTextCard from './FreeTextCard.vue'
import { createMistakeRound, loadMistakeSession, mistakeSummary, openMistakes, recordMistake, saveMistakeSession } from '../utils/mistakeStore.js'

const props = defineProps({ packageBanksById: { type: Object, required: true } })
const setup = ref(true)
const session = reactive({ orderedQuestionRefs: [], currentQuestionIndex: 0, answers: {}, sessionStatus: 'inProgress' })
const selected = ref(null)
const answered = ref(false)
const summary = computed(() => mistakeSummary())
const loadedCount = computed(() => Object.keys(props.packageBanksById).length)
const hasBanks = computed(() => loadedCount.value > 0)
const lookup = computed(() => new Map(Object.values(props.packageBanksById).flatMap((bank) => bank.questions.map((question) => [bank.packageId + '::' + question.questionId, { bank, question }]))))
const availableRefs = computed(() => createMistakeRound('all').filter((ref) => lookup.value.has(ref.packageId + '::' + ref.questionId)))
const unavailableEntries = computed(() => openMistakes().filter((entry) => !lookup.value.has(entry.packageId + '::' + entry.questionId)))
const current = computed(() => {
  const ref = session.orderedQuestionRefs[session.currentQuestionIndex]
  return ref && lookup.value.get(ref.packageId + '::' + ref.questionId)
})
const unavailable = computed(() => session.orderedQuestionRefs.filter((ref) => !lookup.value.has(ref.packageId + '::' + ref.questionId)))
const saved = computed(() => loadMistakeSession())
const canTrainMistakes = computed(() => availableRefs.value.length > 0)

function start(size) {
  if (!canTrainMistakes.value) return
  const limit = size === 'all' ? availableRefs.value.length : Number(size)
  Object.assign(session, { orderedQuestionRefs: availableRefs.value.slice(0, limit), currentQuestionIndex: 0, answers: {}, sessionStatus: 'inProgress' })
  setup.value = false
  selected.value = null
  answered.value = false
  saveMistakeSession(session)
}

function resume() {
  const stored = saved.value
  const refs = (stored?.orderedQuestionRefs || []).filter((ref) => lookup.value.has(ref.packageId + '::' + ref.questionId))
  if (!refs.length) return
  Object.assign(session, { ...stored, orderedQuestionRefs: refs, currentQuestionIndex: Math.min(stored.currentQuestionIndex || 0, refs.length - 1) })
  setup.value = false
  selected.value = null
  answered.value = false
}

function objective(value) {
  if (answered.value) return
  selected.value = value
  answered.value = true
  const correct = value === current.value.question.correctAnswer
  session.answers[current.value.bank.packageId + '::' + current.value.question.questionId] = { correct }
  recordMistake({ packageId: current.value.bank.packageId, questionId: current.value.question.questionId, questionType: current.value.question.questionType, result: correct })
  saveMistakeSession(session)
}

function free(event) {
  session.answers[current.value.bank.packageId + '::' + current.value.question.questionId] = { status: event.rating }
  recordMistake({ packageId: current.value.bank.packageId, questionId: current.value.question.questionId, questionType: 'freeText', result: event.rating })
  saveMistakeSession(session)
}

function next() {
  if (session.currentQuestionIndex < session.orderedQuestionRefs.length - 1) session.currentQuestionIndex++
  selected.value = null
  answered.value = false
  saveMistakeSession(session)
}

function finish() {
  session.sessionStatus = 'completed'
  saveMistakeSession(session)
}
</script>

<template>
  <section class="package-mode-layout">
    <section v-if="!hasBanks" class="result-card package-bank-empty-state" role="status">
      <p class="eyebrow">Paketbanken erforderlich</p><h2>Keine Paketbanken geladen.</h2>
      <p>Bitte lade zuerst deine private Lernbibliothek.</p>
      <p class="package-library-count">0 von 11 Paketbanken geladen</p>
    </section>
    <section v-else-if="setup" class="result-card">
      <p class="eyebrow">Fehlertraining</p>
      <h2>{{ summary.total ? 'Offene Fehler: ' + summary.total : 'Aktuell keine offenen Fehler.' }}</h2>
      <p>{{ loadedCount }} von 11 Paketbanken geladen</p>
      <p>MC {{ summary.mc }} · Ja/Nein {{ summary.yesNo }} · Freitext {{ summary.freeText }} · Pakete: {{ [...summary.packages].join(', ') || '–' }}</p>
      <p v-if="unavailableEntries.length">{{ unavailableEntries.length }} Fehlerfragen gehören zu noch nicht geladenen Paketbanken. Bitte lade die betreffenden Paketbanken über die private Lernbibliothek.</p>
      <div v-if="canTrainMistakes" class="result-actions">
        <button v-if="saved?.orderedQuestionRefs?.length" class="primary-button" type="button" @click="resume">Letztes Fehlertraining fortsetzen</button>
        <button class="primary-button" type="button" @click="start(10)">Schnellrunde</button>
        <button class="secondary-button" type="button" @click="start(20)">Normale Runde</button>
        <button class="secondary-button" type="button" @click="start('all')">Alle offenen Fehler</button>
      </div>
    </section>
    <section v-else-if="current" class="quiz-layout">
      <aside class="score-card progress-card"><h2>Fehlertraining</h2><p>Frage {{ session.currentQuestionIndex + 1 }} von {{ session.orderedQuestionRefs.length }}</p></aside>
      <QuizCard v-if="current.question.questionType === 'mc'" :question="{ ...current.question, category: current.bank.packageTitle }" :selected-answer="selected" :is-answered="answered" :is-last-question="session.currentQuestionIndex === session.orderedQuestionRefs.length - 1" @select-answer="objective" @next-question="next" @restart-quiz="finish" />
      <YesNoCard v-else-if="current.question.questionType === 'yesNo'" :question="current.question" :selected-answer="selected" :is-answered="answered" :is-last-question="session.currentQuestionIndex === session.orderedQuestionRefs.length - 1" @select-answer="objective" @next-question="next" @finish="finish" />
      <FreeTextCard v-else :question="{ ...current.question, category: current.bank.packageTitle }" :is-last-question="session.currentQuestionIndex === session.orderedQuestionRefs.length - 1" :show-model-answer-toggle="true" @evaluated="free" @next-question="next" @restart-training="finish" />
    </section>
    <section v-else class="result-card">
      <h2>Fehlertraining abgeschlossen</h2>
      <p>Weiter offene Fehler: {{ openMistakes().length }}</p>
      <p v-if="unavailable.length">{{ unavailable.length }} Fehlerfragen sind ohne geladene Paketbank derzeit nicht verfügbar.</p>
    </section>
  </section>
</template>
