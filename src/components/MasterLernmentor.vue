<script setup>
import { computed, ref, watch } from 'vue'
import MasterLernmentorTopicView from './MasterLernmentorTopicView.vue'
import { readMasterLernmentorFile } from '../utils/masterLernmentorImport.js'
import { countChapterQuestions, countLibraryQuestions, countTopicQuestions, findChapter, findTopic } from '../utils/masterLernmentorLibrary.js'
import { computeMasterLernmentorProgressSummary, loadMasterLernmentorProgress, saveMasterLernmentorProgress } from '../utils/masterLernmentorProgressStore.js'

const props = defineProps({
  library: { type: Object, default: null },
  fileName: { type: String, default: null },
})
const emit = defineEmits(['library-loaded'])

const importError = ref('')
const progress = ref(null)
const currentChapterId = ref(null)
const currentTopicId = ref(null)
const topicEntryPhase = ref('learning')
const topicEntryIndex = ref(0)

watch(() => props.library, (library) => {
  currentChapterId.value = null
  currentTopicId.value = null
  progress.value = library ? loadMasterLernmentorProgress(library, props.fileName) : null
}, { immediate: true })

const hasSavedProgress = computed(() => Boolean(progress.value?.updatedAt))
const progressSummary = computed(() => (
  props.library ? computeMasterLernmentorProgressSummary(props.library, progress.value) : null
))
const currentChapter = computed(() => (
  props.library && currentChapterId.value ? findChapter(props.library, currentChapterId.value) : null
))
const currentTopic = computed(() => (
  currentChapter.value && currentTopicId.value ? findTopic(props.library, currentChapterId.value, currentTopicId.value) : null
))
const nextTopicId = computed(() => {
  if (!currentChapter.value || !currentTopicId.value) return null
  const topics = currentChapter.value.topics
  const index = topics.findIndex((topic) => topic.topicId === currentTopicId.value)
  return index >= 0 && index < topics.length - 1 ? topics[index + 1].topicId : null
})

function persist(partialUpdate) {
  if (!props.library || !progress.value) return
  progress.value = saveMasterLernmentorProgress(props.library, { ...progress.value, ...partialUpdate })
}

async function handleFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  importError.value = ''
  try {
    const result = await readMasterLernmentorFile(file)
    emit('library-loaded', result)
  } catch (error) {
    importError.value = error.message || 'Die Datei konnte nicht geladen werden.'
  }
}

function chapterRatedCount(chapter) {
  const ratings = progress.value?.ratings || {}
  let count = 0
  for (const topic of chapter.topics) {
    for (const question of topic.questions) {
      if (question.questionId in ratings) count++
    }
  }
  return count
}

function topicRatedCount(topic) {
  const ratings = progress.value?.ratings || {}
  return topic.questions.filter((question) => question.questionId in ratings).length
}

function openChapter(chapterId) {
  currentChapterId.value = chapterId
  currentTopicId.value = null
}

function openTopic(topicId) {
  const resumesThisTopic = progress.value?.currentChapterId === currentChapterId.value
    && progress.value?.currentTopicId === topicId
    && progress.value?.currentQuestionIndex > 0
  topicEntryPhase.value = resumesThisTopic ? 'questions' : 'learning'
  topicEntryIndex.value = resumesThisTopic ? progress.value.currentQuestionIndex : 0
  currentTopicId.value = topicId
}

function resumeSavedSession() {
  if (!progress.value?.currentChapterId || !progress.value?.currentTopicId) return
  currentChapterId.value = progress.value.currentChapterId
  topicEntryPhase.value = 'questions'
  topicEntryIndex.value = progress.value.currentQuestionIndex
  currentTopicId.value = progress.value.currentTopicId
}

function handlePosition(index) {
  persist({ currentChapterId: currentChapterId.value, currentTopicId: currentTopicId.value, currentQuestionIndex: index })
}

function handleRate(questionId, rating) {
  persist({ ratings: { ...(progress.value?.ratings || {}), [questionId]: rating } })
}

function exitTopic() {
  currentTopicId.value = null
}

