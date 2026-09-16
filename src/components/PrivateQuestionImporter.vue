<script setup>
import { computed, ref } from 'vue'
import { readPrivateLibraryFiles } from '../utils/privateLibraryImport.js'

const props = defineProps({
  libraryStatus: { type: Object, required: true },
})
const emit = defineEmits(['library-loaded'])
const importMessage = ref('')

const ready = computed(() => props.libraryStatus.mc > 0 && props.libraryStatus.freeText > 0 && props.libraryStatus.packageCount === 11)

async function loadFiles(files) {
  if (!files?.length) return
  const result = await readPrivateLibraryFiles(files)
  if (result.mc || result.freeText || result.packages.length) emit('library-loaded', result)
  const messages = []
  if (result.duplicates.length) messages.push(result.duplicates.length + ' identische Bank(en) übersprungen.')
  if (result.skipped.length) messages.push(result.skipped.length + ' Archiv-/QA-/Testdatei(en) ignoriert.')
  if (result.errors.length) messages.push('Nicht geladen: ' + result.errors.map((error) => error.fileName + ' (' + error.reason + ')').join('; '))
  importMessage.value = messages.join(' ')
}

async function handleFileChange(event) {
  await loadFiles(event.target.files)
  event.target.value = ''
}

</script>

<template>
  <section class="private-library-card" aria-label="Private Lernbibliothek">
    <div>
      <p class="eyebrow">Private Lernbibliothek</p>
      <h2>Private Lernbibliothek laden</h2>
      <p>Einmal laden – die passenden Trainingsmodi verwenden die erkannten Banken automatisch. Die Dateien bleiben nur in dieser Browser-Sitzung.</p>
    </div>
    <div class="private-library-actions">
      <label class="import-button private-library-load-button">
        Private Lernbibliothek laden
        <input type="file" multiple accept=".json,application/json" @change="handleFileChange">
      </label>
    </div>
    <section class="private-library-status" aria-live="polite">
      <h3>Private Lernbibliothek</h3>
      <p :class="libraryStatus.mc ? 'ready' : 'missing'">{{ libraryStatus.mc ? '✓ Multiple Choice ' + libraryStatus.mc + ' Fragen' : '△ Multiple Choice nicht geladen' }}</p>
      <p :class="libraryStatus.freeText ? 'ready' : 'missing'">{{ libraryStatus.freeText ? '✓ Freitext ' + libraryStatus.freeText + ' Fragen' : '△ Freitext nicht geladen' }}</p>
      <p :class="libraryStatus.packageCount ? 'ready' : 'missing'">{{ libraryStatus.packageCount ? '✓ Prüfungsvorbereitung ' + libraryStatus.packageCount + '/11 Pakete · ' + libraryStatus.packageQuestions + ' Fragen' : '△ Prüfungsvorbereitung nicht geladen' }}</p>
      <p class="ready">✓ Methoden-Training integriert</p>
      <strong>{{ ready ? 'Lernbibliothek bereit' : 'Lernbibliothek unvollständig' }}</strong>
    </section>
    <p v-if="importMessage" class="import-message" role="status">{{ importMessage }}</p>
  </section>
</template>
