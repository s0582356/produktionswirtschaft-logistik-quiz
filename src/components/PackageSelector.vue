<script setup>
import { computed, ref } from 'vue'
import { clearPackageProgress, getPackageProgressSummary, loadPackageProgress } from '../utils/packageProgressStore.js'

const props = defineProps({ packageBanksById: { type: Object, default: () => ({}) } })
const emit = defineEmits(['start-package'])
const packageAwaitingChoice = ref(null)
const packageForRound = ref(null)
const sessionSize = ref(20)
const questionTypeFilter = ref('mixed')
const packages = [
  { id: 1, title: 'Rechenblock: ABC/XYZ, Stücklisten' }, { id: 2, title: 'PPS, Push, Pull, Kanban' },
  { id: 3, title: 'Lager, Verpackung, Kommissionierung' }, { id: 4, title: 'Beschaffung, Make-or-Buy, Fertigungstiefe' },
  { id: 5, title: 'Verkehrsträger, Transportkonzepte, Netzwerke' }, { id: 6, title: 'Kostenanalyse, Materialbedarf' },
  { id: 7, title: 'Grundlagen Logistik & Produktion' }, { id: 8, title: 'Omnichannel, Letzte Meile, Retouren' },
  { id: 9, title: 'Umweltmanagement & Entsorgungslogistik' }, { id: 10, title: 'Industrie 4.0 & Additive Fertigung' },
  { id: 11, title: 'Qualitätsmanagement & Lean Management' },
]
function formatPackageNumber(id) { return String(id).padStart(2, '0') }
function packageIdFor(id) { return `p${formatPackageNumber(id)}` }
function loadedPackage(pkg) { return props.packageBanksById[packageIdFor(pkg.id)] || null }
function progressFor(pkg) { const bank = loadedPackage(pkg); return bank ? getPackageProgressSummary(loadPackageProgress(bank)) : null }
function openRoundSetup(pkg) { packageAwaitingChoice.value = null; packageForRound.value = pkg.id }
function requestStart(pkg) {
  if (progressFor(pkg)?.hasProgress) packageAwaitingChoice.value = pkg.id
  else openRoundSetup(pkg)
}
function resumePackage(pkg) { packageAwaitingChoice.value = null; emit('start-package', packageIdFor(pkg.id), 'resume') }
function restartPackage(pkg) { clearPackageProgress(loadedPackage(pkg)); openRoundSetup(pkg) }
function startRound() {
  const pkg = pendingRoundPackage.value
  emit('start-package', packageIdFor(pkg.id), 'new', { sessionSize: sessionSize.value, questionTypeFilter: questionTypeFilter.value })
  packageForRound.value = null
}
const loadedPackageCount = computed(() => Object.keys(props.packageBanksById).length)
const pendingPackage = computed(() => packages.find((pkg) => pkg.id === packageAwaitingChoice.value) || null)
const pendingRoundPackage = computed(() => packages.find((pkg) => pkg.id === packageForRound.value) || null)
</script>

<template>
  <section class="package-mode-layout" aria-label="Pakettraining">
    <section class="package-intro-card"><h2>Pakettraining</h2><p class="package-library-count">{{ loadedPackageCount }} von 11 Paketbanken geladen</p><p>11 Lernpakete decken die Klausurthemen einzeln ab. Private Paketbanken können oben als JSON-Datei importiert werden. Fortschritt und Antworten werden je Paket lokal und getrennt gespeichert.</p></section>
    <div class="package-grid">
      <article v-for="pkg in packages" :key="pkg.id" class="package-card" :class="loadedPackage(pkg) ? 'package-card-loaded' : 'package-card-disabled'">
        <span class="package-number">Paket {{ formatPackageNumber(pkg.id) }}</span><h3>{{ pkg.title }}</h3>
        <template v-if="loadedPackage(pkg)">
          <span class="package-status package-status-loaded">Geladen</span>
          <p class="package-loaded-meta">{{ loadedPackage(pkg).counts.total }} Fragen · MC {{ loadedPackage(pkg).counts.mc }} · Ja/Nein {{ loadedPackage(pkg).counts.yesNo }} · Freitext {{ loadedPackage(pkg).counts.freeText }}</p>
          <p v-if="progressFor(pkg)?.completed" class="package-progress-status">Abgeschlossen</p>
          <p v-else-if="progressFor(pkg)?.hasProgress" class="package-progress-status">Fortschritt vorhanden · {{ progressFor(pkg).answered }} von {{ progressFor(pkg).roundQuestions || loadedPackage(pkg).counts.total }} bearbeitet</p>
          <button class="primary-button package-start-button" type="button" @click="requestStart(pkg)">Paket trainieren</button>
        </template>
        <span v-else class="package-status">Noch keine private Paketbank geladen</span>
      </article>
    </div>
    <section v-if="pendingPackage" class="result-card package-resume-card" role="dialog" aria-modal="true">
      <p class="eyebrow">Fortschritt vorhanden</p><h2>{{ loadedPackage(pendingPackage).packageTitle }}</h2>
      <p>{{ progressFor(pendingPackage).completed ? 'Diese Runde wurde bereits abgeschlossen.' : `${progressFor(pendingPackage).answered} von ${progressFor(pendingPackage).roundQuestions || loadedPackage(pendingPackage).counts.total} Fragen bearbeitet.` }}</p>
      <div class="result-actions"><button class="primary-button" type="button" @click="resumePackage(pendingPackage)">Letzte Sitzung fortsetzen</button><button class="secondary-button" type="button" @click="restartPackage(pendingPackage)">Neu starten</button></div>
    </section>
    <section v-if="pendingRoundPackage" class="result-card package-resume-card" role="dialog" aria-modal="true">
      <p class="eyebrow">Neue Lernrunde</p><h2>{{ loadedPackage(pendingRoundPackage).packageTitle }}</h2>
      <fieldset class="round-picker"><legend>Umfang</legend><label><input v-model="sessionSize" type="radio" :value="10"> Schnellrunde · 10 Fragen</label><label><input v-model="sessionSize" type="radio" :value="20"> Normale Runde · 20 Fragen</label><label><input v-model="sessionSize" type="radio" value="all"> Komplettes Paket · alle Fragen</label></fieldset>
      <fieldset class="round-picker"><legend>Fragetyp</legend><label><input v-model="questionTypeFilter" type="radio" value="mixed"> Gemischt</label><label><input v-model="questionTypeFilter" type="radio" value="mc"> Nur Multiple Choice</label><label><input v-model="questionTypeFilter" type="radio" value="yesNo"> Nur Ja/Nein</label><label><input v-model="questionTypeFilter" type="radio" value="freeText"> Nur Freitext</label></fieldset>
      <div class="result-actions"><button class="primary-button" type="button" @click="startRound">Runde starten</button></div>
    </section>
  </section>
</template>
