<script setup>
const emit = defineEmits(['questions-loaded'])

const SUPPORTED_METHOD_ENGINES = new Set(['abcAnalysis', 'billOfMaterials', 'monthlyDemandSplit', 'xyzAbcMatrix', 'sourcingCostComparison', 'verticalIntegration', 'transportModeComparison', 'transportConceptAssignment', 'routePlanningAssignment'])

const validateMcQuestions = (data) => {
  if (!Array.isArray(data)) {
    throw new Error('Die JSON-Datei muss ein Array von Fragen enthalten.')
  }

  if (data.length === 0) {
    throw new Error('Die JSON-Datei enthält keine Fragen.')
  }

  data.forEach((question, index) => {
    if (!question.question || typeof question.question !== 'string') {
      throw new Error(`Frage ${index + 1}: "question" fehlt oder ist ungültig.`)
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(`Frage ${index + 1}: "options" muss mindestens zwei Antworten enthalten.`)
    }

    if (!question.correctAnswer || typeof question.correctAnswer !== 'string') {
      throw new Error(`Frage ${index + 1}: "correctAnswer" fehlt oder ist ungültig.`)
    }

    if (!question.options.includes(question.correctAnswer)) {
      throw new Error(`Frage ${index + 1}: "correctAnswer" muss in "options" enthalten sein.`)
    }

    if (!question.explanation || typeof question.explanation !== 'string') {
      throw new Error(`Frage ${index + 1}: "explanation" fehlt oder ist ungültig.`)
    }

    if (question.category !== undefined && typeof question.category !== 'string') {
      throw new Error(`Frage ${index + 1}: "category" muss ein Text sein.`)
    }

    if (question.difficulty !== undefined && typeof question.difficulty !== 'string') {
      throw new Error(`Frage ${index + 1}: "difficulty" muss ein Text sein.`)
    }
  })

  return data.map((question, index) => ({
    id: question.id ?? index + 1,
    category: question.category || 'Eigene Fragen',
    difficulty: question.difficulty || 'custom',
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
  }))
}

const validateFreeTextQuestions = (data) => {
  data.forEach((question, index) => {
    if (!question.question || typeof question.question !== 'string') {
      throw new Error(`Frage ${index + 1}: "question" fehlt oder ist ungültig.`)
    }
    if (!question.modelAnswer || typeof question.modelAnswer !== 'string') {
      throw new Error(`Frage ${index + 1}: "modelAnswer" fehlt oder ist ungültig.`)
    }
    if (!Array.isArray(question.checkpoints) || question.checkpoints.length === 0) {
      throw new Error(`Frage ${index + 1}: "checkpoints" muss mindestens einen Eintrag enthalten.`)
    }
    if (question.keywords !== undefined && !Array.isArray(question.keywords)) {
      throw new Error(`Frage ${index + 1}: "keywords" muss eine Liste sein.`)
    }
    if (question.typicalErrors !== undefined && !Array.isArray(question.typicalErrors)) {
      throw new Error(`Frage ${index + 1}: "typicalErrors" muss eine Liste sein.`)
    }
  })

  return data.map((question, index) => ({
    ...question,
    id: question.id ?? `free-${index + 1}`,
    category: question.category || 'Eigene Fragen',
    difficulty: question.difficulty || 'custom',
    keywords: question.keywords || [],
    typicalErrors: question.typicalErrors || [],
  }))
}

const validateMethodTrainer = (data) => {
  if (!data || Array.isArray(data) || !Array.isArray(data.methods) || data.methods.length === 0) {
    throw new Error('Die Methodentrainer-Datei muss ein Objekt mit einem nicht leeren "methods"-Array sein.')
  }

  const methodIds = new Set()
  const taskIds = new Set()
  data.methods.forEach((method, methodIndex) => {
    if (!method.methodId || !method.methodTitle || !method.explanation) {
      throw new Error(`Methode ${methodIndex + 1}: methodId, methodTitle und explanation sind erforderlich.`)
    }
    if (methodIds.has(method.methodId)) throw new Error(`Doppelte methodId: ${method.methodId}`)
    methodIds.add(method.methodId)
    if (!SUPPORTED_METHOD_ENGINES.has(method.engine)) {
      throw new Error(`Unbekannte Methoden-Engine: ${method.engine} – diese Methoden-Engine wird nicht unterstützt.`)
    }
    if (!Array.isArray(method.steps) || !method.steps.length || !Array.isArray(method.tasks) || !method.tasks.length) {
      throw new Error(`Methode ${method.methodId}: steps und tasks dürfen nicht leer sein.`)
    }
    method.tasks.forEach((task) => {
      if (!task.taskId || !task.taskText || !task.givenData) {
        throw new Error(`Methode ${method.methodId}: Jede Aufgabe braucht taskId, taskText und givenData.`)
      }
      if (taskIds.has(task.taskId)) throw new Error(`Doppelte taskId: ${task.taskId}`)
      taskIds.add(task.taskId)
    })
  })

  return { ...data, type: 'methodTrainer', title: data.title || 'Eigene Methodenbank', description: data.description || 'Lokal importierte Methodenaufgaben' }
}

const validateQuestions = (parsedData) => {
  const explicitlyMethodTrainer = !Array.isArray(parsedData)
    && (parsedData?.type === 'methodTrainer' || parsedData?.bankType === 'methodTrainer')
  const structurallyMethodTrainer = !Array.isArray(parsedData)
    && Array.isArray(parsedData?.methods)
    && parsedData.methods.length > 0
    && parsedData.methods.every((method) => method?.methodId && Array.isArray(method.tasks))

  if (explicitlyMethodTrainer || structurallyMethodTrainer) {
    return { type: 'methodTrainer', bank: validateMethodTrainer(parsedData) }
  }
  const data = Array.isArray(parsedData) ? parsedData : parsedData?.questions

  if (!Array.isArray(data)) {
    throw new Error('Die JSON-Datei muss ein Array oder ein Objekt mit "questions" enthalten.')
  }

  if (data.length === 0) {
    throw new Error('Die JSON-Datei enthält keine Fragen.')
  }

  const looksLikeMc = data.every((question) => Array.isArray(question.options) && question.correctAnswer)
  const looksLikeFreeText = data.every((question) => Array.isArray(question.checkpoints) && question.modelAnswer)

  if (looksLikeMc) {
    return { type: 'mc', questions: validateMcQuestions(data) }
  }

  if (looksLikeFreeText) {
    return { type: 'freeText', questions: validateFreeTextQuestions(data) }
  }

  throw new Error('Format nicht erkannt. Erwartet wird eine einheitliche MC-, Freitext- oder Methodentrainer-Bank.')
}

const handleFileChange = async (event) => {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  try {
    const fileContent = await file.text()
    const parsedData = JSON.parse(fileContent)
    const validatedBank = validateQuestions(parsedData)

    emit('questions-loaded', {
      ...validatedBank,
      fileName: file.name,
    })

    event.target.value = ''
  } catch (error) {
    alert(`Import fehlgeschlagen: ${error.message}`)
    event.target.value = ''
  }
}
</script>

<template>
  <section class="import-card" aria-label="Eigene JSON-Fragen importieren">
    <div>
      <h2>Eigene JSON-Fragen importieren</h2>
      <p>
        MC-, Freitext- und Methodentrainer-Banken werden automatisch erkannt. Die Datei wird
        nur im Browser gelesen, nicht hochgeladen und nicht gespeichert.
      </p>
    </div>

    <label class="import-button">
      JSON-Fragen auswählen
      <input
        type="file"
        accept=".json,application/json"
        @change="handleFileChange"
      />
    </label>
  </section>
</template>
