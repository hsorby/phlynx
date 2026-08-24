function parseScopedValue(value, prefix) {
  if (!value || typeof value !== 'string') {
    return null
  }

  const segments = value.split('__')
  if (segments.length < 3 || segments[0] !== prefix) {
    return null
  }

  const remainder = segments.slice(1).join('__')
  const splitIndex = remainder.lastIndexOf('__')

  if (splitIndex === -1) {
    return null
  }

  return {
    nodeName: remainder.slice(0, splitIndex),
    valueName: remainder.slice(splitIndex + 2),
  }
}

function parseNameValue(value) {
  if (!value || typeof value !== 'string') {
    return null
  }

  const [nodeName, ...rest] = value.split('/')
  if (!nodeName || rest.length === 0) {
    return null
  }

  return {
    nodeName,
    valueName: rest.join('/'),
  }
}

export function extractInputSelections(input = [], nodeNameToIdMap = new Map()) {
  return (Array.isArray(input) ? input : []).map((entry, index) => {
    const scoped = parseScopedValue(entry?.id, 'id')
    const fallbackName = typeof entry?.name === 'string' ? entry.name : `scan_${index + 1}`
    const nodeName = scoped?.nodeName || fallbackName
    const parameterName = scoped?.valueName || fallbackName

    return {
      key: `${nodeNameToIdMap.get(nodeName) || 'unknown_node'}::${parameterName}`,
      nodeId: nodeNameToIdMap.get(nodeName) || 'unknown_node',
      nodeName,
      parameterName,
      units: '',
      type: 'parameter',
      selected: true,
      min: Number(entry?.minimumValue ?? 0),
      default: Number(entry?.defaultValue ?? 0),
      max: Number(entry?.maximumValue ?? 0),
      step: entry?.stepValue ?? null,
    }
  })
}

export function extractPlotSelections(plots = [], groups = []) {
  const selections = []

  for (const [plotIndex, plot] of (Array.isArray(plots) ? plots : []).entries()) {
    const groupId = plot?.groupId || groups?.[plotIndex]?.id || `plot_${plotIndex + 1}`
    const traces = [plot, ...(Array.isArray(plot?.additionalTraces) ? plot.additionalTraces : [])]

    for (const trace of traces) {
      const scoped = parseScopedValue(trace?.yValue, 'data')
      const nameMatch = parseNameValue(trace?.name)
      const nodeName = nameMatch?.nodeName || scoped?.nodeName
      const variableName = nameMatch?.valueName || scoped?.valueName

      if (!nodeName || !variableName) {
        continue
      }

      selections.push({
        key: `${groupId}__${nodeName}__${variableName}`,
        nodeId: nodeName,
        nodeName,
        variableName,
        units: '',
        type: 'variable',
        plot: 'line',
        groupId,
      })
    }
  }

  return selections
}

export function rehydrateSimulationConfig(jsonData, options = {}) {
  const payload = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
  const groups = Array.isArray(options?.groups) ? options.groups : []
  const plotSelections = extractPlotSelections(payload?.output?.plots || [], groups)

  return {
    plotConfig: {
      groups: groups.map((group, index) => ({
        id: group?.id || `group_${index + 1}`,
        name: group?.name || `Group ${index + 1}`,
      })),
      selections: plotSelections,
    },
    parameterScanConfig: {
      selections: extractInputSelections(payload?.input || [], options?.nodeNameToIdMap),
    },
  }
}

export function extractSimData(jsonData, options = {}) {
  if (!jsonData) {
    return null
  }

  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
  return rehydrateSimulationConfig(data, options)
}
