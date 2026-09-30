import { classifyVariables, isInitialisingKind } from 'cellml-text-editor'
import { VALUE_REQUIRED_TYPES } from '../../utils/constants'

/**
 * Classifies a component's variables for the parameter table. The constant and global rows are
 * the constants. A boundary condition, which a port supplies, is `external`, so it can't
 * initialise a state (see reconcileRows for how rows get their types).
 *
 * @param {import('cellml-text-editor').ModelAnalysis|null} analysis
 * @param {Array} rows - Parameter rows.
 * @returns {Map<string, import('cellml-text-editor').VariableKind>|null} Kinds by name, or null without an analysis.
 */
export function classifyRows(analysis, rows) {
  if (!analysis) return null
  const constants = rows.filter((row) => VALUE_REQUIRED_TYPES.has(row.type)).map((row) => row.name)
  return classifyVariables(analysis, { constants })
}

/**
 * Whether a row can be a state's initial value: a constant or computed constant. Without kinds,
 * only constant rows can.
 *
 * @param {Object} row
 * @param {Map<string, string>|null} kinds - From classifyRows.
 * @returns {boolean}
 */
export function isInitialisable(row, kinds) {
  if (!kinds?.has(row.name)) return VALUE_REQUIRED_TYPES.has(row.type)
  return isInitialisingKind(kinds.get(row.name))
}
