import { cleanName } from './identifiers'
import { TIME_NAMES, MATHML_NS, ACCESS, NO_ACCESS, VALUE_REQUIRED_TYPES } from './constants'

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
export const interfaceFromAccess = (access) => (access === ACCESS ? 'public' : 'private')

export const accessFromInterface = (cellmlInterface) =>
  cellmlInterface === 'public' || cellmlInterface === 'public_and_private' ? ACCESS : NO_ACCESS

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Guesses a row's type from its role in the math.
 *
 * @param {string} name
 * @param {{states: Set, assigned: Set, voi: Set}} roles
 * @returns {'variable'|'constant'} A variable the math itself computes - a state, the LHS of a
 *   top-level equation (this also covers an initialiser that's itself derived from other
 *   constants rather than a free-standing value the person supplies, e.g. one computed from
 *   several other constants), the variable of integration, or time - is 'variable'. Everything
 *   else defaults to 'constant'.
 *
 *   Being "some state's initialiser" is deliberately NOT part of this decision: an initialiser is
 *   only a role a variable plays, not a fact about how its value is produced, and a computed
 *   initialiser must still come out as 'variable' - see rowsFromAnalysis for how this interacts
 *   with a value already stored on the row from a previous pass.
 */
export function inferType(name, { states, assigned, voi }) {
  if (states.has(name) || assigned.has(name) || voi.has(name) || TIME_NAMES.has(name)) return 'variable'
  return 'constant'
}

// ── Values ───────────────────────────────────────────────────────────────────
const NUMERIC_LITERAL = /^-?[\d.]+([eE][+-]?\d+)?$/

export const isNumericLiteral = (value) => NUMERIC_LITERAL.test(String(value ?? '').trim())

const blankToUndefined = (value) => {
  const text = String(value ?? '').trim()
  return text === '' ? undefined : text
}

/**
 * Turns parameter-table rows into the declarations applyVariableDefinitions writes into the model.
 *
 * A state's initialiser is looked up by name via its `initialiser` field (see rowsFromAnalysis /
 * rowsFromDeclaredVariables) rather than being a distinctly-marked row - the same initialiser row
 * can therefore be pointed at by more than one state (a shared initial-value variable). Each
 * distinct initialiser is only ever declared once, however many states point at it. An
 * initialiser's own `initialValue` here is only ever its stored `.value` (blank if it doesn't
 * have one) - a computed initialiser (type 'variable') simply gets no initial_value attribute at
 * all, which is correct: its value comes from being assigned elsewhere in the math, same as any
 * other computed quantity.
 *
 * @param {Array} rows - Parameter table rows.
 * @returns {Array} One entry per row with usable units (rows without units are left unresolved).
 *   A state variable with an initialiser is declared with initialValue pointing at it; the
 *   initialiser itself is declared once, alongside the first state that references it.
 */
export function buildVariableDeclarations(rows) {
  const byName = new Map(rows.map((row) => [row.name, row]))

  // Names that are *some* state's initialiser are declared inline (below), never as their own
  // top-level entry - otherwise a shared initialiser would be emitted once per consuming state.
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
      interface: interfaceFromAccess(row.access),
      initialValue: initialiserRow
        ? initialiserRow.name
        : VALUE_REQUIRED_TYPES.has(row.type)
          ? blankToUndefined(row.value)
          : undefined,
    })

    if (initialiserRow && !alreadyEmitted.has(initialiserRow.name)) {
      alreadyEmitted.add(initialiserRow.name)
      declarations.push({
        name: initialiserRow.name,
        units: cleanName(initialiserRow.units) || units,
        interface: interfaceFromAccess(initialiserRow.access),
        initialValue: blankToUndefined(initialiserRow.value),
      })
    }
  }

  return declarations
}

/**
 * Reads which declared variable, if any, supplies each state's initial value
 * (e.g. `<variable initial_value="V_rest_approx" name="V" .../>` pairs state "V" with
 * initialiser "V_rest_approx"). A numeric initial value (or none at all) means no named
 * initialiser - the value lives on the state's own default initialiser row instead. Note that the
 * named initialiser itself may or may not have its own initial_value: `V_rest_approx` might be a
 * free-standing constant, or - like `c_init` in SN_soma - a variable computed by its own equation
 * elsewhere in the math. Either way it's still "the state's initialiser" for pairing purposes;
 * only its *type* differs (see inferType).
 *
 * @param {ModelAnalysis} analysis
 * @returns {Map<string,string>} state name -> initialiser name
 */
function findNamedInitialisers(analysis) {
  const declared = new Map(analysis.declared.map((v) => [v.name, v]))
  const initialiserOf = new Map() // state name -> initialiser name
  for (const state of analysis.stateVariables) {
    const initial = declared.get(state)?.initialValue
    if (initial && !isNumericLiteral(initial)) initialiserOf.set(state, initial)
  }
  return initialiserOf
}

