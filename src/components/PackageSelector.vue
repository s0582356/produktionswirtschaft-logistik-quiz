<script setup>
import { computed, ref } from 'vue'
import { clearPackageProgress, getPackageProgressSummary, loadPackageProgress } from '../utils/packageProgressStore.js'
const props = defineProps({
  importedPackages: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['start-package'])
const packageAwaitingChoice = ref(null)

const packages = [
  { id: 1, title: 'Rechenblock: ABC/XYZ, Stücklisten' },
  { id: 2, title: 'PPS, Push, Pull, Kanban' },
  { id: 3, title: 'Lager, Verpackung, Kommissionierung' },
  { id: 4, title: 'Beschaffung, Make-or-Buy, Fertigungstiefe' },
  { id: 5, title: 'Verkehrsträger, Transportkonzepte, Netzwerke' },
  { id: 6, title: 'Kostenanalyse, Materialbedarf' },
  { id: 7, title: 'Grundlagen Logistik & Produktion' },
  { id: 8, title: 'Omnichannel, Letzte Meile, Retouren' },
  { id: 9, title: 'Umweltmanagement & Entsorgungslogistik' },
  { id: 10, title: 'Industrie 4.0 & Additive Fertigung' },
  { id: 11, title: 'Qualitätsmanagement & Lean Management' },
]

function formatPackageNumber(id) {
  return String(id).padStart(2, '0')
}

function packageIdFor(id) {
  return `p${formatPackageNumber(id)}`
}

function loadedPackage(pkg) {
  return props.importedPackages[packageIdFor(pkg.id)] || null
}

function progressFor(pkg) {
  const bank = loadedPackage(pkg)
  return bank ? getPackageProgressSummary(loadPackageProgress(bank)) : null
}

function requestStart(pkg) {
  if (progressFor(pkg)?.hasProgress) {
    packageAwaitingChoice.value = pkg.id
    return
  }
  emit('start-package', packageIdFor(pkg.id), 'new')
}

function resumePackage(pkg) {
  packageAwaitingChoice.value = null
  emit('start-package', packageIdFor(pkg.id), 'resume')
}

function restartPackage(pkg) {
  clearPackageProgress(loadedPackage(pkg))
  packageAwaitingChoice.value = null
  emit('start-package', packageIdFor(pkg.id), 'new')
}

const pendingPackage = computed(() => packages.find((pkg) => pkg.id === packageAwaitingChoice.value) || null)
</script>

<template>
  <section class="package-mode-layout" aria-label="Pakettraining">
    <section class="package-intro-card">
      <h2>Pakettraining</h2>
      <p>
        11 Lernpakete decken die Klausurthemen einzeln ab. Private Paketbanken können oben
        als JSON-Datei importiert werden. Fortschritt und Antworten werden je Paket
        lokal und getrennt gespeichert.
      </p>
    </section>

    <div class="package-grid">
      <article
        v-for="pkg in packages"
        :key="pkg.id"
        class="package-card"
        :class="loadedPackage(pkg) ? 'package-card-loaded' : 'package-card-disabled'"
      >
        <span class="package-number">Paket {{ formatPackageNumber(pkg.id) }}</span>
        <h3>{{ pkg.title }}</h3>

        <template v-if="loadedPackage(pkg)">
          <span class="package-status package-status-loaded">Geladen</span>
          <p class="package-loaded-meta">
            {{ loadedPackage(pkg).counts.total }} Fragen ·
            MC {{ loadedPackage(pkg).counts.mc }} ·
            Ja/Nein {{ loadedPackage(pkg).counts.yesNo }} ·
            Freitext {{ loadedPackage(pkg).counts.freeText }}
          </p>
          <p v-if="progressFor(pkg)?.completed" class="package-progress-status">Abgeschlossen</p>
          <p v-else-if="progressFor(pkg)?.hasProgress" class="package-progress-status">
            Fortschritt vorhanden · {{ progressFor(pkg).answered }} von {{ loadedPackage(pkg).counts.total }} bearbeitet
          </p>
          <button
            class="primary-button package-start-button"
            type="button"
            @click="requestStart(pkg)"
          >
            Paket trainieren
          </button>
        </template>
        <span v-else class="package-status">Noch keine private Paketbank geladen</span>
      </article>
    </div>

    <section v-if="pendingPackage" class="result-card package-resume-card" role="dialog" aria-modal="true">
      <p class="eyebrow">Fortschritt vorhanden</p>
      <h2>{{ loadedPackage(pendingPackage).packageTitle }}</h2>
      <p>{{ progressFor(pendingPackage).completed ? 'Dieses Paket wurde bereits abgeschlossen.' : `${progressFor(pendingPackage).answered} von ${loadedPackage(pendingPackage).counts.total} Fragen bearbeitet.` }}</p>
      <div class="result-actions">
        <button class="primary-button" type="button" @click="resumePackage(pendingPackage)">Letzte Sitzung fortsetzen</button>
        <button class="secondary-button" type="button" @click="restartPackage(pendingPackage)">Neu starten</button>
      </div>
    </section>
  </section>
</template>
