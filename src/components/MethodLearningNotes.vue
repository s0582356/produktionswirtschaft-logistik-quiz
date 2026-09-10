<script setup>
import { formatCommonMistakes } from '../utils/methodSolutionFormatter.js'
defineProps({ method: { type: Object, required: true }, mistakesOnly: Boolean })
</script>

<template>
  <template v-if="!mistakesOnly">
    <div v-if="method.formulaExamples?.length" class="learning-grid">
      <article v-for="example in method.formulaExamples" :key="example.title" class="learning-card">
        <h3>{{ example.title }}</h3>
        <div class="formula-box"><p>{{ example.formula }}</p></div>
        <p><strong>Mini-Beispiel (fiktiv):</strong> {{ example.example }}</p>
        <p><strong>Bedeutung:</strong> {{ example.meaning }}</p>
        <p class="learning-hint"><strong>Merksatz:</strong> {{ example.memoryHint }}</p>
      </article>
    </div>
    <div v-else class="formula-box"><p v-for="line in method.formula" :key="line">{{ line }}</p></div>
    <details v-if="method.formulaExamples?.length"><summary>Alle Formeln und Zuordnungen</summary><p v-for="line in method.formula" :key="line">{{ line }}</p></details>
    <ol v-if="method.microSteps?.length" class="micro-steps">
      <li v-for="step in method.microSteps" :key="step.action">
        <p><strong>Was mache ich?</strong> {{ step.action }}</p>
        <p><strong>Warum?</strong> {{ step.why }}</p>
        <p><strong>Formel / Logik:</strong> {{ step.logic }}</p>
        <p><strong>Typischer Fehler:</strong> {{ step.pitfall }}</p>
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
