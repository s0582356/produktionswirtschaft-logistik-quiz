<script setup>
import { formatCommonMistakes } from '../utils/methodSolutionFormatter.js'
defineProps({ method: { type: Object, required: true }, mistakesOnly: Boolean })

// These are deliberately small, method-neutral learning situations. The
// calculation remains the existing synthetic example and is not a practice task.
const scenarioLead = {
  abcAnalysis: 'Ein fiktiver Artikel wird im Jahr in der angegebenen Menge benötigt und hat den genannten Stückwert.',
  billOfMaterials: 'Ein fiktives Endprodukt benötigt Teile über die dargestellten Baugruppen und Pfade.',
  monthlyDemandSplit: 'Ein fiktiver Jahresbedarf verteilt sich auf elf normale Monate und einen doppelten Monat.',
  xyzAbcMatrix: 'Ein fiktiver Artikel wird über mehrere Monate beobachtet und nach Wert und Verbrauchsmuster eingeordnet.',
  sourcingCostComparison: 'Ein fiktiver Betrieb vergleicht Beschaffungskosten für denselben Bedarf.',
  verticalIntegration: 'Ein fiktiver Betrieb betrachtet Eigen-, Fremd-, Einkaufs- und Umsatzwerte derselben Periode.',
  transportModeComparison: 'Eine fiktive Sendung wird anhand des im Szenario entscheidenden Merkmals zugeordnet.',
  transportConceptAssignment: 'Eine fiktive Belieferung wird anhand ihres kennzeichnenden Logistikmerkmals zugeordnet.',
  routePlanningAssignment: 'Eine fiktive Fahrt wird anhand von Planungsfrist oder Fahrmuster eingeordnet.',
}

function miniScenario(method, example) {
  return example.scenario || scenarioLead[method.engine] || 'Eine fiktive Situation wird mit der dargestellten Logik eingeordnet.'
}
</script>

<template>
  <template v-if="!mistakesOnly">
    <div v-if="method.formulaExamples?.length" class="learning-grid">
      <article v-for="example in method.formulaExamples" :key="example.title" class="learning-card">
        <h3>{{ example.title }}</h3>
        <section class="formula-box" aria-label="Formel oder Entscheidungslogik">
          <span class="learning-label">Formel / Logik</span>
          <p>{{ example.formula }}</p>
        </section>
        <section class="learning-part">
          <span class="learning-label">Mini-Szenario</span>
          <p>{{ miniScenario(method, example) }}</p>
        </section>
        <section class="learning-part learning-calculation">
          <span class="learning-label">Rechnung / Zuordnung</span>
          <p>{{ example.example }}</p>
        </section>
        <section class="learning-part">
          <span class="learning-label">Bedeutung</span>
          <p>{{ example.meaning }}</p>
        </section>
        <section class="learning-hint">
          <span class="learning-label">Merksatz</span>
          <p>{{ example.memoryHint }}</p>
        </section>
      </article>
    </div>
    <div v-else class="formula-box"><p v-for="line in method.formula" :key="line">{{ line }}</p></div>
    <details v-if="method.formulaExamples?.length"><summary>Alle Formeln und Zuordnungen</summary><p v-for="line in method.formula" :key="line">{{ line }}</p></details>
    <ol v-if="method.microSteps?.length" class="micro-steps">
      <li v-for="step in method.microSteps" :key="step.action">
        <p><strong>Ziel dieses Schritts:</strong> {{ step.action }}</p>
        <ol v-if="step.guidanceSteps?.length" class="micro-step-guidance">
          <li v-for="guidanceStep in step.guidanceSteps" :key="guidanceStep">{{ guidanceStep }}</li>
        </ol>
        <p v-else><strong>Formel / Logik:</strong> {{ step.logic }}</p>
        <p><strong>Kontrollfrage:</strong> {{ step.controlQuestion || step.why }}</p>
        <p><strong>Typische Falle:</strong> {{ step.pitfall }}</p>
      </li>
    </ol>
    <ol v-else><li v-for="step in method.steps" :key="step">{{ step }}</li></ol>
  </template>
  <details class="method-details">
    <summary>Häufige Fehler</summary>
    <article v-for="example in formatCommonMistakes(method)" :key="example.title" class="learning-card mistake-example">
      <h3>{{ example.title }}</h3>
      <dl><div v-for="row in example.rows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
    </article>
  </details>
</template>
