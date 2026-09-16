import { isPackageBank, validatePackageBank } from './packageBankValidator.js'

const ignoredPath = /(^|\/)(99_archiv|qa|05_testdaten)(\/|$)/i
const nonJson = /\.json$/i

function validateMcQuestions(data) {
  if (!Array.isArray(data) || !data.length) throw new Error('Keine MC-Fragen gefunden.')
  data.forEach((question, index) => {
    if (!question.question || !Array.isArray(question.options) || question.options.length < 2 || typeof question.correctAnswer !== 'string' || !question.options.includes(question.correctAnswer) || !question.explanation) throw new Error('MC-Frage ' + (index + 1) + ' ist unvollständig.')
  })
  return data.map((question, index) => ({ id: question.id ?? index + 1, category: question.category || 'Eigene Fragen', difficulty: question.difficulty || 'custom', question: question.question, options: question.options, correctAnswer: question.correctAnswer, explanation: question.explanation }))
}

function validateFreeTextQuestions(data) {
  if (!Array.isArray(data) || !data.length) throw new Error('Keine Freitextfragen gefunden.')
  data.forEach((question, index) => {
    if (!question.question || !question.modelAnswer || !Array.isArray(question.checkpoints) || !question.checkpoints.length) throw new Error('Freitextfrage ' + (index + 1) + ' ist unvollständig.')
  })
  return data.map((question, index) => ({ ...question, id: question.id ?? 'free-' + (index + 1), category: question.category || 'Eigene Fragen', difficulty: question.difficulty || 'custom', keywords: question.keywords || [], typicalErrors: question.typicalErrors || [] }))
}

export function classifyPrivateLibraryData(parsedData) {
  if (isPackageBank(parsedData)) return { type: 'package', bank: validatePackageBank(parsedData) }
  const data = Array.isArray(parsedData) ? parsedData : parsedData?.questions
  if (!Array.isArray(data)) throw new Error('Unbekanntes JSON-Format.')
  if (data.every((question) => Array.isArray(question.options) && question.correctAnswer)) return { type: 'mc', questions: validateMcQuestions(data) }
  if (data.every((question) => Array.isArray(question.checkpoints) && question.modelAnswer)) return { type: 'freeText', questions: validateFreeTextQuestions(data) }
  throw new Error('Unbekanntes JSON-Format.')
}

export function fingerprintPrivateBank(type, value) {
  return type + ':' + JSON.stringify(value)
}

function shouldIgnore(file) {
  const path = file.webkitRelativePath || file.name || ''
  return !nonJson.test(path) || ignoredPath.test(path)
}

function isClearlyDemoFile(file) {
  const path = (file.webkitRelativePath || file.name || '').toLowerCase()
  return /(^|[_-])(demo|synthetic|testdaten)([_-]|\.json$)/.test(path)
}

export async function readPrivateLibraryFiles(files) {
  const result = { mc: null, freeText: null, packages: [], errors: [], skipped: [], duplicates: [] }
  const packageIndexes = new Map()
  const seenFingerprints = new Set()

  for (const file of [...files]) {
    const label = file.webkitRelativePath || file.name
    if (shouldIgnore(file)) { result.skipped.push(label); continue }
    try {
      const parsed = JSON.parse(await file.text())
      if (isClearlyDemoFile(file)) { result.skipped.push(label); continue }
      const imported = classifyPrivateLibraryData(parsed)
      const fingerprint = fingerprintPrivateBank(imported.type, imported.bank || imported.questions)
      if (seenFingerprints.has(fingerprint)) { result.duplicates.push(label); continue }
      seenFingerprints.add(fingerprint)

      if (imported.type === 'package') {
        if (packageIndexes.has(imported.bank.packageId)) result.packages[packageIndexes.get(imported.bank.packageId)] = { bank: imported.bank, fileName: file.name }
        else { packageIndexes.set(imported.bank.packageId, result.packages.length); result.packages.push({ bank: imported.bank, fileName: file.name }) }
      } else result[imported.type] = { questions: imported.questions, fileName: file.name }
    } catch (error) { result.errors.push({ fileName: label, reason: error.message || 'Datei konnte nicht gelesen werden.' }) }
  }
  return result
}
