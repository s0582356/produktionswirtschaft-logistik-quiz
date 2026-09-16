<script setup>
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
</script>

<template>
  <section class="package-mode-layout" aria-label="Pakettraining">
    <section class="package-intro-card">
      <h2>Pakettraining</h2>
      <p>
        11 Lernpakete decken die Klausurthemen einzeln ab. Inhalte, eigener
        Fortschritt je Paket und Fragetypen folgen in einem späteren Schritt.
      </p>
    </section>

    <div class="package-grid">
      <article
        v-for="pkg in packages"
        :key="pkg.id"
        class="package-card package-card-disabled"
      >
        <span class="package-number">Paket {{ formatPackageNumber(pkg.id) }}</span>
        <h3>{{ pkg.title }}</h3>
        <span class="package-status">Bald verfügbar</span>
      </article>
    </div>
  </section>
</template>
