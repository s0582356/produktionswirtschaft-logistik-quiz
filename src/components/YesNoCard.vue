<script setup>
const props = defineProps({
  question: {
    type: Object,
    required: true,
  },
  selectedAnswer: {
    type: Boolean,
    default: null,
  },
  isAnswered: {
    type: Boolean,
    required: true,
  },
  isLastQuestion: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['select-answer', 'next-question', 'finish'])

function getAnswerClass(value) {
  if (!props.isAnswered) {
    return ''
  }

  if (value === props.question.correctAnswer) {
    return 'answer-correct'
  }

  if (value === props.selectedAnswer) {
    return 'answer-wrong'
  }

  return 'answer-muted'
}
</script>

<template>
  <section class="question-card">
    <div class="question-meta">
      <span v-if="question.category">{{ question.category }}</span>
      <span v-if="question.difficulty">{{ question.difficulty }}</span>
    </div>

    <h2>{{ question.statement }}</h2>

    <div class="answers yes-no-answers">
      <button
        class="answer-button"
        :class="getAnswerClass(true)"
        type="button"
        :disabled="isAnswered"
        @click="emit('select-answer', true)"
      >
        Ja
      </button>
      <button
        class="answer-button"
        :class="getAnswerClass(false)"
        type="button"
        :disabled="isAnswered"
        @click="emit('select-answer', false)"
      >
        Nein
      </button>
    </div>

    <div v-if="isAnswered" class="feedback-box">
      <p v-if="selectedAnswer === question.correctAnswer" class="feedback-correct">
        Richtig.
      </p>
      <p v-else class="feedback-wrong">
        Nicht ganz. Richtig ist:
        <strong>{{ question.correctAnswer ? 'Ja' : 'Nein' }}</strong>
      </p>

      <p class="explanation">
        {{ question.explanation }}
      </p>

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
        @click="emit('finish')"
      >
        Zusammenfassung anzeigen
      </button>
    </div>
  </section>
</template>
