import { getMethodReference, evaluateMethodStep, ASSIGNMENT_ENGINES } from './methodTrainerEvaluator.js'
import { formatMethodSolution } from './methodSolutionFormatter.js'

const n = value => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value)

// Derive presentation from the same task data as the unchanged evaluators.
export function solutionDerivation(method, task, step) {
  const d = task.givenData
  const r = getMethodReference(method.engine, task)
  let calculations = []
  switch (method.engine) {
    case 'abcAnalysis':
      calculations = step === 1
        ? [...d.positions.map(p => `${p.id}: ${n(p.quantity)} × ${n(p.unitValue)} € = ${n(r.values[p.id])} €`), `Gesamt: ${Object.values(r.values).map(n).join(' + ')} = ${n(r.total)} €`]
        : step === 2 ? r.order.map((id, index) => `${id}: ${n(r.values[id])} ÷ ${n(r.total)} × 100 = ${n(r.shares[id])} %; kumuliert ${r.order.slice(0, index + 1).map(key => n(r.shares[key])).join(' + ')} ≈ ${n(r.cumulative[id])} % (mit ungerundeten Anteilen rechnen).`)
          : r.order.map(id => `${id}: ${n(r.cumulative[id])} % kumuliert → ${r.classes[id]} (A bis ${task.params?.classLimits?.A ?? 80} %, B bis ${task.params?.classLimits?.B ?? 95} %, sonst C).`)
      break
    case 'billOfMaterials': {
      const paths = {}
      const walk = (parent, factors, nodes) => {
        for (const edge of d.edges.filter(e => e.parent === parent)) {
          const next = [...factors, edge.qtyPerParent]
          const route = [...nodes, edge.child]
          ;(paths[edge.child] ||= []).push(`${route.join(' → ')}: ${next.join(' × ')} = ${next.reduce((a, b) => a * b, 1)}`)
          walk(edge.child, next, route)
        }
      }
      walk(d.endProduct, [], [d.endProduct])
      const values = step === 1 ? r.assemblyQuantities : step === 2 ? r.perProduct : r.yearly
      calculations = Object.entries(values).map(([id, value]) => step === 3
        ? `${id}: ${r.perProduct[id]} × ${d.endProductQuantity} = ${n(value)} Stück für den Auftrag.`
        : `${id}: ${paths[id].join('; ')}. Beiträge aller Wege addieren → ${value} Stück je ${d.endProduct}.`)
      break
    }
    case 'monthlyDemandSplit':
      calculations = step === 1 ? [`11x + 2x = ${n(d.yearlyDemand)}; zusammen 13x = ${n(d.yearlyDemand)}.`]
        : step === 2 ? [`x = ${n(d.yearlyDemand)} ÷ 13 ≈ ${n(d.yearlyDemand / 13)} → kaufmännisch gerundet ${r.normal} Stück.`]
          : [`Doppelbedarf: 2 × ${r.normal} = ${r.doubled} Stück.`, `Mit Rundungsausgleich: ${n(d.yearlyDemand)} − 11 × ${r.normal} = ${r.adjusted} Stück.`, `Kontrolle: 11 × ${r.normal} + ${r.adjusted} = ${n(d.yearlyDemand)} Stück.`]
      break
    case 'xyzAbcMatrix':
      calculations = d.articles.map(a => step === 1 ? `${a.id}: ${a.pattern} → ${a.xyz}.` : `${a.id}: ${a.abc} (Wertklasse) + ${a.xyz} (Verbrauchsmuster) = ${r.matrix[a.id]}.`)
      break
    case 'sourcingCostComparison':
      if (step <= 3) {
        const s = d.strategies[step - 1], v = r.strategies[step - 1]
        calculations = [`Materialkosten = Menge × Preis = ${n(s.quantity)} × ${n(s.unitPrice)} € = ${n(v.material)} €.`, `Risikokosten = Ausfallkosten × Risiko ÷ 100 = ${n(d.downtimeCost)} € × ${n(s.riskPercent)} ÷ 100 = ${n(v.risk)} €.`, `Gesamtkosten = Material + Koordination + Risiko = ${n(v.material)} + ${n(s.coordination)} + ${n(v.risk)} = ${n(v.cost)} €.`]
      } else calculations = step === 4 ? [...r.strategies.map(s => `${d.strategies.find(x => x.id === s.id).label}: ${n(s.cost)} €.`), `Minimum: ${r.cheapest.map(id => d.strategies.find(s => s.id === id).label).join(', ')}.`] : ['Auch die günstigste Strategie kann Lieferprobleme verursachen. Deshalb Abhängigkeit, Qualität und Lieferfähigkeit zusätzlich beurteilen.']
      break
    case 'verticalIntegration':
      calculations = step === 1 ? [`Fall A: Eigen ${n(d.own)} € und Fremd ${n(d.external)} € bekannt → exakte Formel.`, `Fall B: Einkauf ${n(d.purchases)} € und Umsatz ${n(d.revenue)} € bekannt → Näherung.`]
        : step === 2 ? [`Fall A: ${n(d.own)} ÷ (${n(d.own)} + ${n(d.external)}) × 100 = ${n(r.exact)} %.`, `Fall B: (1 − ${n(d.purchases)} ÷ ${n(d.revenue)}) × 100 = ${n(r.approximate)} %.`]
          : [`Fall A: ${n(r.exact)} % Eigenanteil; Fall B: näherungsweise ${n(r.approximate)} % Eigenanteil. Der verbleibende Anteil ist fremdbezogen; Gewinn lässt sich daraus nicht ableiten.`]
  }
  if (ASSIGNMENT_ENGINES.includes(method.engine)) calculations = task.solutionDerivation[step - 1]
  if (method.engine === 'verticalIntegration' && task.comparison && step >= 2) {
    const after = task.comparison.own / (task.comparison.own + task.comparison.external) * 100
    calculations.push(`Fall A nach Outsourcing: ${n(task.comparison.own)} ÷ (${n(task.comparison.own)} + ${n(task.comparison.external)}) × 100 = ${n(after)} %. Vorher ${n(r.exact)} %, nachher ${n(after)} %: ${n(r.exact - after)} Prozentpunkte weniger Eigenanteil.`)
  }
  const micro = method.microSteps?.[step - 1]
  return [
    { label: 'Gesucht', value: method.steps[step - 1] },
    { label: 'Formel / Logik', value: micro?.logic || method.formula.join('; ') },
    ...calculations.map(value => ({ label: ASSIGNMENT_ENGINES.includes(method.engine) ? 'Herleitung / Modulmerkmal' : 'Rechenweg / eingesetzte Werte', value })),
    ...formatMethodSolution(evaluateMethodStep(method.engine, task, step, {}).correctValues, method.engine, step),
    { label: 'Bedeutung', value: micro?.why || method.explanation },
    ...(task.solutionContext ? [{ label: 'Diese Aufgabe', value: task.solutionContext }] : []),
    ...(task.taskPitfall ? [{ label: 'Falle dieser Aufgabe', value: task.taskPitfall }] : []),
    ...(micro ? [{ label: 'Typischer Fehler', value: micro.pitfall }] : []),
  ]
}
