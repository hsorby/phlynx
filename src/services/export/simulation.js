/**
 * Builds the `simulation.json` companion file used inside a Web OpenCOR OMEX
 * archive (see "simulation.json" in the enterocyte.omex example) directly
 * from the payload SimSettingsDialog.vue emits on @confirm:
 *
 *   { simulationSettings, plotConfig: { groups, selections, ... }, parameterScan: { selections } }
 *
 * Shapes this reads (as produced by SimSettingsDialog.vue's handleConfirm):
 *   plotConfig.groups     -> [{ id, name }]
 *   plotConfig.selections -> [{ key, nodeId, nodeName, variableName, units, type, plot, groupId }]
 *   parameterScan.selections -> [{ key, nodeId, nodeName, parameterName, units, type, min, default, max }]
 *
 * @param {object} plotConfig - The `plotConfig` field of SimSettingsDialog's confirm payload.
 * @param {object} parameterScan - The `parameterScan` field of SimSettingsDialog's confirm payload.
 * @param {object} [options]
 * @param {{id: string, name: string}} [options.timeVariable] - Id/name for the
 *   plots' shared x-axis. SimSettingsDialog's payload doesn't know which
 *   node/variable represents simulation time, so this defaults to a plain
 *   { id: 'time', name: 'time' } placeholder — pass the model's actual
 *   node-qualified time variable (e.g. { id: 'time', name: 'environment/time' })
 *   if the caller has access to the node list and can resolve it.
 * @returns {object} The simulation.json object — JSON.stringify() before writing to the archive.
 */
export function buildSimulationJson(plotConfig, parameterScan, options = {}) {
  const selections = plotConfig?.selections || []
  const scanSelections = parameterScan?.selections || []
  const timeVariable = options.timeVariable || { id: 'time', name: 'time' }

  const input = buildInput(scanSelections)
  const data = buildOutputData(selections, timeVariable)
  const plots = buildOutputPlots(plotConfig, selections, timeVariable)
  const parameters = buildParameters(scanSelections)

  return {
    input,
    output: { data, plots },
    parameters,
  }
}

// input: one entry per parameter-scan selection. id/name are both just the
// constant's own name (per spec: "id and name can just be the variable name").
function buildInput(scanSelections) {
  return scanSelections.map((sel) => ({
    id: sel.parameterName,
    name: sel.parameterName,
    defaultValue: sel.default,
    minimumValue: sel.min,
    maximumValue: sel.max,
  }))
}

// output.data: one entry per plotted variable ("instance name/variable name"),
// plus the shared time axis — unless a plotted variable is already literally
// named "time", in which case that one is used instead of adding a duplicate.
function buildOutputData(selections, timeVariable) {
  const data = selections.map((sel) => ({
    id: sel.variableName,
    name: `${sel.nodeName}/${sel.variableName}`,
  }))

  const alreadyHasTime = selections.some(
    (sel) => sel.variableName?.toLowerCase() === timeVariable.id.toLowerCase()
  )
  if (!alreadyHasTime) {
    data.push({ id: timeVariable.id, name: timeVariable.name })
  }

  return data
}

// output.plots: one entry per subplot group. Built off the flat `selections`
// list (grouped by groupId here) rather than plotConfig.groupedSelections, so
// this stays correct even in the edge case where a variable's group was
// deleted and it ended up without one — those fall into a trailing
// "ungrouped" plot instead of silently being dropped.
function buildOutputPlots(plotConfig, selections, timeVariable) {
  const groupOrder = (plotConfig?.groups || []).map((group) => group.id)
  const UNGROUPED = '__ungrouped__'

  const byGroup = new Map()
  for (const sel of selections) {
    const groupKey = sel.groupId || UNGROUPED
    if (!byGroup.has(groupKey)) byGroup.set(groupKey, [])
    byGroup.get(groupKey).push(sel)
  }

  const orderedGroupKeys = [
    ...groupOrder.filter((id) => byGroup.has(id)),
    ...Array.from(byGroup.keys()).filter((key) => !groupOrder.includes(key)),
  ]

  return orderedGroupKeys
    .map((groupKey) => byGroup.get(groupKey))
    .filter((groupSelections) => groupSelections.length > 0)
    .map(([first, ...rest]) => ({
      xValue: timeVariable.id,
      yValue: first.variableName,
      additionalTraces: rest.map((sel) => ({
        xValue: timeVariable.id,
        yValue: sel.variableName,
      })),
      xAxisTitle: '',
      yAxisTitle: '',
    }))
}

// parameters: node-qualified constant name -> the id used for it in `input`
// above. Per spec this is simplified to just reuse the constant's own name
// (rather than inventing a separate short alias, as the example archive does).
function buildParameters(scanSelections) {
  return scanSelections.map((sel) => ({
    name: `${sel.nodeName}/${sel.parameterName}`,
    value: sel.parameterName,
  }))
}