/**
 * Carries forward any previously-known initialiser assignment that the current analysis pass
 * can't see.
 *
 * A variable that only ever appears as the named `initial_value` of a state (never referenced in
 * the math itself, e.g. `B_Ca_init` for `B_Cai`) has no other way back into the row list once
 * detected - `findNamedInitialisers` only finds what the live analysis can currently see, and a
 * round where that detection misses (a stale definitions payload, a mode switch mid-edit, Simple
 * Mode's generated text not yet round-tripped) would otherwise silently delete it. As long as the
 * state itself still exists, keep whatever initialiser it last pointed at.
 *
 * @param {Map<string,string>} initialiserOf - mutated in place: state name -> initialiser name
 * @param {Array} previousRows
 * @param {Set<string>} stateNames - state variables in the *current* analysis
 */
function carryForwardKnownInitialisers(initialiserOf, previousRows, stateNames) {
  for (const row of previousRows) {
    if (row.stateRole === 'state' && stateNames.has(row.name) && row.initialiser && !initialiserOf.has(row.name)) {
      initialiserOf.set(row.name, row.initialiser)
    }
  }
}

/**
 * A row's type, honouring what's structurally true about the math over whatever was stored from
 * a previous pass.
 *
 * Being computed by the math (a state, the LHS of a top-level equation, the variable of
 * integration, or time) is a *fact*, not a preference - it can't be talked out of being
 * 'variable'. Anything else is a free choice the person (or a previous pass) made, so a stored
 * type is respected, falling back to inferType's plain 'constant' default for a brand-new row.
 *
 * This also self-heals a row that was incorrectly persisted as 'constant' by an earlier version
 * of this logic (see inferType) - e.g. a computed initialiser like SN_soma's `c_init` - since the
 * structural check is re-run, and wins, on every pass rather than only for rows with no prior data.
 */
function resolveType(name, typeRoles, prior) {
  const structuralType = inferType(name, typeRoles)
  return structuralType === 'variable' ? 'variable' : (prior?.type ?? structuralType)
}

/**
 * Builds parameter-table rows from a Simple Mode model analysis.
 * 
 * @param {ModelAnalysis} analysis - cellml-text-editor's analyzeModel() output.
 * @param {Array} previousRows - Existing rows; anything already entered is kept.
 * @param {{assigned: string[], voi: string[]}} roles - analyzeMathRoles() output.
 * @returns {Array} One row per referenced variable plus any state-variable initialiser. State
 *   rows carry `stateRole: 'state'` and `initialiser: '<name>'` (the row supplying their initial
 *   value, once resolveStateInitialisers has run - see InstanceEditorDialog.vue); an initialiser
 *   row otherwise looks like any ordinary variable row, and the same one can be pointed at by more
 *   than one state.
 */
export function rowsFromAnalysis(analysis, previousRows = [], roles = {}) {
  const previous = new Map(previousRows.map((row) => [row.name, row]))
  const declared = new Map(analysis.declared.map((variable) => [variable.name, variable]))
  const stateNames = new Set(analysis.stateVariables)

  const initialiserOf = findNamedInitialisers(analysis) // state name -> initialiser name
  carryForwardKnownInitialisers(initialiserOf, previousRows, stateNames)

  const names = new Set([...analysis.referenced, ...initialiserOf.values()])
  const typeRoles = {
    states: stateNames,
    assigned: new Set(roles.assigned ?? []),
    voi: new Set(roles.voi ?? []),
  }

  const rows = Array.from(names, (name) => {
    const prior = previous.get(name)
    const decl = declared.get(name)
    const seededValue = decl && isNumericLiteral(decl.initialValue) ? decl.initialValue.trim() : ''
    const isState = stateNames.has(name)

    return {
      name,
      units: prior?.units || decl?.units || '',
      access: prior?.access ?? (decl ? accessFromInterface(decl.interface) : ACCESS),
      value: prior?.value ?? seededValue,
      type: resolveType(name, typeRoles, prior),
      ...(isState ? { stateRole: 'state', initialiser: initialiserOf.get(name) } : {}),
    }
  })

  return rows
}

/**
 * Backfills a blank initialiser's units from its state, in place. Only fills a blank - never
 * overwrites units the person (or the model) already set, since a shared initialiser's units are
 * already guaranteed consistent across its consuming states by the unit-compatible picker (see
 * initialiserOptionsFor in InstanceEditorDialog.vue).
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

/**
 * Builds parameter-table rows for Advanced Mode, where the text declares the variables.
 * 
 * @param {Array} declared - extractVariablesFromMath() output: {name, units, value, type}, no
 *   access; skips t/time and public-interface variables. `type` here is already correctly
 *   'variable' for anything with no initial_value of its own (including a computed initialiser),
 *   from isPossibleParameter/extractVariablesFromMath.
 * @param {ModelAnalysis} analysis - analyzeModel() output for the same XML.
 * @param {Array} previousRows - Existing rows; anything already entered is kept.
 * @returns {Array} One row per declared variable, plus a row for t/time if the text has one, plus
 *   any known initialiser that isn't itself referenced in the math (see
 *   carryForwardKnownInitialisers). A variable initialised in the text (`{init: ...}`) carries
 *   `textInit`, that value as written: the table shows it read-only rather than as an editable
 *   value, since the text owns it. The row's own value is untouched, so switching to Simple Mode
 *   gives back an ordinary row; its type self-heals the same way as in rowsFromAnalysis (see
 *   resolveType) rather than blindly trusting whatever was stored before.
 */
