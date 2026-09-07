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

export function evaluateMethodStep(engine, task, step, answers) {
  if (engine === 'abcAnalysis') return evaluateAbc(task, step, answers)
  if (engine === 'billOfMaterials') return evaluateBom(task, step, answers)
  if (engine === 'monthlyDemandSplit') return evaluateMonthly(task, step, answers)
  throw new Error(`Unbekannte Methoden-Engine: ${engine}`)
}

export function getMethodReference(engine, task) {
  if (engine === 'abcAnalysis') return calculateAbcReference(task)
  if (engine === 'billOfMaterials') return calculateBomReference(task)
  if (engine === 'monthlyDemandSplit') return calculateMonthlyReference(task)
  throw new Error(`Unbekannte Methoden-Engine: ${engine}`)
}
