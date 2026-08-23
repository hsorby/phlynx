
export const isSimulationJsonFile = async (fileObject) => {
  if (!fileObject || typeof fileObject.async !== 'function') {
    return false
  }

  try {
    const fileText = await fileObject.async('string')
    const parsed = JSON.parse(fileText)

    const hasLegacyShape =
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.input) &&
      Array.isArray(parsed.parameters) &&
      typeof parsed.output === 'object' &&
      Array.isArray(parsed.output.data) &&
      Array.isArray(parsed.output.plots)

    const hasArchiveSimulationShape =
      parsed &&
      typeof parsed === 'object' &&
      parsed.protocol_info &&
      typeof parsed.protocol_info === 'object' &&
      Array.isArray(parsed.data_items)

    return hasLegacyShape || hasArchiveSimulationShape
  } catch {
    return false
  }
}

export const isPhlynxFlowSnapshotFile = async (fileObject) => {
  if (!fileObject || typeof fileObject.async !== 'function') {
    return false
  }

  try {
    const fileText = await fileObject.async('string')
    const parsed = JSON.parse(fileText)
    return (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.nodes) &&
      Array.isArray(parsed.edges) &&
      typeof parsed.id === 'string' &&
      typeof parsed.version === 'string' &&
      parsed.id === 'phlynx-flow-snapshot' &&
      parsed.version.startsWith('1.0')
    )
  } catch {
    return false
  }
}
