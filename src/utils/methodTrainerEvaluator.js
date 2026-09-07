const DEFAULT_TOLERANCE = {
  currencyAbsolute: 0.01,
  percentagePoints: 0.2,
  relative: 1e-6,
}

export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  let normalized = String(value ?? '').trim().replace(/[\s ]/g, '')
  if (!normalized) return Number.NaN

  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.')
  } else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '')
  }

  return Number(normalized)
}

export function nearlyEqual(actual, expected, absolute = 0.01, relative = 1e-6) {
  return Number.isFinite(actual)
    && Math.abs(actual - expected) <= Math.max(absolute, Math.abs(expected) * relative)
}

function statusFor(correct, total, yellowThreshold = total - 1) {
  if (correct === total) return 'green'
  if (correct >= Math.max(1, yellowThreshold)) return 'yellow'
  return 'red'
}

function result(status, reason, correctValues) {
  return { status, reason, correctValues }
}

export function calculateAbcReference(task) {
  const positions = task.givenData?.positions || []
  if (!positions.length) throw new Error('Die ABC-Aufgabe enthält keine Positionen.')

  const values = Object.fromEntries(positions.map((position) => [
    position.id,
    Number(position.unitValue) * Number(position.quantity),
  ]))
  const total = Object.values(values).reduce((sum, value) => sum + value, 0)
  const sorted = [...positions].sort((a, b) => values[b.id] - values[a.id])
  const shares = {}
  const cumulative = {}
  const classes = {}
  const limits = { A: 80, B: 95, ...(task.params?.classLimits || {}) }
  let running = 0

  sorted.forEach((position) => {
    shares[position.id] = (values[position.id] / total) * 100
    running += shares[position.id]
    cumulative[position.id] = running
    classes[position.id] = running <= limits.A ? 'A' : running <= limits.B ? 'B' : 'C'
  })

  return { values, total, order: sorted.map(({ id }) => id), shares, cumulative, classes, ...(task.expectedResults || {}) }
}

export function calculateBomReference(task) {
  const data = task.givenData || {}
  const edges = Array.isArray(data.edges) ? data.edges : []
  const root = data.endProduct
  if (!root || !edges.length) throw new Error('Die Stücklistenstruktur ist unvollständig.')

  const children = new Map()
  edges.forEach((edge) => {
    const quantity = Number(edge.qtyPerParent)
    if (!edge.parent || !edge.child || !Number.isFinite(quantity) || quantity < 0) {
      throw new Error('Die Stückliste enthält eine ungültige Kante.')
    }
    if (!children.has(edge.parent)) children.set(edge.parent, [])
    children.get(edge.parent).push({ child: edge.child, quantity })
  })

  const totals = {}
  const walk = (node, multiplier, path) => {
    if (path.has(node)) throw new Error(`Zyklus in der Stückliste bei „${node}“ erkannt.`)
    const nextPath = new Set(path).add(node)
    const nodeChildren = children.get(node) || []
    nodeChildren.forEach(({ child, quantity }) => {
      const contribution = multiplier * quantity
      totals[child] = (totals[child] || 0) + contribution
      walk(child, contribution, nextPath)
    })
  }
  walk(root, 1, new Set())

  const leaves = data.leafParts?.length
    ? data.leafParts
    : [...new Set(edges.map(({ child }) => child))].filter((node) => !children.has(node))
  const assemblies = data.assemblies || [...children.keys()].filter((node) => node !== root)
  const perProduct = Object.fromEntries(leaves.map((part) => [part, totals[part] || 0]))
  const yearly = Object.fromEntries(leaves.map((part) => [
    part,
    perProduct[part] * Number(data.endProductQuantity || 0),
  ]))
  const assemblyQuantities = Object.fromEntries(assemblies.map((part) => [part, totals[part] || 0]))
  return { leaves, assemblies, assemblyQuantities, perProduct, yearly, ...(task.expectedResults || {}) }
}

function roundHalfUp(value) {
  return Math.floor(value + 0.5)
}

export function calculateMonthlyReference(task) {
  const data = task.givenData || {}
  const yearlyDemand = Number(data.yearlyDemand)
  const specialMonths = data.specialMonths || []
  const specialFactor = Number(data.specialFactor ?? 2)
  if (!Number.isFinite(yearlyDemand) || specialMonths.length !== 1 || specialFactor !== 2) {
    throw new Error('0.5.0 unterstützt genau einen Monat mit doppeltem Bedarf.')
  }
  const divisor = 12 + specialMonths.length
  const normal = roundHalfUp(yearlyDemand / divisor)
  const doubled = normal * specialFactor
  const adjusted = yearlyDemand - (12 - specialMonths.length) * normal
  return { yearlyDemand, specialMonth: specialMonths[0], divisor, normal, doubled, adjusted, ...(task.expectedResults || {}) }
}

