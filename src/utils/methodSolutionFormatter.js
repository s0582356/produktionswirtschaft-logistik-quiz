const labels = {
  material: 'Materialkosten', risk: 'Risikokosten', cost: 'Gesamtkosten',
  cheapest: 'Günstigste Strategie', reason: 'Begründung', depth: 'Fertigungstiefe',
  exact: 'Fall A (exakt)', approximate: 'Fall B (Näherung)',
  formulaA: 'Formel Fall A', formulaB: 'Formel Fall B', interpretation: 'Interpretation',
  values: 'Verbrauchswerte', total: 'Gesamtverbrauchswert', order: 'Sortierung',
  shares: 'Anteile', cumulative: 'Kumuliert', classes: 'Klassen',
  equation: 'Gleichung', divisor: 'Bedarfseinheiten', normal: 'Normaler Monatsbedarf',
  special: 'Sondermonat', sum: 'Kontrollsumme Jahr', yearlyDemand: 'Jahresbedarf',
  specialMonth: 'Sondermonat', doubled: 'Doppelbedarf', adjusted: 'Sondermonat mit Rundungsausgleich',
  assemblyQuantities: 'Baugruppenbedarf', perProduct: 'Bedarf je Endprodukt',
  yearly: 'Gesamtbedarf', leaves: 'Einzelteile', assemblies: 'Baugruppen',
}

// Flatten structured results into display rows without changing evaluator data.
export function formatMethodSolution(values, engine, step) {
  const rows = []
  const defaultUnit = engine === 'abcAnalysis' && step === 1 ? '€'
    : engine === 'billOfMaterials' ? 'Stück' : ''
  const unitFor = (key, inherited) => {
    if (['shares', 'cumulative', 'depth'].includes(key)) return '%'
    if (['values', 'total', 'material', 'risk', 'cost'].includes(key)) return '€'
    if (['normal', 'special', 'sum', 'yearlyDemand', 'doubled', 'adjusted', 'assemblyQuantities', 'perProduct', 'yearly'].includes(key)) return 'Stück'
    if (['divisor', 'equation', 'classes', 'order', 'specialMonth', 'leaves', 'assemblies'].includes(key)) return ''
    return inherited
  }
  const scalar = (value, unit) => {
    if (value == null) return '–'
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return '–'
      const number = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: unit === '%' || unit === '€' ? 2 : 0,
        maximumFractionDigits: 2,
      }).format(value)
      return unit ? `${number} ${unit}` : number
    }
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nein'
    return String(value)
  }
  const visit = (value, path, unit, key = '') => {
    if (Array.isArray(value) && value.every(item => item === null || typeof item !== 'object')) {
      rows.push({ label: path || 'Werte', value: value.length ? value.map(item => scalar(item, unit)).join(key === 'order' ? ' → ' : ' · ') : '–' })
    } else if (value !== null && typeof value === 'object') {
      const entries = Object.entries(value)
      if (!entries.length) rows.push({ label: path || 'Werte', value: '–' })
      for (const [childKey, child] of entries) {
        const label = Array.isArray(value) ? `Eintrag ${Number(childKey) + 1}` : labels[childKey] || childKey
        visit(child, path ? `${path} · ${label}` : label, unitFor(childKey, unit), childKey)
      }
    } else {
      rows.push({ label: path || 'Wert', value: scalar(value, unit) })
    }
  }
  // ABC step 2 returns the full reference for evaluation. Only show this
  // step's fields; the remaining evaluators already return step-specific values.
  const visibleValues = engine === 'abcAnalysis' && step === 2 && values != null
    ? Object.fromEntries(['order', 'shares', 'cumulative']
      .filter(key => Object.hasOwn(values, key))
      .map(key => [key, values[key]]))
    : values
  if (visibleValues != null) visit(visibleValues, '', defaultUnit)
  return rows
}
