<script setup>
import { computed, ref } from 'vue'
import { evaluateMasterLernmentorAnswer } from '../utils/masterLernmentorEvaluator.js'
import { SOURCE_GAP_STATUS } from '../utils/masterLernmentorLibrary.js'

const props = defineProps({
  topic: { type: Object, required: true },
  chapterTitle: { type: String, default: '' },
  ratings: { type: Object, default: () => ({}) },
  resumeQuestionIndex: { type: Number, default: 0 },
  initialPhase: { type: String, default: 'learning' },
  hasNextTopic: { type: Boolean, default: false },
})

const emit = defineEmits(['exit', 'rate', 'position', 'next-topic'])

const RATING_LABELS = { safe: '🟢 Sicher', partial: '🟡 Teilweise', learn: '🔴 Noch lernen' }

const phase = ref(props.initialPhase === 'questions' ? 'questions' : 'learning')
const currentIndex = ref(Math.max(0, Math.min(props.resumeQuestionIndex || 0, props.topic.questions.length - 1)))
const freeAnswer = ref('')
const revealed = ref(false)
const hintOpen = ref(false)
const evaluation = ref(null)
const lastRatedQuestionId = ref(null)

const totalQuestions = computed(() => props.topic.questions.length)
const currentQuestion = computed(() => props.topic.questions[currentIndex.value] || null)
const isLastQuestion = computed(() => currentIndex.value === totalQuestions.value - 1)
const isSourceGap = computed(() => currentQuestion.value?.sourceStatus === SOURCE_GAP_STATUS)
const currentRating = computed(() => props.ratings?.[currentQuestion.value?.questionId] ?? null)

function resetQuestionState() {
  freeAnswer.value = ''
  revealed.value = false
  hintOpen.value = false
  evaluation.value = null
  lastRatedQuestionId.value = null
}

function startQuestions() {
  phase.value = 'questions'
  emit('position', currentIndex.value)
}

function laterContinue() {
  emit('position', currentIndex.value)
  emit('exit')
}

function revealSolution() {
  evaluation.value = evaluateMasterLernmentorAnswer(currentQuestion.value, freeAnswer.value)
  revealed.value = true
}

function reviseAnswer() {
  revealed.value = false
  evaluation.value = null
}

function rate(rating) {
  if (!currentQuestion.value) return
  emit('rate', currentQuestion.value.questionId, rating)
  lastRatedQuestionId.value = currentQuestion.value.questionId
}

function goToNextQuestion() {
  if (isLastQuestion.value) {
    phase.value = 'complete'
    return
  }
  currentIndex.value += 1
  resetQuestionState()
  emit('position', currentIndex.value)
}
</script>

