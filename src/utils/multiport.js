/**
 * Multiport types per port variable.
 *
 * A port's multiportType is 'None', 'True', 'Sum' or 'Multiply' for every variable, or a list with one
 * entry per variable ('True', 'sum' or 'multiply', any case), as in circulatory_autogen. Its
 * multiplyFactor is the factor of every Multiply variable, or a list aligned with its variables.
 *
 * - None: a plain link, on a port that takes one connection. A port never mixes None with the other
 *   types: beside them, None reads as True.
 * - True: a plain link shared with every connected module.
 * - Sum: the sum, over every connection, of the neighbour's paired variable.
 * - Multiply: reaches the neighbour's paired variable times its factor.
 *
 * Imports nothing, so config.js, cellml.js and boundaryValues.js can all use it.
 */
const TYPES = { none: 'None', true: 'True', sum: 'Sum', multiply: 'Multiply' }

const isPlain = (type) => type === 'None' || type === 'True'
const unmixed = (types) => (types.every((type) => type === 'None') ? types : types.map((type) => (type === 'None' ? 'True' : type)))

/** One multi_port value's type, ignoring case; undefined when unknown. */
function typeOf(value) {
  if (value === true) return 'True'
  if (value === false || value == null) return 'None'
  return typeof value === 'string' ? TYPES[value.toLowerCase()] : undefined
}

/**
 * A multi_port value as stored on a port: anything unknown is 'None', and a list is copied as written
 * unless its entries all agree, when it is that one value.
 */
export function parseMultiport(value) {
  if (!Array.isArray(value)) return typeOf(value) ?? 'None'
  const types = value.map(typeOf)
  return types[0] && types.every((type) => type === types[0]) ? types[0] : [...value]
}

/**
 * Each port variable's multiport type, a whole-port value applying to every variable.
 *
 * @throws {Error} when a list does not have one known entry per variable.
 */
export function variableTypes(port) {
  const variables = port.variables ?? []
  const value = port.multiportType
  if (!Array.isArray(value)) return variables.map(() => typeOf(value) ?? 'None')
  if (value.length !== variables.length) {
    throw new Error(`Port "${port.label}" has ${value.length} multiport entries for ${variables.length} variables.`)
  }
  return unmixed(
    value.map((entry, i) => {
      const type = typeOf(entry)
      if (!type) throw new Error(`Port "${port.label}" has an unknown multiport ${JSON.stringify(entry)} for "${variables[i]}".`)
      return type
    })
  )
}

/**
 * The factor scaling a port's i-th variable, 1 when unset.
 *
 * @throws {Error} when the factor is not a number.
 */
export function multiplyFactor(port, i) {
  const value = Array.isArray(port.multiplyFactor) ? port.multiplyFactor[i] : port.multiplyFactor
  const factor = value == null || value === '' ? 1 : Number(value)
  if (!Number.isFinite(factor)) {
    throw new Error(`Port "${port.label}" variable "${port.variables[i]}" needs a numeric multiply factor.`)
  }
  return factor
}

/**
 * Why a coupling's ports can't be exported, as readable messages; empty when they can. Variables pair by
 * position, and a pair can't be Sum on both sides, or Multiply on both sides.
 */
export function couplingConflicts(sourcePort, targetPort) {
  let sourceTypes, targetTypes
  try {
    sourceTypes = variableTypes(sourcePort)
    targetTypes = variableTypes(targetPort)
  } catch (error) {
    return [error.message]
  }
  if (sourceTypes.length !== targetTypes.length && ![...sourceTypes, ...targetTypes].every(isPlain)) {
    return [`Ports "${sourcePort.label}" and "${targetPort.label}" need the same number of variables to sum or multiply.`]
  }
  return sourceTypes.flatMap((type, i) =>
    type === targetTypes[i] && !isPlain(type)
      ? [`"${sourcePort.variables[i]}" and "${targetPort.variables[i]}" are both ${type} variables.`]
      : []
  )
}