export function rowsFromDeclaredVariables(declared, analysis, previousRows = []) {
  const previous = new Map(previousRows.map((row) => [row.name, row]))
  const stateNames = new Set(analysis.stateVariables)
  const initialiserOf = findNamedInitialisers(analysis) // state name -> initialiser name
  carryForwardKnownInitialisers(initialiserOf, previousRows, stateNames)

  const initialValues = new Map(analysis.declared.map((variable) => [variable.name, variable.initialValue]))
  const withTextInit = (name) => (initialValues.get(name) ? { textInit: initialValues.get(name) } : {})

  const rows = declared.map((variable) => {
    const prior = previous.get(variable.name)
    const isState = stateNames.has(variable.name)
    // extractVariablesFromMath already determined 'variable' vs 'constant' correctly from whether
    // the text gives this name its own initial_value - treat that the same way rowsFromAnalysis
    // treats inferType's result: a structural 'variable' always wins over a stale stored type.
    const structuralType = variable.type || 'constant'
    return {
      name: variable.name,
      units: variable.units,
      access: prior?.access ?? ACCESS,
      value: prior ? prior.value : variable.value || '',
      type: structuralType === 'variable' ? 'variable' : (prior ? prior.type : structuralType),
      ...(isState ? { stateRole: 'state', initialiser: initialiserOf.get(variable.name) } : {}),
      ...withTextInit(variable.name),
    }
  })

  const listed = new Set(rows.map((row) => row.name))
  for (const variable of analysis.declared) {
    if (!TIME_NAMES.has(variable.name) || listed.has(variable.name)) continue
    const prior = previous.get(variable.name)
    rows.push({
      name: variable.name,
      units: variable.units,
      access: prior?.access ?? accessFromInterface(variable.interface),
      value: prior?.value ?? '',
      type: prior?.type ?? 'variable',
      ...withTextInit(variable.name),
    })
    listed.add(variable.name)
  }

  // A known initialiser that's declared only via a state's initial_value - never referenced in
  // the math, and so absent from `declared` above - has to be resurrected explicitly from
  // previousRows, or it silently disappears here. It's an ordinary row now (no stateRole/pairing
  // fields of its own), so a plain copy is all that's needed.
  for (const initialiserName of new Set(initialiserOf.values())) {
    if (listed.has(initialiserName)) continue
    const prior = previous.get(initialiserName)
    if (!prior) continue // nothing to resurrect - shouldn't normally happen
    rows.push({ ...prior })
    listed.add(initialiserName)
  }

  return rows
}

// ── Math roles ─────────────────────────────────────────────────────────────
/** The <ci> names under `node`, excluding any inside a <bvar> (an integration variable, not an operand). */
function operandNames(node) {
  const insideBvar = (el) => {
    for (let parent = el.parentElement; parent && parent !== node; parent = parent.parentElement) {
      if (parent.localName === 'bvar') return true
    }
    return false
  }

  const cis = node.localName === 'ci' ? [node] : Array.from(node.getElementsByTagNameNS(MATHML_NS, 'ci'))
  return cis.filter((ci) => !insideBvar(ci)).map((ci) => ci.textContent?.trim() ?? '').filter(Boolean)
}

/**
 * Reads which variables the math assigns to and which is the variable of integration.
 * @param {string} xml
 * @returns {{assigned: string[], voi: string[]}} `assigned`: left-hand side of a top-level
 *   equation (state variables included; a comparison inside a piecewise condition doesn't count).
 *   `voi`: the <bvar> of a <diff>, usually t. Both empty if the XML can't be read.
 */
export function analyzeMathRoles(xml) {
  const roles = { assigned: [], voi: [] }
  if (typeof xml !== 'string' || !xml.trim()) return roles

  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return roles

  const assigned = new Set()
  const voi = new Set()

  for (const math of Array.from(doc.getElementsByTagNameNS(MATHML_NS, 'math'))) {
    for (const bvar of Array.from(math.getElementsByTagNameNS(MATHML_NS, 'bvar'))) {
      Array.from(bvar.getElementsByTagNameNS(MATHML_NS, 'ci')).forEach((ci) => {
        const name = ci.textContent?.trim()
        if (name) voi.add(name)
      })
    }

    for (const equation of Array.from(math.children)) {
      if (equation.localName !== 'apply' || equation.firstElementChild?.localName !== 'eq') continue
      const lhs = equation.children[1]
      if (lhs) operandNames(lhs).forEach((name) => assigned.add(name))
    }
  }

  return { assigned: Array.from(assigned), voi: Array.from(voi) }
}
