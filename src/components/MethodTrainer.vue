<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { evaluateMethodStep } from '../utils/methodTrainerEvaluator.js'
import { formatMethodSolution } from '../utils/methodSolutionFormatter.js'

const props = defineProps({ bank: { type: Object, required: true } })

const selectedMethod = ref(null)
const currentTaskIndex = ref(0)
const view = ref('selection')
const currentStep = ref(1)
const answers = reactive({})
const feedback = reactive({})
const revealedSteps = reactive(new Set())
const sessionProgress = reactive({})
const evaluatorError = ref('')

const method = computed(() => selectedMethod.value)
const task = computed(() => method.value?.tasks?.[currentTaskIndex.value])
const totalSteps = computed(() => method.value?.engine === 'abcAnalysis' ? 3 : 3)
const allStepsDone = computed(() => currentStep.value > totalSteps.value)
const progressPercent = computed(() => Math.min(100, ((currentStep.value - 1) / totalSteps.value) * 100))

watch(() => props.bank, () => showSelection())

function resetTask() {
  Object.keys(answers).forEach((key) => delete answers[key])
  Object.keys(feedback).forEach((key) => delete feedback[key])
  revealedSteps.clear()
  currentStep.value = 1
  evaluatorError.value = ''
}

function selectMethod(item, targetView = 'practice') {
  selectedMethod.value = item
  currentTaskIndex.value = 0
  view.value = targetView
  resetTask()
}

function showSelection() {
  selectedMethod.value = null
  view.value = 'selection'
  resetTask()
}

function startPractice() {
  view.value = 'practice'
  resetTask()
}

function checkStep() {
  if (!task.value) return
  evaluatorError.value = ''
  try {
    const evaluation = evaluateMethodStep(method.value.engine, task.value, currentStep.value, answers)
    feedback[currentStep.value] = evaluation
    if (evaluation.status !== 'red') currentStep.value++
    if (currentStep.value > totalSteps.value) recordCompletion()
  } catch (error) {
    evaluatorError.value = error.message
  }
}

function revealCurrentStep() {
  if (!task.value) return
  evaluatorError.value = ''
  try {
    const evaluation = evaluateMethodStep(method.value.engine, task.value, currentStep.value, {})
    feedback[currentStep.value] = {
      ...evaluation,
      status: 'yellow',
      reason: 'Musterwerte für diesen Schritt angezeigt. Versuche den Rechenweg anschließend selbst nachzuvollziehen.',
    }
    revealedSteps.add(currentStep.value)
    currentStep.value++
    if (currentStep.value > totalSteps.value) recordCompletion()
  } catch (error) {
    evaluatorError.value = error.message
  }
}

function recordCompletion() {
  const statuses = Object.values(feedback).map(({ status }) => status)
  const status = revealedSteps.size || statuses.includes('yellow') ? 'yellow' : 'green'
  const previous = sessionProgress[method.value.methodId] || { green: 0, yellow: 0, red: 0 }
  sessionProgress[method.value.methodId] = { ...previous, [status]: previous[status] + 1 }
}

function retryTask() {
  resetTask()
}

function nextTask() {
  const count = method.value.tasks.length
  currentTaskIndex.value = (currentTaskIndex.value + 1) % count
  resetTask()
}

function methodStats(item) {
  return sessionProgress[item.methodId] || { green: 0, yellow: 0, red: 0 }
}

function hasProgress(item) {
  const stats = methodStats(item)
  return stats.green + stats.yellow + stats.red > 0
}

function feedbackLabel(status) {
  return { green: 'Richtig', yellow: 'Teilweise richtig', red: 'Noch nicht richtig' }[status]
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }).format(value)
}

// Presentation only: keep punctuation and numbers intact, including decimal commas.
function exampleSentences(text) {
  return text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/u)
}

function exampleDataTokens(text) {
  return text.split(/(\d+(?:[.,]\d+)*(?:\s*(?:€|%))?)/u).filter(Boolean)
}

function exampleDataGroups(text) {
  return exampleSentences(text).map((sentence) => {
    const colon = sentence.indexOf(':')
    return {
      label: colon < 0 ? '' : sentence.slice(0, colon + 1),
      items: (colon < 0 ? sentence : sentence.slice(colon + 1).trim()).split(/(?<=[,;])\s+/u),
    }
  })
}

