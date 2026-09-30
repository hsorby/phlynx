import { cleanName } from './identifiers'
import { TIME_NAMES, ACCESS, NO_ACCESS } from './constants'

export function isEditableVariableType(variableType) {
  return variableType !== 'variable' && variableType !== 'boundary_condition'
}

export function isEmpty(val) {
  return val === undefined || val === null || val === ''
}

export function extractGlobalConstants(parameterArray) {
  return parameterArray.filter((param) => param.type === 'global_constant')
}

// ── Access vs interface ──────────────────────────────────────────────────────
/** Every declared variable is public, so a parameter or port can reach it; access is a table setting only. */
export const VARIABLE_INTERFACE = 'public'

export const accessFromInterface = (cellmlInterface) =>
  cellmlInterface === 'public' || cellmlInterface === 'public_and_private' ? ACCESS : NO_ACCESS

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Infers a row's type from its role in the math. States, equation LHS names, the variable of
 * integration and time are computed ('variable'); being an initialiser doesn't count.
 *
 * @param {string} name
 * @param {{states: Set, assigned: Set, voi: Set}} roles
 * @returns {'variable'|'constant'}
 */
export function inferType(name, { states, assigned, voi }) {
  if (states.has(name) || assigned.has(name) || voi.has(name) || TIME_NAMES.has(name)) return 'variable'
  return 'constant'
}

// ── Values ───────────────────────────────────────────────────────────────────
const NUMERIC_LITERAL = /^-?[\d.]+([eE][+-]?\d+)?$/

export const isNumericLiteral = (value) => NUMERIC_LITERAL.test(String(value ?? '').trim())

/**
 * Checks whether a value is empty once trimmed.
 *
 * @param {*} value
 * @returns {boolean}
 */
export const isBlank = (value) => String(value ?? '').trim() === ''

/**
 * Builds the declarations Simple Mode writes into the model from the table rows. They carry no
 * values, only each state's link to its initialiser. A shared initialiser is declared once, and
 * rows without units are skipped.
 *
 * @param {Array} rows - Parameter-table rows.
 * @returns {Array<{name: string, units: string, interface: string, initialValue: (string|undefined)}>}
 */
export function buildVariableDeclarations(rows) {
  const byName = new Map(rows.map((row) => [row.name, row]))

  // Initialisers are declared alongside their first state, so a shared one appears once.
  const initialiserNames = new Set(
    rows.filter((row) => row.stateRole === 'state' && row.initialiser).map((row) => row.initialiser)
  )
  const alreadyEmitted = new Set()

  const declarations = []
  for (const row of rows) {
    if (initialiserNames.has(row.name) && row.stateRole !== 'state') continue

    const units = cleanName(row.units)
    if (!units) continue

    const initialiserRow = row.stateRole === 'state' && row.initialiser ? byName.get(row.initialiser) : null

    declarations.push({
      name: row.name,
      units,
      interface: VARIABLE_INTERFACE,
      // Only a state's link to its initialiser; values live in the parameter rows, not the math.
      initialValue: initialiserRow?.name,
    })

    if (initialiserRow && !alreadyEmitted.has(initialiserRow.name)) {
      alreadyEmitted.add(initialiserRow.name)
      declarations.push({
        name: initialiserRow.name,
        units: cleanName(initialiserRow.units) || units,
        interface: VARIABLE_INTERFACE,
      })
    }
  }

  return declarations
}

/**
 * Fills a blank initialiser's units from its state. Units already set are never overwritten.
 *
 * @param {Array} rows - Mutated in place.
 * @returns {Array} The same `rows`.
 */
export function syncInitialiserUnits(rows) {
  const byName = new Map(rows.map((row) => [row.name, row]))

  for (const row of rows) {
    if (row.stateRole !== 'state' || !row.initialiser) continue
    const initialiserRow = byName.get(row.initialiser)
    if (initialiserRow && !cleanName(initialiserRow.units)) initialiserRow.units = row.units
  }
  return rows
}
