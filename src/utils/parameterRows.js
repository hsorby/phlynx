/** Pure helpers for parameter-table rows, shared by the parameter table and the instance editor. */
import { VALUE_REQUIRED_TYPES } from './constants'
import { cleanName } from './identifiers'
import { isBlank } from './variables'

export function isValueMissing(row) {
  return !row.textInit && VALUE_REQUIRED_TYPES.has(row.type) && isBlank(row.value)
}

export function getUnknownUnitsNotice(row, unitNames) {
  const cleaned = cleanName(row.units)
  if (!cleaned || unitNames.has(cleaned)) return ''
  return `"${cleaned}" isn't defined in the units library`
}