function exampleStepParts(text) {
  const colon = text.indexOf(':')
  return {
    title: colon < 0 ? '' : text.slice(0, colon + 1),
    lines: exampleSentences(colon < 0 ? text : text.slice(colon + 1).trim()),
  }
}

function displaySolutionValues(step) {
  return formatMethodSolution(feedback[step]?.correctValues, method.value.engine, step)
}

</script>

<template>
  <section class="method-trainer" aria-label="Methoden-Training">
    <header class="method-bank-header">
      <div>
        <p class="eyebrow">Methoden-Training</p>
        <h2>{{ bank.title }}</h2>
        <p>{{ bank.description }}</p>
      </div>
      <button v-if="view !== 'selection'" class="secondary-button" type="button" @click="showSelection">
        Zur Methodenauswahl
      </button>
    </header>

    <div v-if="view === 'selection'" class="method-card-grid">
      <article v-for="item in bank.methods" :key="item.methodId" class="method-card">
        <p class="method-category">{{ item.category }}</p>
        <h3>{{ item.methodTitle }}</h3>
        <p>Prüfungsnah · {{ item.steps.length }} Schritte · {{ item.duration || 'kurze Einheit' }}</p>
        <p v-if="hasProgress(item)" class="method-session-progress">
          Session: <span class="status-green">{{ methodStats(item).green }} Grün</span> ·
          <span class="status-yellow">{{ methodStats(item).yellow }} Gelb</span> ·
          <span class="status-red">{{ methodStats(item).red }} Rot</span>
        </p>
        <p v-else class="method-session-progress">In dieser Session noch nicht geübt</p>
        <div class="method-card-actions">
          <button class="secondary-button" type="button" @click="selectMethod(item, 'reference')">Erklärung</button>
          <button class="primary-button" type="button" @click="selectMethod(item)">Üben</button>
        </div>
      </article>
    </div>

    <article v-else-if="method && view === 'reference'" class="method-workspace question-card">
      <p class="method-category">{{ method.category }}</p>
      <h2>{{ method.methodTitle }}</h2>
      <p class="explanation">{{ method.explanation }}</p>
      <details class="method-details" open>
        <summary>Formel/Rechenweg</summary>
        <div class="formula-box"><p v-for="line in method.formula" :key="line">{{ line }}</p></div>
      </details>
      <details class="method-details" open>
        <summary>Schrittfolge</summary>
        <ol><li v-for="step in method.steps" :key="step">{{ step }}</li></ol>
      </details>
      <details v-if="method.examples?.length" class="method-details method-examples">
        <summary>Beispiele ansehen</summary>
        <p class="method-examples-intro">Fiktive Lernbeispiele – folge dem Rechenweg Schritt für Schritt.</p>
        <div class="method-example-list">
          <article v-for="(example, index) in method.examples" :key="example.title" class="method-example">
            <header class="method-example-header">
              <span class="method-example-label">Beispiel {{ index + 1 }}</span>
              <h3>{{ example.title }}</h3>
              <p class="method-example-goal"><strong>Ziel dieses Beispiels:</strong> Den Rechenweg zu „{{ example.title }}“ nachvollziehen.</p>
            </header>
            <section class="method-example-data">
              <h4>Ausgangsdaten</h4>
              <div v-for="(group, groupIndex) in exampleDataGroups(example.givenData)" :key="groupIndex" class="method-example-data-group">
                <p v-if="group.label" class="method-example-data-label">{{ group.label }}</p>
                <ul role="list">
                  <li v-for="datum in group.items" :key="datum"><template v-for="(token, tokenIndex) in exampleDataTokens(datum)" :key="tokenIndex"><strong v-if="/^\d/u.test(token)" class="method-example-data-value">{{ token }}</strong><template v-else>{{ token }}</template></template></li>
                </ul>
              </div>
            </section>
            <section class="method-example-calculation">
              <h4>Schritt-für-Schritt-Rechnung</h4>
              <ol role="list">
                <li v-for="(step, stepIndex) in example.steps" :key="step">
                  <span class="method-example-step-number" aria-hidden="true">{{ stepIndex + 1 }}</span>
                  <div class="method-example-step-content">
                    <p v-if="exampleStepParts(step).title" class="method-example-step-title">{{ exampleStepParts(step).title }}</p>
                    <p v-for="(line, lineIndex) in exampleStepParts(step).lines" :key="lineIndex">{{ line }}</p>
                  </div>
                </li>
              </ol>
            </section>
            <section class="method-example-result">
              <h4>Ergebnis</h4>
              <p v-for="(line, lineIndex) in exampleSentences(example.result)" :key="lineIndex">{{ line }}</p>
            </section>
            <div class="method-example-notes">
              <section class="method-example-takeaway">
                <h4>Mini-Merksatz</h4>
                <p>{{ example.takeaway }}</p>
              </section>
              <section class="method-example-pitfall">
                <h4>Typische Falle</h4>
                <p>{{ example.pitfall }}</p>
              </section>
            </div>
          </article>
        </div>
      </details>
      <details class="method-details">
        <summary>Typische Fehler</summary>
        <ul><li v-for="mistake in method.commonMistakes" :key="mistake">{{ mistake }}</li></ul>
      </details>
      <button class="primary-button" type="button" @click="startPractice">Diese Methode üben</button>
    </article>

    <article v-else-if="method && task" class="method-workspace question-card">
      <div class="question-meta">
        <span>{{ method.methodTitle }}</span><span>{{ task.difficulty || 'Training' }}</span>
        <span>Schritt {{ Math.min(currentStep, totalSteps) }} von {{ totalSteps }}</span>
      </div>
      <div class="progress-track" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
        <span :style="{ width: progressPercent + '%' }"></span>
      </div>

      <details class="method-details lookup-details">
        <summary>Methode nachschlagen</summary>
        <p class="explanation">{{ method.explanation }}</p>
        <div class="formula-box"><p v-for="line in method.formula" :key="line">{{ line }}</p></div>
        <ol><li v-for="step in method.steps" :key="step">{{ step }}</li></ol>
      </details>

      <h2>Aufgabe</h2>
      <p class="method-task-text">{{ task.taskText }}</p>

      <div v-if="method.engine === 'abcAnalysis'" class="method-table-scroll">
        <table class="method-table">
          <thead><tr><th>Artikel</th><th>Stückwert</th><th>Menge</th></tr></thead>
          <tbody><tr v-for="position in task.givenData.positions" :key="position.id"><th>{{ position.id }}</th><td>{{ formatNumber(position.unitValue) }} €</td><td>{{ formatNumber(position.quantity, 0) }}</td></tr></tbody>
        </table>
      </div>
      <div v-else-if="method.engine === 'billOfMaterials'" class="structure-box">
        <p><strong>Endproduktmenge:</strong> {{ task.givenData.endProductQuantity }} × {{ task.givenData.endProduct }}</p>
        <ul><li v-for="edge in task.givenData.edges" :key="`${edge.parent}-${edge.child}`">{{ edge.parent }} → {{ edge.qtyPerParent }}× {{ edge.child }}</li></ul>
      </div>
      <div v-else class="structure-box">
        <p><strong>Jahresbedarf:</strong> {{ formatNumber(task.givenData.yearlyDemand, 0) }} Stück</p>
        <p><strong>Doppelter Monat:</strong> {{ task.givenData.specialMonths[0] }}</p>
      </div>

      <section v-for="stepNumber in totalSteps" v-show="stepNumber <= currentStep" :key="stepNumber" class="method-step" :class="feedback[stepNumber] && `step-${feedback[stepNumber].status}`">
        <h3>Schritt {{ stepNumber }}: {{ method.steps[stepNumber - 1] }}</h3>

        <template v-if="method.engine === 'abcAnalysis' && stepNumber === 1">
          <div class="method-fields"><label v-for="position in task.givenData.positions" :key="position.id">Verbrauchswert {{ position.id }} (€)<input v-model="answers[`value.${position.id}`]" type="text" inputmode="decimal" /></label><label>Gesamtverbrauchswert (€)<input v-model="answers.total" type="text" inputmode="decimal" /></label></div>
        </template>
        <template v-if="method.engine === 'abcAnalysis' && stepNumber === 2">
          <div class="method-table-scroll"><table class="method-table input-table"><thead><tr><th>Rang</th><th>Artikel</th><th>Anteil %</th><th>Kumuliert %</th></tr></thead><tbody><tr v-for="(_, index) in task.givenData.positions" :key="index"><td>{{ index + 1 }}</td><td><select v-model="answers[`rank.${index}`]"><option value="">–</option><option v-for="position in task.givenData.positions" :key="position.id" :value="position.id">{{ position.id }}</option></select></td><td><input v-model="answers[`share.${answers[`rank.${index}`]}`]" :disabled="!answers[`rank.${index}`]" type="text" inputmode="decimal" /></td><td><input v-model="answers[`cumulative.${answers[`rank.${index}`]}`]" :disabled="!answers[`rank.${index}`]" type="text" inputmode="decimal" /></td></tr></tbody></table></div>
        </template>
        <template v-if="method.engine === 'abcAnalysis' && stepNumber === 3">
          <div class="method-fields"><label v-for="position in task.givenData.positions" :key="position.id">Klasse {{ position.id }}<select v-model="answers[`class.${position.id}`]"><option value="">Bitte wählen</option><option>A</option><option>B</option><option>C</option></select></label></div>
        </template>

        <template v-if="method.engine === 'billOfMaterials'">
          <div class="method-fields">
            <label v-for="part in (stepNumber === 1 ? task.givenData.assemblies : task.givenData.leafParts)" :key="part">
              {{ stepNumber === 1 ? `${part} je ${task.givenData.endProduct}` : stepNumber === 2 ? `${part} je ${task.givenData.endProduct}` : `${part} für ${task.givenData.endProductQuantity} ${task.givenData.endProduct}` }}
              <input v-model="answers[`${stepNumber === 1 ? 'assembly' : stepNumber === 2 ? 'part' : 'yearly'}.${part}`]" type="text" inputmode="numeric" />
            </label>
          </div>
        </template>

        <template v-if="method.engine === 'monthlyDemandSplit' && stepNumber === 1">
          <label class="method-field-wide">Passende Gleichung<select v-model="answers.equation"><option value="">Bitte wählen</option><option>11x + 2x = J</option><option>12x + x = J</option><option>12x = J</option></select></label>
        </template>
        <template v-if="method.engine === 'monthlyDemandSplit' && stepNumber === 2">
          <label class="method-field-wide">Normaler Monatsbedarf x (gerundet)<input v-model="answers.normal" type="text" inputmode="decimal" /></label>
        </template>
        <template v-if="method.engine === 'monthlyDemandSplit' && stepNumber === 3">
          <div class="method-fields"><label>Sondermonat {{ task.givenData.specialMonths[0] }}<input v-model="answers.special" type="text" inputmode="decimal" /></label><label>Kontrollsumme Jahr<input v-model="answers.sum" type="text" inputmode="decimal" /></label></div>
        </template>

        <div v-if="feedback[stepNumber]" class="traffic-light step-feedback" :class="`rating-${feedback[stepNumber].status}`">
          <span></span>
          <div class="method-feedback-content">
            <strong>{{ feedbackLabel(feedback[stepNumber].status) }}</strong>
            <p>{{ feedback[stepNumber].reason }}</p>
            <section v-if="revealedSteps.has(stepNumber) || feedback[stepNumber].status !== 'green'" class="method-solution-values" aria-label="Musterwerte">
              <h4>Musterwerte</h4>
              <dl>
                <div v-for="(row, rowIndex) in displaySolutionValues(stepNumber)" :key="rowIndex" class="method-solution-row">
                  <dt>{{ row.label }}</dt>
                  <dd>{{ row.value }}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
        <div v-if="stepNumber === currentStep" class="method-step-actions"><button class="primary-button" type="button" @click="checkStep">Schritte prüfen</button><button class="secondary-button" type="button" @click="revealCurrentStep">Musterlösung anzeigen</button></div>
      </section>

      <p v-if="evaluatorError" class="method-error" role="alert">{{ evaluatorError }}</p>

      <section v-if="allStepsDone" class="method-complete">
        <h3>Aufgabe abgeschlossen</h3>
        <p>Gut gemacht. Vergleiche deinen Weg mit der kompakten Musterlösung.</p>
        <details class="method-details" open><summary>Musterlösung</summary><ol><li v-for="line in task.solutionWalkthrough" :key="line">{{ line }}</li></ol></details>
        <details class="method-details"><summary>Typische Fehler</summary><ul><li v-for="mistake in method.commonMistakes" :key="mistake">{{ mistake }}</li></ul></details>
        <div class="method-step-actions"><button class="primary-button" type="button" @click="nextTask">Neue Aufgabe</button><button class="secondary-button" type="button" @click="retryTask">Nochmal versuchen</button><button class="secondary-button" type="button" @click="showSelection">Zur Methodenauswahl</button></div>
      </section>
    </article>
  </section>
</template>
