/**
 * Heuristic check for a PhLynx module configuration JSON object.
 */
export const isModuleConfig = (value) => {
  console.log('isModuleConfig', value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  if (!Array.isArray(value.modules) || value.modules.length === 0) {
    return false
  }

  const hasModelIdentity = typeof value.source === 'string' && typeof value.model === 'string'
  if (!hasModelIdentity) {
    return false
  }

  return value.modules.every(
    (module) =>
      module &&
      typeof module === 'object' &&
      typeof module.name === 'string' &&
      module.name.length > 0 &&
      typeof module.type === 'string' &&
      module.type.length > 0
  )
}

export const isModuleConfigFile = async (fileObject) => {
  if (!fileObject || typeof fileObject.async !== 'function') {
    return false
  }

  try {
    const fileText = await fileObject.async('string')
    const parsed = JSON.parse(fileText)
    return isModuleConfig(parsed)
  } catch {
    return false
  }
}