function evaluateAbc(task, step, answers) {
  const reference = calculateAbcReference(task)
  const tolerance = { ...DEFAULT_TOLERANCE, ...(task.tolerance || {}) }
  const ids = Object.keys(reference.values)
  if (step === 1) {
    const checks = ids.map((id) => nearlyEqual(parseNumber(answers[`value.${id}`]), reference.values[id], tolerance.currencyAbsolute, tolerance.relative))
    checks.push(nearlyEqual(parseNumber(answers.total), reference.total, tolerance.currencyAbsolute * ids.length, tolerance.relative))
    const correct = checks.filter(Boolean).length
    const status = statusFor(correct, checks.length)
    return result(status, status === 'green' ? 'Verbrauchswerte und Gesamtwert stimmen.' : 'Prüfe Menge × Stückwert und addiere anschließend alle Positionen.', { ...reference.values, total: reference.total })
  }
  if (step === 2) {
    const orderCorrect = reference.order.every((id, index) => answers[`rank.${index}`] === id)
    const valueChecks = reference.order.flatMap((id) => [
      nearlyEqual(parseNumber(answers[`share.${id}`]), reference.shares[id], tolerance.percentagePoints, 0),
      nearlyEqual(parseNumber(answers[`cumulative.${id}`]), reference.cumulative[id], tolerance.percentagePoints, 0),
    ])
    const correct = valueChecks.filter(Boolean).length + (orderCorrect ? 1 : 0)
    const total = valueChecks.length + 1
    const status = statusFor(correct, total, total - 2)
    return result(status, status === 'green' ? 'Sortierung, Anteile und kumulierte Werte stimmen.' : 'Sortiere absteigend nach Verbrauchswert und kumuliere die Wertanteile.', reference)
  }
  const checks = ids.map((id) => String(answers[`class.${id}`] || '').toUpperCase() === reference.classes[id])
  const status = statusFor(checks.filter(Boolean).length, checks.length)
  return result(status, status === 'green' ? 'Alle Artikel sind korrekt klassifiziert.' : 'Ordne die Klassen anhand des kumulierten Wertanteils zu.', reference.classes)
}

function evaluateBom(task, step, answers) {
  const reference = calculateBomReference(task)
  const map = step === 1 ? reference.assemblyQuantities : step === 2 ? reference.perProduct : reference.yearly
  const checks = Object.entries(map).map(([key, value]) => parseNumber(answers[`${step === 1 ? 'assembly' : step === 2 ? 'part' : 'yearly'}.${key}`]) === value)
  const status = statusFor(checks.filter(Boolean).length, checks.length)
  const messages = ['Baugruppenbedarf je Endprodukt', 'Mengenstückliste je Endprodukt', 'Gesamtbedarf für die Endproduktmenge']
  return result(status, status === 'green' ? `${messages[step - 1]} stimmt.` : 'Verfolge jeden Pfad, multipliziere die Kantenmengen und addiere gleiche Teile.', map)
}

function evaluateMonthly(task, step, answers) {
  const reference = calculateMonthlyReference(task)
  if (step === 1) {
    const correct = String(answers.equation) === '11x + 2x = J'
    return result(correct ? 'green' : 'red', correct ? 'Die Gleichung zählt den Doppelmonat korrekt.' : 'Elf normale Monate plus ein Doppelmonat ergeben 13 Bedarfseinheiten.', { equation: '11x + 2x = J', divisor: reference.divisor })
  }
  if (step === 2) {
    const correct = parseNumber(answers.normal) === reference.normal
    return result(correct ? 'green' : 'red', correct ? 'Der normale Monatsbedarf ist korrekt gerundet.' : `Teile den Jahresbedarf durch ${reference.divisor} und runde kaufmännisch.`, { normal: reference.normal })
  }
  const special = parseNumber(answers.special)
  const sum = parseNumber(answers.sum)
  const specialCorrect = special === reference.doubled || special === reference.adjusted
  const sumCorrect = sum === reference.yearlyDemand
  const status = specialCorrect && sumCorrect ? 'green' : specialCorrect || sumCorrect ? 'yellow' : 'red'
  return result(status, status === 'green' ? 'Sondermonat und Kontrollsumme stimmen.' : 'Kontrolliere Doppelbedarf, Rundungsausgleich und Jahressumme.', { special: reference.adjusted, sum: reference.yearlyDemand })
}

