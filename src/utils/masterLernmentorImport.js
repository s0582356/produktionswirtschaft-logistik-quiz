import { MASTER_LERNMENTOR_LIBRARY_ID, validateMasterLernmentorLibrary } from './masterLernmentorLibrary.js'

// Classification requires BOTH an exact identity match on "libraryId" AND a
// structural match (chapters -> topics -> learningPhase.masterContent plus a
// questions array). Identity alone is not proof (a corrupted file could
// forge the string), and structure alone is not proof either (Codex Phase
// 5C ML-001: a foreign private bank family can coincidentally nest
// chapters/topics/questions the same way) - only both together uniquely
// identify a Master-Lernmentor library. The identity check is a strict
// equality against the single constant in masterLernmentorLibrary.js, never
// a substring/prefix/startsWith check, so "pwl-master-lernmentor-v2" or
// "other-private-bank" are rejected just like any other foreign id.
export function isMasterLernmentorLibrary(parsedData) {
  if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) return false
  if (parsedData.libraryId !== MASTER_LERNMENTOR_LIBRARY_ID) return false
  if (!Array.isArray(parsedData.chapters) || parsedData.chapters.length === 0) return false

  const firstChapter = parsedData.chapters[0]
  if (!firstChapter || typeof firstChapter !== 'object') return false
  if (!Array.isArray(firstChapter.topics) || firstChapter.topics.length === 0) return false

  const firstTopic = firstChapter.topics[0]
  const learningPhase = firstTopic?.learningPhase
  return Boolean(
    firstTopic
    && typeof firstTopic === 'object'
    && learningPhase
    && typeof learningPhase === 'object'
    && typeof learningPhase.masterContent === 'string'
    && Array.isArray(firstTopic.questions),
  )
}

export async function readMasterLernmentorFile(file) {
  if (!file) throw new Error('Keine Datei ausgewählt.')

  let parsed
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.')
  }

  if (!isMasterLernmentorLibrary(parsed)) {
    throw new Error(
      'Diese Datei ist keine gültige Master-Lernmentor-Datei. Erwartet wird eine Master-Lernmentor-'
      + `Bibliothek ("libraryId": "${MASTER_LERNMENTOR_LIBRARY_ID}") mit einer Struktur aus `
      + '"chapters[].topics[].learningPhase.masterContent" und "questions[]".',
    )
  }

  const library = validateMasterLernmentorLibrary(parsed)
  return { library, fileName: file.name }
}
