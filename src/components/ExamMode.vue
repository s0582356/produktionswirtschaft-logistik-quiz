<script setup>
import { computed, reactive, ref } from 'vue'
import { evaluateFreeText } from '../utils/freeTextEvaluator.js'
import { createExam, unansweredRefs } from '../utils/examLogic.js'
import { recordMistake } from '../utils/mistakeStore.js'
import { clearExam, initialExam, loadExam, saveExam } from '../utils/examStore.js'

const props = defineProps({ packageBanksById: { type: Object, required: true } })
const session = reactive(initialExam(props.packageBanksById))
const setup = ref(true)
const resume = ref(false)
const confirm = ref(false)

const banks = computed(() => Object.values(props.packageBanksById))
const hasBanks = computed(() => banks.value.length > 0)
const lookup = computed(() => new Map(banks.value.flatMap((bank) => (
  bank.questions.map((question) => [`${bank.packageId}::${question.questionId}`, { bank, question }])
))))
const current = computed(() => {
  const ref = session.orderedQuestionRefs[session.currentQuestionIndex]
  return ref && lookup.value.get(`${ref.packageId}::${ref.questionId}`)
})
const currentKey = computed(() => current.value && `${current.value.bank.packageId}::${current.value.question.questionId}`)
const currentAnswer = computed(() => session.answers[currentKey.value] || null)
const unanswered = computed(() => unansweredRefs(session))
const answeredCount = computed(() => session.orderedQuestionRefs.filter((ref) => {
  const answer = session.answers[`${ref.packageId}::${ref.questionId}`]
  return answer && (answer.questionType !== 'freeText' || Boolean(answer.userAnswer?.trim()))
}).length)
const openCount = computed(() => session.orderedQuestionRefs.length - answeredCount.value)

function isAnswered(ref) {
  const answer = session.answers[`${ref.packageId}::${ref.questionId}`]
  return Boolean(answer && (answer.questionType !== 'freeText' || answer.userAnswer?.trim()))
}

function persist() {
  saveExam(props.packageBanksById, session)
}

function start(examSize) {
  if (!hasBanks.value) return
  const nextSession = {
    ...initialExam(props.packageBanksById),
    ...createExam(props.packageBanksById, examSize),
    sessionStatus: 'inProgress',
    currentQuestionIndex: 0,
    answers: {},
  }
  Object.assign(session, nextSession)
  setup.value = false
  resume.value = false
  confirm.value = false
  persist()
}

function offerResume() {
  if (!hasBanks.value) {
    setup.value = true
    resume.value = false
    return
  }
  const saved = loadExam(props.packageBanksById)
  if (saved.orderedQuestionRefs.length && saved.sessionStatus === 'inProgress') {
    Object.assign(session, saved)
    resume.value = true
  } else {
    setup.value = true
  }
}

// Deliberately stores a neutral draft only. Correctness, free-text ratings and
// mistake training are calculated exclusively when the exam is submitted.
function saveAnswer(value) {
  const question = current.value.question
  if (question.questionType === 'freeText' && !value.trim()) delete session.answers[currentKey.value]
  else {
    session.answers[currentKey.value] = question.questionType === 'freeText'
      ? { questionType: 'freeText', userAnswer: value }
      : { questionType: question.questionType, selectedAnswer: value }
  }
  persist()
}

function move(offset) {
  session.currentQuestionIndex = Math.max(0, Math.min(session.orderedQuestionRefs.length - 1, session.currentQuestionIndex + offset))
  persist()
}

function jumpTo(index) {
  session.currentQuestionIndex = Math.max(0, Math.min(session.orderedQuestionRefs.length - 1, index))
  persist()
}

function gradeSubmittedExam() {
  session.orderedQuestionRefs.forEach((ref) => {
    const entry = lookup.value.get(`${ref.packageId}::${ref.questionId}`)
    const answer = session.answers[`${ref.packageId}::${ref.questionId}`]
    if (!entry || !answer) return

    if (entry.question.questionType === 'freeText') {
      const status = evaluateFreeText(entry.question, answer.userAnswer || '').rating
      answer.status = status
      recordMistake({ packageId: entry.bank.packageId, questionId: entry.question.questionId, questionType: 'freeText', result: status })
    } else {
      const correct = answer.selectedAnswer === entry.question.correctAnswer
      answer.correct = correct
      recordMistake({ packageId: entry.bank.packageId, questionId: entry.question.questionId, questionType: entry.question.questionType, result: correct })
    }
  })
}

