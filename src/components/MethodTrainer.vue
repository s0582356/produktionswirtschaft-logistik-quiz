<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { evaluateMethodStep } from '../utils/methodTrainerEvaluator.js'
import MethodLearningNotes from './MethodLearningNotes.vue'
import { solutionDerivation } from '../utils/methodSolutionDerivation.js'
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
const taskSessions = reactive({})
const taskRevision = ref(0)

function sessionKey() { return method.value && task.value ? `${method.value.methodId}:${task.value.taskId}` : '' }
function saveTask() {
  const key = sessionKey()
  if (key) taskSessions[key] = { answers: { ...answers }, feedback: { ...feedback }, revealed: [...revealedSteps], step: currentStep.value }
}
function restoreTask() {
  resetTask()
  const saved = taskSessions[sessionKey()]
  if (!saved) return
  Object.assign(answers, saved.answers)
  Object.assign(feedback, saved.feedback)
  saved.revealed.forEach(step => revealedSteps.add(step))
  currentStep.value = saved.step
}
function switchTask(index) {
  if (!Number.isInteger(index) || index < 0 || index >= method.value.tasks.length || index === currentTaskIndex.value) return
  saveTask()
  currentTaskIndex.value = index
  restoreTask()
}
function taskStatus(index) {
  const step = index === currentTaskIndex.value ? currentStep.value : taskSessions[`${method.value.methodId}:${method.value.tasks[index].taskId}`]?.step || 1
  return `${Math.min(step - 1, totalSteps.value)}/${totalSteps.value} Schritte`
}

const method = computed(() => selectedMethod.value)
const task = computed(() => method.value?.tasks?.[currentTaskIndex.value])
const totalSteps = computed(() => method.value?.steps?.length || 0)
const allStepsDone = computed(() => totalSteps.value > 0
  && currentStep.value > totalSteps.value
  && method.value.steps.every((_, index) => feedback[index + 1]?.status === 'green'))
const progressPercent = computed(() => Math.min(100, ((currentStep.value - 1) / totalSteps.value) * 100))

watch(() => props.bank, () => {
  showSelection()
  Object.keys(taskSessions).forEach(key => delete taskSessions[key])
  Object.keys(sessionProgress).forEach(key => delete sessionProgress[key])
})

function resetTask() {
  taskRevision.value++
  Object.keys(answers).forEach((key) => delete answers[key])
  Object.keys(feedback).forEach((key) => delete feedback[key])
  revealedSteps.clear()
  currentStep.value = 1
  evaluatorError.value = ''
}

function selectMethod(item, targetView = 'practice') {
  saveTask()
  selectedMethod.value = item
  currentTaskIndex.value = 0
  view.value = targetView
  restoreTask()
}

function showSelection() {
  saveTask()
  selectedMethod.value = null
  view.value = 'selection'
  resetTask()
}

function startPractice() {
  view.value = 'practice'
}

function checkStep() {
  if (!task.value || allStepsDone.value) return
  evaluatorError.value = ''
  try {
    const evaluation = evaluateMethodStep(method.value.engine, task.value, currentStep.value, answers)
    feedback[currentStep.value] = evaluation
    if (evaluation.status === 'green') currentStep.value++
    if (allStepsDone.value) recordCompletion()
  } catch (error) {
    evaluatorError.value = error.message
  }
}