// Unit-aware parsing is scoped to the new methods to preserve existing input rules.
function parseMethodNumber(value, unit) {
  const text = String(value ?? '').trim()
  const stripped = unit === 'currency'
    ? text.replace(/^(?:€|EUR)\s*/i, '').replace(/\s*(?:€|EUR)$/i, '')
    : text.replace(/\s*%$/, '')
  return parseNumber(stripped)
}

const normalizedChoice = value => String(value ?? '').trim().toLowerCase().replace(/[\s/-]+/g, '')

export function calculateXyzReference(task) {
  const xyz = {}
  const matrix = {}
  for (const article of task.givenData.articles) {
    xyz[article.id] = article.xyz
    matrix[article.id] = article.abc + article.xyz
  }
  return { xyz, matrix }
}

export function calculateSourcingReference(task) {
  const strategies = task.givenData.strategies.map(strategy => {
    const material = strategy.unitPrice * strategy.quantity
    const risk = strategy.riskPercent / 100 * task.givenData.downtimeCost
    return { id: strategy.id, material, risk, cost: material + strategy.coordination + risk }
  })
  const minimum = Math.min(...strategies.map(strategy => strategy.cost))
  return { strategies, cheapest: strategies.filter(strategy => nearlyEqual(strategy.cost, minimum, 1e-9, 0)).map(strategy => strategy.id) }
}

export function calculateVerticalReference(task) {
  const { own, external, purchases, revenue } = task.givenData
  return { exact: own / (own + external) * 100, approximate: (1 - purchases / revenue) * 100 }
}

function evaluateXyz(task, step, answers) {
  const reference = calculateXyzReference(task)
  const kind = step === 1 ? 'xyz' : 'matrix'
  const synonyms = { r: 'x', regelmäßig: 'x', gleichmäßig: 'x', s: 'y', saisonal: 'y', u: 'z', unregelmäßig: 'z' }
  const checks = Object.entries(reference[kind]).map(([id, expected]) => {
    const value = normalizedChoice(answers[`${kind}.${id}`])
    return (kind === 'xyz' ? synonyms[value] || value : value) === expected.toLowerCase()
  })
  const status = statusFor(checks.filter(Boolean).length, checks.length)
  return result(status, status === 'green' ? 'Alle Zuordnungen stimmen.' : step === 1
    ? 'X: gleichmäßig; Y: erkennbare Saison; Z: unregelmäßig. Entscheidend ist der Verbrauch, nicht der Wert.'
    : 'Schreibe zuerst die gegebene ABC-Klasse, dann die passende XYZ-Klasse.', reference[kind])
}

function evaluateSourcing(task, step, answers) {
  const reference = calculateSourcingReference(task)
  if (step <= 3) {
    const strategy = reference.strategies[step - 1]
    const correctValues = Object.fromEntries(['material', 'risk', 'cost'].map(key => [key, strategy[key]]))
    const checks = Object.entries(correctValues).map(([key, value]) => nearlyEqual(parseMethodNumber(answers[`${key}.${strategy.id}`], 'currency'), value, 0.01, 0))
    const status = statusFor(checks.filter(Boolean).length, checks.length)
    return result(status, status === 'green' ? 'Material-, Risiko- und Gesamtkosten stimmen.' : 'Material = Preis × Menge; Risiko = Prozent ÷ 100 × Stillstandskosten; Gesamtkosten enthalten zusätzlich die Koordination.', correctValues)
  }
  if (step === 4) {
    const choice = normalizedChoice(answers.cheapest).replace(/sourcing$/, '')
    const correct = reference.cheapest.includes(choice)
    return result(correct ? 'green' : 'red', correct ? 'Die günstigste Strategie wurde erkannt.' : 'Vergleiche die Gesamtkosten einschließlich Risiko und Koordination.', { cheapest: reference.cheapest.map(id => task.givenData.strategies.find(strategy => strategy.id === id).label) })
  }
  const correct = answers.reason === 'resilience'
  return result(correct ? 'green' : 'red', correct ? 'Kosten und qualitative Kriterien werden gemeinsam betrachtet.' : 'Ein niedriger Kostenwert garantiert weder Qualität noch Lieferfähigkeit.', { reason: 'Abhängigkeit, Qualität und Lieferfähigkeit zusätzlich beurteilen.' })
}