function submit() {
  if (unanswered.value.length) {
    confirm.value = true
    return
  }
  finish()
}

function finish() {
  gradeSubmittedExam()
  session.sessionStatus = 'completed'
  confirm.value = false
  persist()
}

function reset() {
  clearExam(props.packageBanksById)
  Object.assign(session, initialExam(props.packageBanksById))
  setup.value = true
  resume.value = false
  confirm.value = false
}

offerResume()

const stats = computed(() => Object.values(session.answers).reduce((total, answer) => {
  if (answer.questionType === 'freeText') total[answer.status] = (total[answer.status] || 0) + 1
  else if (answer.correct) total.correct++
  else total.wrong++
  return total
}, { correct: 0, wrong: 0, green: 0, yellow: 0, red: 0 }))
</script>

<template>
  <section class="package-mode-layout exam-mode">
    <section v-if="setup && !hasBanks" class="result-card package-bank-empty-state" role="status">
      <p class="eyebrow">Paketbanken erforderlich</p>
      <h2>Keine Paketbanken geladen.</h2>
      <p>Bitte lade zuerst deine private Lernbibliothek.</p>
      <p class="package-library-count">0 von 11 Paketbanken geladen</p>
    </section>

    <section v-else-if="setup" class="result-card">
      <p class="eyebrow">Klausurmodus</p>
      <h2>{{ banks.length }} von 11 Paketbanken verfügbar</h2>
      <div v-if="resume" class="result-actions">
        <button class="primary-button" type="button" @click="setup = false; resume = false">Letzte Klausur fortsetzen</button>
        <button class="secondary-button" type="button" @click="resume = false">Neue Klausur starten</button>
      </div>
      <div v-else class="result-actions">
        <button class="primary-button" type="button" @click="start(20)">Kurz-Klausur · 20 Fragen</button>
        <button class="secondary-button" type="button" @click="start(35)">Standard-Klausur · 35 Fragen</button>
        <button class="secondary-button" type="button" @click="start(50)">Intensiv-Klausur · 50 Fragen</button>
      </div>
    </section>

    <section v-else-if="session.sessionStatus === 'inProgress' && current" class="quiz-layout exam-quiz-layout">
      <section class="exam-question-column">
        <section class="exam-mobile-status" aria-label="Klausurfortschritt">
          <strong>Klausurfortschritt</strong><span>Frage {{ session.currentQuestionIndex + 1 }} von {{ session.orderedQuestionRefs.length }}</span>
          <span>Bearbeitet {{ answeredCount }} / {{ session.orderedQuestionRefs.length }} · Offen {{ openCount }}</span>
        </section>

        <section class="question-card">
          <p class="eyebrow">{{ current.bank.packageId }} · {{ current.bank.packageTitle }}</p>
          <h2>{{ current.question.question || current.question.statement }}</h2>

          <div v-if="current.question.questionType === 'mc'" class="answers">
            <button
              v-for="option in current.question.options"
              :key="option"
              class="answer-button"
              :class="{ 'exam-answer-selected': currentAnswer?.selectedAnswer === option }"
              :aria-pressed="currentAnswer?.selectedAnswer === option"
              type="button"
              @click="saveAnswer(option)"
            ><span class="exam-choice-indicator" aria-hidden="true"></span>{{ option }}</button>
          </div>

          <div v-else-if="current.question.questionType === 'yesNo'" class="answers yes-no-answers">
            <button class="answer-button" :class="{ 'exam-answer-selected': currentAnswer?.selectedAnswer === true }" :aria-pressed="currentAnswer?.selectedAnswer === true" type="button" @click="saveAnswer(true)"><span class="exam-choice-indicator" aria-hidden="true"></span>Ja</button>
            <button class="answer-button" :class="{ 'exam-answer-selected': currentAnswer?.selectedAnswer === false }" :aria-pressed="currentAnswer?.selectedAnswer === false" type="button" @click="saveAnswer(false)"><span class="exam-choice-indicator" aria-hidden="true"></span>Nein</button>
          </div>

          <textarea
            v-else
            :value="currentAnswer?.userAnswer || ''"
            rows="8"
            placeholder="Deine Antwort"
            @input="saveAnswer($event.target.value)"
          />

          <nav class="exam-question-navigation" aria-label="Fragenavigation">
            <button class="secondary-button" type="button" :disabled="!session.currentQuestionIndex" @click="move(-1)">Zurück</button>
            <button class="primary-button" type="button" :disabled="session.currentQuestionIndex === session.orderedQuestionRefs.length - 1" @click="move(1)">Weiter →</button>
          </nav>
        </section>

        <section v-if="confirm" class="result-card exam-submit-confirm">
          <p>Noch {{ openCount }} Fragen unbeantwortet. Trotzdem abgeben?</p>
          <button class="primary-button" type="button" @click="finish">Trotzdem abgeben</button>
          <button class="secondary-button" type="button" @click="confirm = false">Weiter bearbeiten</button>
        </section>
      </section>

      <aside class="score-card exam-sidebar" aria-label="Klausurfortschritt">
        <p class="exam-sidebar-title">Klausurfortschritt</p>
        <p>Frage {{ session.currentQuestionIndex + 1 }} von {{ session.orderedQuestionRefs.length }}</p>
        <p><strong>Bearbeitet:</strong> {{ answeredCount }} / {{ session.orderedQuestionRefs.length }}</p>
        <p><strong>Offen:</strong> {{ openCount }}</p>
        <nav class="exam-question-overview" aria-label="Direkt zu einer Frage springen">
          <button
            v-for="(ref, index) in session.orderedQuestionRefs"
            :key="ref.packageId + ref.questionId"
            type="button"
            :class="{ current: index === session.currentQuestionIndex, answered: isAnswered(ref) }"
            :aria-label="'Frage ' + (index + 1) + (isAnswered(ref) ? ', beantwortet' : ', offen')"
            :aria-current="index === session.currentQuestionIndex ? 'step' : undefined"
            @click="jumpTo(index)"
          >{{ index + 1 }}</button>
        </nav>
        <button class="secondary-button exam-submit-button" type="button" @click="submit">Klausur abgeben</button>
      </aside>
    </section>

    <section v-else-if="session.sessionStatus === 'completed'" class="result-card">
      <p class="eyebrow">Klausur abgegeben</p>
      <div class="result-grid">
        <div><span>Bearbeitet</span><strong>{{ Object.keys(session.answers).length }}</strong></div>
        <div><span>Korrekt</span><strong>{{ stats.correct }}</strong></div>
        <div><span>Falsch</span><strong>{{ stats.wrong }}</strong></div>
        <div><span>Grün</span><strong>{{ stats.green }}</strong></div>
        <div><span>Gelb</span><strong>{{ stats.yellow }}</strong></div>
        <div><span>Rot</span><strong>{{ stats.red }}</strong></div>
      </div>
      <details v-for="ref in session.orderedQuestionRefs" :key="ref.packageId + ref.questionId">
        <summary>{{ ref.packageId }} · {{ lookup.get(`${ref.packageId}::${ref.questionId}`).question.question || lookup.get(`${ref.packageId}::${ref.questionId}`).question.statement }}</summary>
        <template v-if="lookup.get(`${ref.packageId}::${ref.questionId}`).question.questionType !== 'freeText'">
          <p>Eigene Antwort: {{ session.answers[`${ref.packageId}::${ref.questionId}`]?.selectedAnswer }}</p>
          <p>Richtige Antwort: {{ lookup.get(`${ref.packageId}::${ref.questionId}`).question.correctAnswer }}</p>
          <p>Erklärung: {{ lookup.get(`${ref.packageId}::${ref.questionId}`).question.explanation }}</p>
        </template>
        <template v-else>
          <p>Eigene Antwort: {{ session.answers[`${ref.packageId}::${ref.questionId}`]?.userAnswer }}</p>
          <p>Bewertung: {{ session.answers[`${ref.packageId}::${ref.questionId}`]?.status }}</p>
          <p>Musterlösung: {{ lookup.get(`${ref.packageId}::${ref.questionId}`).question.modelAnswer }}</p>
        </template>
      </details>
      <button class="primary-button" type="button" @click="reset">Neue Klausur starten</button>
    </section>
  </section>
</template>
