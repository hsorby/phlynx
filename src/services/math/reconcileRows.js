/**
 * Builds parameter-table rows from a MathAnalysis, keeping whatever the previous rows already hold.
 * Pure (no Vue, no DOM), so it is safe in a worker.
 */
import { TIME_NAMES, ACCESS, NO_ACCESS } from '../../utils/constants'
import { accessFromInterface, inferType, isNumericLiteral, syncInitialiserUnits } from '../../utils/variables'

export const SIMPLE_MODE = 'simple'
export const ADVANCED_MODE = 'advanced'

/**
 * Maps the editor's Simple Mode flag to a reconcile mode.
 *
 * @param {boolean} isSimple - Whether Simple Mode is on.
 * @returns {'simple'|'advanced'}
 */
export const modeFor = (isSimple) => (isSimple ? SIMPLE_MODE : ADVANCED_MODE)

/**
 * Pairs each state with the variable supplying its initial value. Declarations win, and previous
 * rows fill in any pairing the declarations can't show.
 *
 * @param {import('./analyzeMath').MathAnalysis} analysis
 * @param {Array} previousRows
 * @param {Set<string>} stateNames
 * @returns {Map<string, string>} State name to initialiser name.
 */
function findInitialiserPairings(analysis, previousRows, stateNames) {
  const declaredByName = new Map(analysis.declared.map((variable) => [variable.name, variable]))
  const initialiserOf = new Map()

  for (const stateName of stateNames) {
    const initialValue = declaredByName.get(stateName)?.initialValue
    if (initialValue && !isNumericLiteral(initialValue)) initialiserOf.set(stateName, initialValue)
  }
  for (const row of previousRows) {
    if (row.stateRole === 'state' && stateNames.has(row.name) && row.initialiser && !initialiserOf.has(row.name)) {
      initialiserOf.set(row.name, row.initialiser)
    }
  }
  return initialiserOf
}

/**
 * Builds a Simple Mode row, where the table owns units, value, type and access.
 *
 * @param {string} name
 * @param {import('./analyzeMath').DeclaredVariable|undefined} declaration
 * @param {Object|undefined} previousRow
 * @param {{states: Set, assigned: Set, voi: Set}} roles
 * @returns {Object} A new row.
 */
function buildSimpleModeRow(name, declaration, previousRow, roles) {
  const seededValue = declaration && isNumericLiteral(declaration.initialValue) ? declaration.initialValue.trim() : ''
  const structuralType = inferType(name, roles)
  return {
    name,
    units: previousRow?.units || declaration?.units || '',
    access: previousRow?.access ?? (declaration ? accessFromInterface(declaration.interface) : ACCESS),
    value: previousRow?.value ?? seededValue,
    // Being computed by the math is a fact; otherwise the stored type is the person's choice.
    type: structuralType === 'variable' ? 'variable' : (previousRow?.type ?? structuralType),
  }
}

/**
 * Builds an Advanced Mode row, where the text owns units and initial values.
 *
 * @param {string} name
 * @param {import('./analyzeMath').DeclaredVariable} declaration
 * @param {Object|undefined} previousRow
 * @returns {Object} A new row, with `textInit` when the text sets an initial value.
 */
function buildAdvancedModeRow(name, declaration, previousRow) {
  const hasInitialValue = !!declaration.initialValue
  const defaultAccess = TIME_NAMES.has(name) ? accessFromInterface(declaration.interface) : ACCESS
  return {
    name,
    units: declaration.units,
    access: previousRow?.access ?? defaultAccess,
    value: previousRow ? previousRow.value : declaration.initialValue || '',
    type: hasInitialValue ? (previousRow?.type ?? 'constant') : 'variable',
    ...(hasInitialValue ? { textInit: declaration.initialValue } : {}),
  }
}

/**
 * Marks each current state and points it at a real initialiser row, creating `<state>_init` only
 * when nothing supplies one. Existing pairings, including shared ones, are left alone.
 *
 * @param {Array} rows - Mutated in place.
 * @param {string[]} stateNames - States in the current math.
 * @returns {Array} The same `rows`.
 */
function resolveStateInitialisers(rows, stateNames) {
  const currentStateNames = new Set(stateNames)
  const rowsByName = new Map(rows.map((row) => [row.name, row]))

  for (const row of rows) {
    if (row.stateRole === 'state' && !currentStateNames.has(row.name)) {
      delete row.stateRole
      delete row.initialiser
    }
  }

  for (const stateName of currentStateNames) {
    const stateRow = rowsByName.get(stateName)
    if (!stateRow) continue

    stateRow.stateRole = 'state'
    stateRow.type = 'variable'
    if (stateRow.initialiser && rowsByName.has(stateRow.initialiser)) continue

    const defaultName = `${stateName}_init`
    let initialiserRow = rowsByName.get(defaultName)
    if (!initialiserRow) {
      const seed = String(stateRow.value ?? '').trim()
      initialiserRow = {
        name: defaultName,
        value: isNumericLiteral(seed) ? seed : '',
        units: stateRow.units,
        type: 'constant',
        access: NO_ACCESS,
      }
      rows.push(initialiserRow)
      rowsByName.set(defaultName, initialiserRow)
    }
    stateRow.initialiser = defaultName
  }

  return rows
}

/**
 * Builds the parameter rows for an analysis, keeping every value already set in `previousRows`.
 * Used on instance creation, on every editor change, and when saved math is applied to siblings.
 *
 * @param {import('./analyzeMath').MathAnalysis|null} analysis - With null, `previousRows` is returned.
 * @param {Array} [previousRows=[]] - Existing rows; never mutated.
 * @param {Object} [options]
 * @param {'simple'|'advanced'} [options.mode='simple'] - Whether the table or the text owns declarations.
 * @returns {Array} New row objects.
 */
export function reconcileRows(analysis, previousRows = [], { mode = SIMPLE_MODE } = {}) {
  if (!analysis) return previousRows

  const previousByName = new Map(previousRows.map((row) => [row.name, row]))
  const declaredByName = new Map(analysis.declared.map((variable) => [variable.name, variable]))
  const stateNames = new Set(analysis.stateVariables)
  const initialiserOf = findInitialiserPairings(analysis, previousRows, stateNames)
  const roles = { states: stateNames, assigned: new Set(analysis.assigned), voi: new Set(analysis.voi) }

  const rows = []
  const listedNames = new Set()
  // State roles are set by resolveStateInitialisers; here a state only records its pairing.
  const addRow = (row) => {
    if (listedNames.has(row.name)) return
    listedNames.add(row.name)
    if (stateNames.has(row.name)) row.initialiser = initialiserOf.get(row.name)
    rows.push(row)
  }

  if (mode === SIMPLE_MODE) {
    for (const name of new Set([...analysis.referenced, ...initialiserOf.values()])) {
      addRow(buildSimpleModeRow(name, declaredByName.get(name), previousByName.get(name), roles))
    }
  } else {
    for (const declaration of analysis.declared) {
      addRow(buildAdvancedModeRow(declaration.name, declaration, previousByName.get(declaration.name)))
    }
  }

  // Keep an initialiser known only from previous rows rather than silently dropping it.
  for (const name of new Set(initialiserOf.values())) {
    const previousRow = previousByName.get(name)
    if (!listedNames.has(name) && previousRow) addRow({ ...previousRow })
  }

  resolveStateInitialisers(rows, analysis.stateVariables)
  syncInitialiserUnits(rows)
  return rows
}