function evaluateVertical(task, step, answers) {
  if (step === 1) {
    const checks = ['exact', 'approximate'].map(key => answers[`formula.${key}`] === key)
    return result(statusFor(checks.filter(Boolean).length, 2), 'Fall A nutzt Eigen- und Fremdwert; Fall B erlaubt nur die Näherung aus Einkauf und Umsatz.', { formulaA: 'Exakt: Eigen ÷ (Eigen + Fremd)', formulaB: 'Näherung: 1 − Materialeinkauf ÷ Umsatz' })
  }
  if (step === 2) {
    const reference = calculateVerticalReference(task)
    const checks = Object.entries(reference).map(([key, value]) => nearlyEqual(parseMethodNumber(answers[`depth.${key}`], 'percent'), value, 0.1 + 1e-10, 0))
    const status = statusFor(checks.filter(Boolean).length, 2)
    return result(status, status === 'green' ? 'Beide Prozentwerte stimmen innerhalb ±0,1 Prozentpunkten.' : 'Berechne zunächst das Verhältnis und multipliziere für die Prozentangabe mit 100.', { depth: reference })
  }
  const correct = answers.interpretation === 'ownShare'
  return result(correct ? 'green' : 'red', correct ? 'Die Fertigungstiefe beschreibt den Eigenanteil.' : 'Hohe Fertigungstiefe bedeutet großen Eigenanteil, nicht automatisch hohen Gewinn.', { interpretation: 'Hoher Wert: großer Eigenanteil. Niedriger Wert: großer Fremdanteil.' })
}

function evaluateStepValues(engine, task, step, answers) {
  if (engine === 'xyzAbcMatrix') return evaluateXyz(task, step, answers)
  if (engine === 'sourcingCostComparison') return evaluateSourcing(task, step, answers)
  if (engine === 'verticalIntegration') return evaluateVertical(task, step, answers)
  if (engine === 'abcAnalysis') return evaluateAbc(task, step, answers)
  if (engine === 'billOfMaterials') return evaluateBom(task, step, answers)
  if (engine === 'monthlyDemandSplit') return evaluateMonthly(task, step, answers)
  throw new Error(`Unbekannte Methoden-Engine: ${engine}`)
}

export function getMethodReference(engine, task) {
  if (engine === 'xyzAbcMatrix') return calculateXyzReference(task)
  if (engine === 'sourcingCostComparison') return calculateSourcingReference(task)
  if (engine === 'verticalIntegration') return calculateVerticalReference(task)
  if (engine === 'abcAnalysis') return calculateAbcReference(task)
  if (engine === 'billOfMaterials') return calculateBomReference(task)
  if (engine === 'monthlyDemandSplit') return calculateMonthlyReference(task)
  throw new Error(`Unbekannte Methoden-Engine: ${engine}`)
}

function requiredAnswerKeys(engine, task, step) {
  const data = task.givenData
  if (engine === 'xyzAbcMatrix') return data.articles.map(({ id }) => `${step === 1 ? 'xyz' : 'matrix'}.${id}`)
  if (engine === 'sourcingCostComparison') return step <= 3
    ? ['material', 'risk', 'cost'].map(key => `${key}.${data.strategies[step - 1].id}`)
    : [step === 4 ? 'cheapest' : 'reason']
  if (engine === 'verticalIntegration') return step === 3 ? ['interpretation']
    : ['exact', 'approximate'].map(key => `${step === 1 ? 'formula' : 'depth'}.${key}`)
  if (engine === 'abcAnalysis') {
    const ids = data.positions.map(({ id }) => id)
    if (step === 1) return [...ids.map(id => `value.${id}`), 'total']
    if (step === 2) return [...ids.map((_, index) => `rank.${index}`), ...ids.flatMap(id => [`share.${id}`, `cumulative.${id}`])]
    return ids.map(id => `class.${id}`)
  }
  if (engine === 'billOfMaterials') {
    const reference = calculateBomReference(task)
    return (step === 1 ? reference.assemblies : reference.leaves).map(id => `${step === 1 ? 'assembly' : step === 2 ? 'part' : 'yearly'}.${id}`)
  }
  if (engine === 'monthlyDemandSplit') return step === 1 ? ['equation'] : step === 2 ? ['normal'] : ['special', 'sum']
  return []
}

export function evaluateMethodStep(engine, task, step, answers = {}) {
  const evaluation = evaluateStepValues(engine, task, step, answers)
  const missingFields = requiredAnswerKeys(engine, task, step)
    .filter(key => String(answers[key] ?? '').trim() === '')
  if (missingFields.length) {
    return { ...evaluation, status: 'red', missingFields,
      reason: 'Eingabe fehlt – bitte alle Felder dieses Schritts ausfüllen.' }
  }
  return evaluation
}
