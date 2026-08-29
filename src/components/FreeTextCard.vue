<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { evaluateFreeText } from '../utils/freeTextEvaluator.js'

const props = defineProps({
  question: { type: Object, required: true },
  isLastQuestion: { type: Boolean, required: true },
})

const emit = defineEmits(['evaluated', 'next-question', 'restart-training'])
const answer = ref('')
const result = ref(null)
const keywordsOpen = ref(false)
const isDictating = ref(false)
const dictationMessage = ref('')
let recognition = null

const ratingLabels = {
  green: 'Grün – gut erklärt',
  yellow: 'Gelb – teilweise richtig',
  red: 'Rot – noch zu wenig',
}

function checkAnswer() {
  stopDictation()
  result.value = evaluateFreeText(props.question, answer.value)
  emit('evaluated', {
    rating: result.value.rating,
    fulfilledCheckpoints: result.value.detected.length,
    totalCheckpoints: result.value.detected.length + result.value.missing.length,
  })
}

function improveAnswer() {
  result.value = null
}

function appendTranscript(transcript) {
  const cleanTranscript = transcript.trim()
  if (!cleanTranscript) return

  const currentAnswer = answer.value.trimEnd()
  answer.value = currentAnswer ? `${currentAnswer} ${cleanTranscript}` : cleanTranscript
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function startDictation() {
  dictationMessage.value = ''
  const SpeechRecognition = getSpeechRecognition()

  if (!SpeechRecognition) {
    dictationMessage.value = 'Spracheingabe ist in diesem Browser nicht verfügbar. Bitte nutze die normale Texteingabe.'
    return
  }

  try {
    recognition = new SpeechRecognition()
    recognition.lang = 'de-DE'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcripts = []
      for (let index = event.resultIndex; index < event.results.length; index++) {
        if (event.results[index].isFinal) transcripts.push(event.results[index][0].transcript)
      }
      appendTranscript(transcripts.join(' '))
    }
    recognition.onerror = (event) => {
      const permissionDenied = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      dictationMessage.value = permissionDenied
        ? 'Der Mikrofonzugriff wurde nicht erlaubt. Du kannst deine Antwort weiterhin per Tastatur eingeben.'
        : 'Das Diktat konnte nicht fortgesetzt werden. Bitte versuche es erneut oder nutze die normale Texteingabe.'
      stopDictation()
    }
    recognition.onend = () => {
      isDictating.value = false
      recognition = null
    }
    recognition.start()
    isDictating.value = true
  } catch {
    dictationMessage.value = 'Das Diktat konnte nicht gestartet werden. Bitte versuche es erneut oder nutze die normale Texteingabe.'
    stopDictation()
  }
}

function stopDictation() {
  if (recognition) {
    const activeRecognition = recognition
    recognition = null
    activeRecognition.onend = null
    try {
      activeRecognition.stop()
    } catch {
      // Die Erkennung ist bereits beendet.
    }
  }
  isDictating.value = false
}

function toggleDictation() {
  if (isDictating.value) stopDictation()
  else startDictation()
}

onBeforeUnmount(stopDictation)
</script>

<template>
  <section class="question-card free-text-card">
    <div class="question-meta">
      <span>{{ question.category }}</span>
      <span>{{ question.difficulty }}</span>
    </div>

    <h2>{{ question.question }}</h2>

    <details
      v-if="question.keywords?.length"
      class="keyword-details"
      @toggle="keywordsOpen = $event.currentTarget.open"
    >
      <summary>
        {{ keywordsOpen ? '▲ Schlüsselwörter ausblenden' : '▼ Schlüsselwörter anzeigen' }}
      </summary>
      <div class="keyword-chips">
        <span v-for="keyword in question.keywords" :key="keyword">{{ keyword }}</span>
      </div>
    </details>

    <label class="answer-label" for="free-text-answer">Deine Antwort</label>
    <textarea
      id="free-text-answer"
      v-model="answer"
      rows="8"
      :disabled="Boolean(result)"
      placeholder="Erkläre deine Antwort in eigenen Worten …"
      @keydown.ctrl.enter="checkAnswer"
    />

    <div v-if="!result" class="dictation-controls">
      <button
        class="secondary-button dictation-button"
        :class="{ 'dictation-button-active': isDictating }"
        type="button"
        :aria-pressed="isDictating"
        @click="toggleDictation"
      >
        {{ isDictating ? '⏹ Diktat stoppen' : '🎙 Antwort diktieren' }}
      </button>
      <span v-if="isDictating" class="dictation-status" role="status">Diktat läuft …</span>
    </div>

    <p v-if="dictationMessage" class="dictation-message" role="alert">
      {{ dictationMessage }}
    </p>
    <p class="dictation-hint">
      Optional: Die Spracheingabe nutzt die Spracherkennung deines Browsers. Du kannst jederzeit
      auch per Tastatur antworten oder den Text korrigieren.
    </p>

    <div class="answer-toolbar">
      <span>{{ answer.trim() ? answer.trim().split(/\s+/).length : 0 }} Wörter</span>
      <button
        v-if="!result"
        class="primary-button"
        type="button"
        :disabled="!answer.trim()"
        @click="checkAnswer"
      >
        Antwort prüfen
      </button>
    </div>

    <section v-if="result" class="free-text-feedback" aria-live="polite">
      <div class="traffic-light" :class="`rating-${result.rating}`">
        <span aria-hidden="true"></span>
        <strong>{{ ratingLabels[result.rating] }}</strong>
      </div>

      <p class="feedback-summary">
        {{ result.detected.length }} von {{ result.detected.length + result.missing.length }}
        Checkpunkten erkannt · {{ result.wordCount }} Wörter
      </p>

      <div class="checkpoint-grid">
        <section class="checkpoint-box checkpoint-found">
          <h3>Erkannte Checkpunkte</h3>
          <ul v-if="result.detected.length">
            <li v-for="item in result.detected" :key="item">{{ item }}</li>
          </ul>
          <p v-else>Noch keine Checkpunkte erkannt.</p>
        </section>

        <section class="checkpoint-box checkpoint-missing">
          <h3>Fehlende Checkpunkte</h3>
          <ul v-if="result.missing.length">
            <li v-for="item in result.missing" :key="item">{{ item }}</li>
          </ul>
          <p v-else>Keine fehlenden Checkpunkte.</p>
        </section>
      </div>

      <section v-if="question.typicalErrors?.length" class="feedback-section">
        <h3>Typische Fehler</h3>
        <ul>
          <li v-for="error in question.typicalErrors" :key="error">{{ error }}</li>
        </ul>
      </section>

      <section class="feedback-section model-answer">
        <h3>Musterlösung</h3>
        <p>{{ question.modelAnswer }}</p>
      </section>

      <section class="feedback-section improvement-box">
        <h3>Verbesserungshinweis</h3>
        <p>{{ result.improvement }}</p>
      </section>

      <div class="free-text-actions">
        <button class="secondary-button" type="button" @click="improveAnswer">
          Antwort verbessern / nochmal versuchen
        </button>
        <button
          v-if="!isLastQuestion"
          class="primary-button"
          type="button"
          @click="emit('next-question')"
        >
          Nächste Frage
        </button>
        <button
          v-else
          class="primary-button"
          type="button"
          @click="emit('restart-training')"
        >
          Training neu starten
        </button>
      </div>
    </section>
  </section>
</template>