function revealCurrentStep() {
  if (!task.value || allStepsDone.value) return
  evaluatorError.value = ''
  try {
    const evaluation = evaluateMethodStep(method.value.engine, task.value, currentStep.value, {})
    feedback[currentStep.value] = {
      ...evaluation,
      status: 'yellow',
      revealed: true,
      reason: 'Musterwerte angezeigt. Fülle alle Felder aus und prüfe den Schritt, um fortzufahren.',
    }
    revealedSteps.add(currentStep.value)
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
  switchTask((currentTaskIndex.value + 1) % count)
}

function methodStats(item) {
  return sessionProgress[item.methodId] || { green: 0, yellow: 0, red: 0 }
}

function hasProgress(item) {
  const stats = methodStats(item)
  return stats.green + stats.yellow + stats.red > 0
}

function feedbackLabel(evaluation) {
  if (evaluation.revealed) return 'Musterlösung'
  if (evaluation.missingFields?.length) return 'Eingabe fehlt'
  return { green: 'Richtig', yellow: 'Teilweise richtig', red: 'Noch nicht richtig' }[evaluation.status]
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
      <MethodLearningNotes :method="method" />
      <details v-if="method.examples?.length" class="method-details method-examples">
        <summary>Beispiele ansehen</summary>
        <p class="method-examples-intro">Fiktive Lernbeispiele – folge dem Lösungsweg Schritt für Schritt.</p>
        <div class="method-example-list">
          <article v-for="(example, index) in method.examples" :key="example.title" class="method-example">
            <header class="method-example-header">
              <span class="method-example-label">Beispiel {{ index + 1 }}</span>
              <h3>{{ example.title }}</h3>
              <p class="method-example-goal"><strong>Ziel dieses Beispiels:</strong> Den Lösungsweg zu „{{ example.title }}“ nachvollziehen.</p>
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
              <h4>Schritt-für-Schritt-Lösung</h4>
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
        <MethodLearningNotes :method="method" />
      </details>

      <nav class="task-selector" aria-label="Übungsaufgabe wählen">
        <button v-for="(item, index) in method.tasks" :key="item.taskId" type="button" class="secondary-button" :aria-pressed="index === currentTaskIndex" @click="switchTask(index)">Aufgabe {{ index + 1 }} · {{ taskStatus(index) }}</button>
      </nav>
      <p>Eingaben und geprüfte Schritte bleiben beim Wechsel in dieser Session erhalten.</p>
      <h2>Aufgabe {{ currentTaskIndex + 1 }} von {{ method.tasks.length }}</h2>
      <p v-if="task.learningFocus"><strong>Lernschwerpunkt:</strong> {{ task.learningFocus }}</p>
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
      <div v-else-if="method.engine === 'monthlyDemandSplit'" class="structure-box">
        <p><strong>Jahresbedarf:</strong> {{ formatNumber(task.givenData.yearlyDemand, 0) }} Stück</p>
        <p><strong>Doppelter Monat:</strong> {{ task.givenData.specialMonths[0] }}</p>
      </div>

      <div v-else-if="task.displayData" class="structure-box">
        <ul><li v-for="line in task.displayData" :key="line">{{ line }}</li></ul>
      </div>

      <section v-for="stepNumber in totalSteps" v-show="stepNumber <= currentStep" :key="`${task.taskId}-${taskRevision}-${stepNumber}`" class="method-step" :class="feedback[stepNumber] && `step-${feedback[stepNumber].status}`">
        <h3>Schritt {{ stepNumber }}: {{ method.steps[stepNumber - 1] }}</h3>

        <div v-if="method.microSteps?.[stepNumber - 1]" class="micro-step-help">
          <p><strong>Warum?</strong> {{ method.microSteps[stepNumber - 1].why }}</p>
          <p><strong>So gehst du vor:</strong> {{ method.microSteps[stepNumber - 1].logic }}</p>
          <p><strong>Typischer Fehler:</strong> {{ method.microSteps[stepNumber - 1].pitfall }}</p>
        </div>
        <details class="method-details" @toggle="event => { if (event.target.open) revealedSteps.add(stepNumber) }">
          <summary>Musterlösung mit Herleitung anzeigen</summary>
          <dl class="derivation"><div v-for="(row, index) in solutionDerivation(method, task, stepNumber)" :key="index"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
        </details>
        <fieldset class="method-step-fields" :disabled="stepNumber < currentStep" :aria-label="`Eingaben für Schritt ${stepNumber}`">
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

        <div v-if="task.inputSteps" class="method-fields">
          <label v-for="field in task.inputSteps[stepNumber - 1]" :key="field.key">
            {{ field.label }}
            <select v-if="field.options" v-model="answers[field.key]">
              <option value="">Bitte wählen</option>
              <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <input v-else v-model="answers[field.key]" type="text" inputmode="decimal" />
          </label>
        </div>

        </fieldset>

        <div v-if="feedback[stepNumber]" role="status" class="traffic-light step-feedback" :class="`rating-${feedback[stepNumber].status}`">
          <span></span>
          <div class="method-feedback-content">
            <strong>{{ feedbackLabel(feedback[stepNumber]) }}</strong>
            <p>{{ feedback[stepNumber].reason }}</p>
            <section v-if="revealedSteps.has(stepNumber) || (!feedback[stepNumber].missingFields?.length && feedback[stepNumber].status !== 'green')" class="method-solution-values" aria-label="Musterwerte">
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
        <div v-if="stepNumber === currentStep" class="method-step-actions"><button class="primary-button" type="button" @click="checkStep">Schritte prüfen</button><button class="secondary-button" type="button" @click="revealCurrentStep">Musterwerte anzeigen</button></div>
      </section>

      <p v-if="evaluatorError" class="method-error" role="alert">{{ evaluatorError }}</p>

      <section v-if="allStepsDone" class="method-complete">
        <h3>Aufgabe abgeschlossen</h3>
        <p>Gut gemacht. Vergleiche deinen Weg mit der kompakten Musterlösung.</p>
        <p>Die Herleitungen kannst du bei jedem geprüften Schritt aufklappen.</p>
        <MethodLearningNotes :method="method" mistakes-only />
        <div class="method-step-actions"><button class="primary-button" type="button" @click="nextTask">Neue Aufgabe</button><button class="secondary-button" type="button" @click="retryTask">Nochmal versuchen</button><button class="secondary-button" type="button" @click="showSelection">Zur Methodenauswahl</button></div>
      </section>
    </article>
  </section>
</template>
