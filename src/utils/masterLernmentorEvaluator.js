import { normalizeText, phraseMatches } from './freeTextEvaluator.js'

// Local, deterministic, purely client-side heuristic - no API/AI/cloud call.
// Equivalent wording is deliberately tolerated (wordingMatchRequired=false is
// respected by never requiring one exact phrase): a concept counts as
// recognized when the answer contains ANY of its accepted phrases, reusing
// the same fuzzy token-matching freeTextEvaluator.js already uses for
// Freitext-Training instead of re-implementing matching logic here.
function conceptTerms(concept) {
  const phrases = Array.isArray(concept.acceptedPhrases) ? concept.acceptedPhrases : []
  if (phrases.length) return phrases
  return concept.label ? [concept.label] : []
}

function conceptRecognized(answer, concept) {
  return conceptTerms(concept).some((phrase) => phraseMatches(answer, phrase))
}

export function evaluateMasterLernmentorAnswer(question, rawAnswer) {
  const normalized = normalizeText(rawAnswer)
  const tokens = normalized.split(' ').filter(Boolean)
  const answer = { normalized, tokens }
  const hasAnswer = tokens.length > 0

  const coreConcepts = Array.isArray(question?.coreConcepts) ? question.coreConcepts : []
  const optionalConcepts = Array.isArray(question?.optionalConcepts) ? question.optionalConcepts : []

  const matchedCore = coreConcepts.filter((concept) => conceptRecognized(answer, concept))
  const matchedOptional = optionalConcepts.filter((concept) => conceptRecognized(answer, concept))
  const coreCoverage = coreConcepts.length ? matchedCore.length / coreConcepts.length : 0

  let hint = 'Vergleiche deine Antwort mit der Musterlösung.'
  if (hasAnswer && coreConcepts.length === 0) {
    hint = 'Vergleiche deine Antwort mit der Musterlösung.'
  } else if (hasAnswer && coreCoverage >= 0.7) {
    hint = 'Viele zentrale Punkte erkannt.'
  } else if (hasAnswer && matchedCore.length > 0) {
    hint = 'Einige Kernpunkte könnten noch fehlen.'
  }

  return {
    hint,
    hasAnswer,
    coreConceptCount: coreConcepts.length,
    matchedCoreConceptCount: matchedCore.length,
    matchedCoreConceptIds: matchedCore.map((concept) => concept.conceptId),
    matchedOptionalConceptIds: matchedOptional.map((concept) => concept.conceptId),
  }
}
