<script setup>
import { ref } from 'vue'
import { evaluateFreeText } from '../utils/freeTextEvaluator.js'

const props = defineProps({
  question: { type: Object, required: true },
  isLastQuestion: { type: Boolean, required: true },
})

const emit = defineEmits(['next-question', 'restart-training'])
const answer = ref('')
const result = ref(null)
const keywordsOpen = ref(false)

const ratingLabels = {
  green: 'Grün – gut erklärt',
  yellow: 'Gelb – teilweise richtig',
  red: 'Rot – noch zu wenig',
}

function checkAnswer() {
  result.value = evaluateFreeText(props.question, answer.value)
}

function improveAnswer() {
  result.value = null
}
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
