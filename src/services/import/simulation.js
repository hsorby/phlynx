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

export function extractInputSelections(input = []) {
  return (Array.isArray(input) ? input : []).map((entry, index) => {
    const scoped = parseScopedValue(entry?.id, 'id')
    const fallbackName = typeof entry?.name === 'string' ? entry.name : `scan_${index}`
    const nodeName = scoped?.nodeName || fallbackName
    const parameterName = scoped?.valueName || fallbackName

    return {
      key: `${nodeName}__${parameterName}`,
      nodeId: nodeName,
      nodeName,
      parameterName,
      units: '',
      type: 'parameter',
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
      const nodeName = scoped?.nodeName || nameMatch?.nodeName
      const variableName = scoped?.valueName || nameMatch?.valueName

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

export function extractSimData(jsonData, filename, options = {}) {
  if (!jsonData) {
    return null
  }

  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData

  return {
    input: extractInputSelections(data?.input),
    plots: extractPlotSelections(data?.output?.plots, options?.groups || []),
    parameters: data?.parameters || [],
    raw: data,
    filename,
  }
}
