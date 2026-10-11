/**
 * Parameter sweeps: a model is solved once per value of one of its constants, or with ODEs, its time course run once
 * per value and read (see sweepReadouts.js), so its variables can be plotted against that constant, as an I–V curve is
 * against the membrane voltage. The sweep is kept in simulationSettingsStore.simulationSettings.sweep, `readout`
 * naming its reading; one saved without it reads the end.
 */
import { pickDefaultValue } from './parameterSliders'
import { DEFAULT_READOUT, READOUTS } from './sweepReadouts'
import { mappingKey } from './variableMapping'

// The row types a sweep can vary: what the parameter pane gives a value. A boundary condition's own value
// counts too, but only while nothing connected supplies one (see isSweepableRow).
const SWEEPABLE_TYPES = new Set(['constant', 'global_constant'])

export const DEFAULT_SWEEP_POINTS = 51
export const MAX_SWEEP_POINTS = 1000

/**
 * Checks whether a row can be swept: a constant, a global constant, or a boundary condition nothing else
 * supplies, whose own value the model then uses.
 *
 * @param {Object} row
 * @param {string} nodeId
 * @param {Set<string>} unsupplied - `nodeId::name` of the boundary conditions nothing supplies (see
 *   resolveBoundaryValues).
 * @returns {boolean}
 */
export function isSweepableRow(row, nodeId, unsupplied) {
  if (!row?.name) return false
  if (row.type === 'boundary_condition') return unsupplied.has(mappingKey(nodeId, row.name))
  return SWEEPABLE_TYPES.has(row.type)
}

/**
 * Checks whether a variable search entry can be swept, for the sweep's picker. Besides isSweepableRow, it
 * leaves out the parameter already swept and, once a run has mapped it, anything libOpenCOR doesn't report as
 * a constant: a computed constant, or a value a connection supplies in that run.
 *
 * @param {Object} entry - From buildVariableIndex, given the last run's mapping.
 * @param {Object} options
 * @param {Set<string>} options.unsupplied - See isSweepableRow.
 * @param {Map<string, {kind: string}>|null} [options.variables] - The last run's variables, with their kinds.
 * @param {Object|null} [options.sweep] - The current sweep.
 * @returns {boolean}
 */
export function isSweepableEntry(entry, { unsupplied, variables = null, sweep = null }) {
  if (!isSweepableRow({ name: entry.rowName, type: entry.kind }, entry.nodeId, unsupplied)) return false
  if (sweep && isSwept(entry, sweep)) return false
  const reported = entry.reportedName && variables?.get(entry.reportedName)
  return !reported || reported.kind === 'constant'
}

/**
 * Checks whether a search entry is the parameter a sweep varies. A global constant is one parameter, whichever
 * instance named it.
 *
 * @param {Object} entry
 * @param {Object} sweep
 * @returns {boolean}
 */
const isSwept = (entry, sweep) =>
  sweep.type === 'global_constant' ? entry.kind === 'global_constant' && entry.rowName === sweep.parameterName : entry.key === sweep.key

/**
 * Builds a sweep of a node's row, over half its value either side, or 0 to 1 when it has none.
 *
 * @param {Object} node
 * @param {Object} row
 * @param {Function} getGlobalConstant - libraryStore.getGlobalConstant.
 * @returns {{key: string, nodeId: string, nodeName: string, parameterName: string, units: string, type: string,
 *   from: number, to: number, points: number}}
 */
export function createSweep(node, row, getGlobalConstant) {
  const value = pickDefaultValue(row, getGlobalConstant)
  const spread = Math.abs(value ?? 0) * 0.5
  return {
    key: mappingKey(node.id, row.name),
    nodeId: node.id,
    nodeName: node.data.name,
    parameterName: row.name,
    units: row.units || '',
    type: row.type,
    from: spread ? value - spread : 0,
    to: spread ? value + spread : 1,
    points: DEFAULT_SWEEP_POINTS,
  }
}

/**
 * Gets the reading a sweep of a model with ODEs takes from each time course: its own, or the end, for a sweep saved
 * without one.
 *
 * @param {{readout?: string}} sweep
 * @returns {string} One of sweepReadouts' READOUTS.
 */
export const sweepReadout = (sweep) => (READOUTS.some(({ id }) => id === sweep?.readout) ? sweep.readout : DEFAULT_READOUT)

/**
 * Names a sweep's parameter as the variable search does.
 *
 * @param {Object} sweep
 * @returns {string}
 */
export const sweepLabel = (sweep) => `${sweep.nodeName}/${sweep.parameterName}`

/**
 * Says what stops a sweep from running, if anything.
 *
 * @param {Object|null} sweep
 * @returns {string|null}
 */
export function findSweepProblem(sweep) {
  if (!sweep?.parameterName) return 'Choose a parameter to sweep.'
  const { from, to, points } = sweep
  if (![from, to].every((value) => typeof value === 'number' && Number.isFinite(value))) return 'The sweep needs a value to start and end at.'
  if (from === to) return 'The sweep needs to end at a different value from the one it starts at.'
  if (!Number.isInteger(points) || points < 2 || points > MAX_SWEEP_POINTS) {
    return `The sweep needs from 2 to ${MAX_SWEEP_POINTS} points.`
  }
  return null
}

/**
 * Lists the values a sweep solves at: evenly spaced, from the lower end up, as a plot's x-axis needs.
 *
 * @param {{from: number, to: number, points: number}} sweep
 * @returns {number[]}
 */
export function sweepValues({ from, to, points }) {
  const low = Math.min(from, to)
  const high = Math.max(from, to)
  return Array.from({ length: points }, (_, i) => (i === points - 1 ? high : low + ((high - low) * i) / (points - 1)))
}

/**
 * Finds the variable libOpenCOR reports a sweep's parameter under, which a run can change.
 *
 * @param {Object} options
 * @param {Object} options.sweep
 * @param {Array<Object>} options.nodes - The scope's nodes.
 * @param {Map<string, string>} options.mapping - `nodeId::name` to the name libOpenCOR reports.
 * @param {Map<string, {kind: string}>} options.variables - The model's variables, with their kinds.
 * @returns {{component: string, variable: string}|{problem: string}}
 */
export function resolveSweepTarget({ sweep, nodes, mapping, variables }) {
  const label = sweepLabel(sweep)
  // A global constant is one variable however many instances use it, so any of them names it.
  const node =
    sweep.type === 'global_constant'
      ? nodes.find((candidate) => candidate.data?.variables?.some((row) => row.name === sweep.parameterName && row.type === 'global_constant'))
      : nodes.find((candidate) => candidate.id === sweep.nodeId)
  if (!node) return { problem: `${label} isn’t in the simulated instances, so it can’t be swept.` }

  const reported = mapping.get(mappingKey(node.id, sweep.parameterName))
  if (!reported) return { problem: `${label} isn’t in the model, so it can’t be swept.` }
  if (variables.get(reported)?.kind !== 'constant') {
    return { problem: `${label} is computed by the model, or supplied through a connection, so it can’t be swept. Sweep a parameter instead.` }
  }
  const separator = reported.indexOf('/')
  return { component: reported.slice(0, separator), variable: reported.slice(separator + 1) }
}