function goToNextTopic() {
  if (nextTopicId.value) openTopic(nextTopicId.value)
}
</script>

<template>
  <section class="master-lernmentor">
    <section v-if="!library" class="start-card ml-import-card">
      <p class="eyebrow">Master-Lernmentor</p>
      <h2>Master-Lernmentor</h2>
      <p>Den kompletten PWL-Master, Kapitel für Kapitel – verstehen und in eigenen Worten beherrschen.</p>
      <p class="local-progress-hint">
        Die Datei wird ausschließlich lokal gelesen und bleibt nur für diese Sitzung im Speicher.
        Nach einem Neuladen der Seite ist sie wieder weg und muss erneut ausgewählt werden.
      </p>
      <label class="import-button">
        Master-Lernmentor-Datei auswählen
        <input type="file" accept=".json,application/json" @change="handleFileChange">
      </label>
      <p v-if="importError" class="dictation-message" role="alert">{{ importError }}</p>
    </section>

    <template v-else-if="currentTopic">
      <MasterLernmentorTopicView
        :key="currentTopic.topicId"
        :topic="currentTopic"
        :chapter-title="currentChapter.chapterTitle"
        :ratings="progress?.ratings || {}"
        :resume-question-index="topicEntryIndex"
        :initial-phase="topicEntryPhase"
        :has-next-topic="Boolean(nextTopicId)"
        @exit="exitTopic"
        @position="handlePosition"
        @rate="handleRate"
        @next-topic="goToNextTopic"
      />
    </template>

    <template v-else-if="currentChapter">
      <section class="ml-topic-list">
        <header class="ml-topic-list-header">
          <p class="eyebrow">{{ currentChapter.chapterNumber ? `Kapitel ${currentChapter.chapterNumber}` : 'Kapitel' }}</p>
          <h2>{{ currentChapter.chapterTitle }}</h2>
          <button class="secondary-button" type="button" @click="currentChapterId = null">Zur Kapitelübersicht</button>
        </header>
        <div class="ml-card-grid">
          <button
            v-for="topic in currentChapter.topics"
            :key="topic.topicId"
            type="button"
            class="ml-card ml-topic-card"
            @click="openTopic(topic.topicId)"
          >
            <span class="ml-card-title">{{ topic.topicNumber ? `${topic.topicNumber} · ` : '' }}{{ topic.topicTitle }}</span>
            <span class="ml-card-progress">{{ topicRatedCount(topic) }} / {{ countTopicQuestions(topic) }} bearbeitet</span>
          </button>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="ml-chapter-overview">
        <header class="ml-topic-list-header">
          <p class="eyebrow">Master-Lernmentor</p>
          <h2>Kapitelübersicht</h2>
          <p v-if="progressSummary">Gesamtfortschritt: {{ progressSummary.rated }} / {{ progressSummary.total }} ({{ progressSummary.percent }}%)</p>
        </header>
        <p v-if="hasSavedProgress" class="saved-progress-notice">
          Gespeicherter Lernstand vom {{ new Date(progress.updatedAt).toLocaleString('de-DE') }} verfügbar.
        </p>
        <div v-if="hasSavedProgress" class="start-actions">
          <button class="start-button" type="button" @click="resumeSavedSession">Fortsetzen</button>
        </div>
        <div class="ml-card-grid">
          <button
            v-for="chapter in library.chapters"
            :key="chapter.chapterId"
            type="button"
            class="ml-card ml-chapter-card"
            @click="openChapter(chapter.chapterId)"
          >
            <span class="ml-card-title">{{ chapter.chapterNumber ? `${chapter.chapterNumber} · ` : '' }}{{ chapter.chapterTitle }}</span>
            <span class="ml-card-progress">{{ chapterRatedCount(chapter) }} / {{ countChapterQuestions(chapter) }} bearbeitet</span>
          </button>
        </div>
        <p class="local-progress-hint">
          {{ library.chapters.length }} Kapitel · {{ countLibraryQuestions(library) }} Fragen ·
          nur Lernmetadaten werden lokal gespeichert.
        </p>
      </section>
    </template>
  </section>
</template>
