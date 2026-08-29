const EXPLANATION_WORDS = new Set([
  'aber', 'dadurch', 'damit', 'denn', 'deshalb', 'daher', 'indem', 'sodass',
  'weil', 'wenn', 'wodurch', 'während', 'zum', 'zur', 'bedeutet', 'führt',
])

export function normalizeText(value = '') {
  return String(value)
    .toLocaleLowerCase('de-DE')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—_/]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function editDistance(first, second) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index)

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex++) {
    let diagonal = previous[0]
    previous[0] = firstIndex

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex++) {
      const above = previous[secondIndex]
      previous[secondIndex] = Math.min(
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + 1,
        diagonal + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }

  return previous[second.length]
}

function tokenMatches(answerToken, expectedToken) {
  if (answerToken === expectedToken) return true
  if (expectedToken.length < 5 || answerToken.length < 4) return false
  const tolerance = expectedToken.length >= 9 ? 2 : 1
  return Math.abs(answerToken.length - expectedToken.length) <= tolerance
    && editDistance(answerToken, expectedToken) <= tolerance
}

function phraseMatches(answer, phrase) {
  const normalizedPhrase = normalizeText(phrase)
  if (!normalizedPhrase) return false
  if (answer.normalized.includes(normalizedPhrase)) return true

  const expectedTokens = normalizedPhrase.split(' ')
  if (expectedTokens.length === 1) {
    return answer.tokens.some((token) => tokenMatches(token, expectedTokens[0]))
  }

  return answer.tokens.some((_, start) => expectedTokens.every((token, offset) => (
    answer.tokens[start + offset] && tokenMatches(answer.tokens[start + offset], token)
  )))
}

function alternativesMatch(answer, value) {
  const alternatives = Array.isArray(value) ? value : [value]
  return alternatives.some((alternative) => phraseMatches(answer, alternative))
}

function normalizeGroups(values = []) {
  return values.map((value) => (Array.isArray(value) ? value : [value]))
}

function findTermPositions(answer, value) {
  const alternatives = Array.isArray(value) ? value : [value]
  const positions = []

  alternatives.forEach((alternative) => {
    const expected = normalizeText(alternative).split(' ').filter(Boolean)
    answer.tokens.forEach((_, start) => {
      if (expected.every((token, offset) => (
        answer.tokens[start + offset] && tokenMatches(answer.tokens[start + offset], token)
      ))) {
        positions.push(start)
      }
    })
  })

  return positions
}

function relationshipMatches(answer, relationship) {
  if (!relationship) return true
  const relationships = Array.isArray(relationship) ? relationship : [relationship]

  return relationships.every((item) => {
    const terms = item.terms || [item.left, item.right].filter(Boolean)
    if (terms.length < 2) return true
    const maxDistance = Number(item.maxDistance ?? item.distance ?? 12)
    const positionGroups = terms.map((term) => findTermPositions(answer, term))
    if (positionGroups.some((positions) => positions.length === 0)) return false

    return positionGroups[0].some((firstPosition) => (
      positionGroups.slice(1).every((positions) => (
        positions.some((position) => Math.abs(position - firstPosition) <= maxDistance)
      ))
    ))
  })
}

function checkpointMatches(answer, checkpoint) {
  if (typeof checkpoint === 'string') return phraseMatches(answer, checkpoint)

  const allOf = normalizeGroups(checkpoint.allOf || [])
  const anyOf = checkpoint.anyOf || checkpoint.keywords || []
  const synonyms = checkpoint.synonyms || []
  const hasSearchTerms = allOf.length || anyOf.length || synonyms.length
  const alternativeTerms = [...anyOf, ...synonyms]

  const matchesAll = allOf.every((group) => alternativesMatch(answer, group))
  const matchesAny = alternativeTerms.length === 0 || alternativesMatch(answer, alternativeTerms)

  return Boolean(hasSearchTerms && matchesAll && matchesAny)
    && relationshipMatches(answer, checkpoint.near || checkpoint.relationship)
}

function checkpointLabel(checkpoint, index) {
  if (typeof checkpoint === 'string') return checkpoint
  return checkpoint.label || checkpoint.title || `Checkpunkt ${index + 1}`
}

function looksLikeKeywordList(rawAnswer, tokens) {
  const trimmed = rawAnswer.trim()
  const nonEmptyLines = trimmed.split(/\n/).filter((line) => line.trim())
  const bulletLines = nonEmptyLines.filter((line) => /^\s*[-*•\d.)]+\s*/.test(line)).length
  const commaCount = (trimmed.match(/[,;]/g) || []).length
  const sentenceCount = (trimmed.match(/[.!?](?:\s|$)/g) || []).length
  const hasExplanationSignal = tokens.some((token) => EXPLANATION_WORDS.has(token))

  return tokens.length >= 3
    && (bulletLines >= 2 || (commaCount >= 2 && sentenceCount <= 1))
    && !hasExplanationSignal
}

export function evaluateFreeText(question, rawAnswer) {
  const normalized = normalizeText(rawAnswer)
  const tokens = normalized.split(' ').filter(Boolean)
  const answer = { normalized, tokens }
  const checkpoints = question.checkpoints || []
  const evaluated = checkpoints.map((checkpoint, index) => ({
    label: checkpointLabel(checkpoint, index),
    matched: checkpointMatches(answer, checkpoint),
    critical: typeof checkpoint === 'object' && checkpoint.critical === true,
  }))
  const detected = evaluated.filter((item) => item.matched).map((item) => item.label)
  const missing = evaluated.filter((item) => !item.matched).map((item) => item.label)
  const criticalMissing = evaluated.some((item) => item.critical && !item.matched)
  const coverage = evaluated.length ? detected.length / evaluated.length : 0
  const minWords = Number(question.minWords ?? 12)
  const keywordList = looksLikeKeywordList(rawAnswer, tokens)
  const hasExplanation = tokens.length >= minWords
    && !keywordList
    && (/[.!?]/.test(rawAnswer) || tokens.some((token) => EXPLANATION_WORDS.has(token)))

  let rating = 'red'
  if (
    coverage >= Number(question.greenThreshold ?? 0.7)
    && !criticalMissing
    && hasExplanation
  ) {
    rating = 'green'
  } else if (detected.length > 0 && (coverage >= Number(question.yellowThreshold ?? 0.35) || tokens.length >= minWords / 2)) {
    rating = 'yellow'
  }

  if (keywordList && rating === 'green') rating = 'yellow'

  let improvement = question.improvementHint || 'Ergänze die fehlenden Checkpunkte und erkläre ihren Zusammenhang in vollständigen Sätzen.'
  if (tokens.length < minWords) {
    improvement = `Formuliere ausführlicher: mindestens ${minWords} Wörter sind vorgesehen. ${improvement}`
  } else if (keywordList) {
    improvement = `Verbinde die Stichwörter zu einer verständlichen Erklärung. ${improvement}`
  }

  return {
    rating,
    detected,
    missing,
    wordCount: tokens.length,
    minWords,
    keywordList,
    hasExplanation,
    improvement,
  }
}