<template>
  <section class="master-lernmentor-topic">
    <header class="ml-topic-header">
      <p class="eyebrow">{{ chapterTitle }}</p>
      <h2>{{ topic.topicNumber ? `${topic.topicNumber} · ` : '' }}{{ topic.topicTitle }}</h2>
      <button class="secondary-button" type="button" @click="emit('exit')">Zurück zu den Themen</button>
    </header>

    <section v-if="phase === 'learning'" class="ml-learning-phase">
      <p class="ml-learning-label">Masterabschnitt</p>
      <div class="ml-master-content">{{ topic.learningPhase.masterContent }}</div>
      <div class="ml-learning-actions">
        <button class="primary-button" type="button" @click="startQuestions">Jetzt abfragen</button>
        <button class="secondary-button" type="button" @click="laterContinue">Später weiter</button>
      </div>
    </section>

    <section v-else-if="phase === 'questions' && currentQuestion" class="ml-question-flow">
      <p class="ml-progress-line">Frage {{ currentIndex + 1 }} von {{ totalQuestions }}</p>

      <div v-if="isSourceGap" class="ml-source-gap-box" role="note">
        Quellenhinweis: Der Master begrenzt die inhaltliche Tiefe dieses Punktes. Es werden keine
        zusätzlichen Inhalte ergänzt.
      </div>

      <h3 class="ml-question-text">{{ currentQuestion.question }}</h3>
      <p v-if="currentQuestion.expectedAnswerLength" class="ml-expected-length">
        Erwarteter Umfang: {{ currentQuestion.expectedAnswerLength }}
      </p>

      <details v-if="currentQuestion.hint" class="ml-hint-details" @toggle="hintOpen = $event.currentTarget.open">
        <summary>{{ hintOpen ? '▲ Hinweis ausblenden' : '▼ Hinweis anzeigen' }}</summary>
        <p>{{ currentQuestion.hint }}</p>
      </details>

      <label class="answer-label" for="ml-free-answer">Deine Antwort</label>
      <textarea
        id="ml-free-answer"
        v-model="freeAnswer"
        rows="7"
        :disabled="revealed"
        placeholder="Erkläre in eigenen Worten …"
      />

      <div class="ml-answer-toolbar">
        <button
          v-if="!revealed"
          class="primary-button"
          type="button"
          :disabled="!freeAnswer.trim()"
          @click="revealSolution"
        >
          Lösung vergleichen
        </button>
      </div>

      <section v-if="revealed" class="ml-solution-panel" aria-live="polite">
        <section class="feedback-section ml-heuristic-box">
          <p>{{ evaluation.hint }}</p>
        </section>

        <section class="feedback-section model-answer">
          <h3>Kernpunkte kurz</h3>
          <p>{{ currentQuestion.shortModelAnswer }}</p>
        </section>

        <section class="feedback-section">
          <h3>Minimal ausreichende Antwort</h3>
          <p>{{ currentQuestion.minimumSufficientAnswer }}</p>
        </section>

        <section v-if="currentQuestion.coreConcepts.length" class="checkpoint-box checkpoint-found">
          <h3>Kernbegriffe</h3>
          <ul>
            <li v-for="concept in currentQuestion.coreConcepts" :key="concept.conceptId || concept.label">
              <strong>{{ concept.label }}</strong><span v-if="concept.description"> – {{ concept.description }}</span>
            </li>
          </ul>
        </section>

        <section v-if="currentQuestion.optionalConcepts.length" class="checkpoint-box">
          <h3>Optionale Ergänzungen</h3>
          <ul>
            <li v-for="concept in currentQuestion.optionalConcepts" :key="concept.conceptId || concept.label">
              <strong>{{ concept.label }}</strong><span v-if="concept.description"> – {{ concept.description }}</span>
            </li>
          </ul>
        </section>

        <section v-if="currentQuestion.calculationRequirements" class="feedback-section ml-calculation-box">
          <h3>Rechenweg</h3>
          <p v-if="currentQuestion.calculationRequirements.formula"><strong>Formel:</strong> {{ currentQuestion.calculationRequirements.formula }}</p>
          <ul v-if="currentQuestion.calculationRequirements.stepSequence?.length">
            <li v-for="(step, index) in currentQuestion.calculationRequirements.stepSequence" :key="index">{{ step }}</li>
          </ul>
          <p v-if="currentQuestion.calculationRequirements.workedExample"><strong>Beispiel:</strong> {{ currentQuestion.calculationRequirements.workedExample }}</p>
          <p v-if="currentQuestion.calculationRequirements.interpretationRequirement"><strong>Interpretation:</strong> {{ currentQuestion.calculationRequirements.interpretationRequirement }}</p>
          <p v-if="currentQuestion.calculationRequirements.commonError"><strong>Typischer Fehler:</strong> {{ currentQuestion.calculationRequirements.commonError }}</p>
        </section>

        <section class="feedback-section ml-master-excerpt-box">
          <h3>Master-Auszug</h3>
          <p>{{ currentQuestion.masterExcerpt }}</p>
        </section>

        <fieldset class="ml-self-rating">
          <legend>Selbsteinschätzung</legend>
          <button
            v-for="(label, rating) in RATING_LABELS"
            :key="rating"
            type="button"
            class="ml-rating-button"
            :class="`ml-rating-${rating}`"
            :aria-pressed="currentRating === rating"
            @click="rate(rating)"
          >
            {{ label }}
          </button>
        </fieldset>

        <div class="ml-question-actions">
          <button class="secondary-button" type="button" @click="reviseAnswer">Antwort überarbeiten</button>
          <button
            v-if="lastRatedQuestionId === currentQuestion.questionId"
            class="primary-button"
            type="button"
            @click="goToNextQuestion"
          >
            {{ isLastQuestion ? 'Thema abschließen' : 'Nächste Frage →' }}
          </button>
        </div>
      </section>
    </section>

    <section v-else-if="phase === 'complete'" class="result-card ml-topic-complete">
      <p class="eyebrow">Thema abgeschlossen</p>
      <h2>{{ topic.topicTitle }}</h2>
      <div class="result-actions">
        <button v-if="hasNextTopic" class="primary-button" type="button" @click="emit('next-topic')">
          Nächstes Thema
        </button>
        <button class="secondary-button" type="button" @click="emit('exit')">Zurück zu den Themen</button>
      </div>
    </section>
  </section>
</template>
