import { useVueFlow } from '@vue-flow/core'
import { nextTick } from 'vue'
import { useFlowHistoryStore } from '../stores/historyStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSimulationSettingsStore } from '../stores/simulationSettingsStore'
import { useInspectionModuleStore } from '../stores/inspectionModuleStore'
import { FLOW_IDS } from '../utils/constants'

export function useClearWorkspace(flowId = FLOW_IDS.MAIN) {
  const { nodes, edges, setViewport, getViewport } = useVueFlow(flowId)

  const store = useLibraryStore()
  const history = useFlowHistoryStore()
  const inspectionStore = useInspectionModuleStore()
  const simStore = useSimulationSettingsStore()

  const clearWorkspace = async () => {

    const oldNodes = nodes.value
    const oldEdges = edges.value
    const oldInspectStore = inspectionStore.getState()
    const oldSimStore = simStore.getState()
    const oldGlobalConstants = Array.from(store.globalVariables.entries())
    const oldViewport = getViewport()

    history.executeAndAddCommand({
      type: 'clear-workspace',
      undo: async () => {
        nodes.value = oldNodes
        edges.value = oldEdges
        if (flowId === FLOW_IDS.MAIN) {
          inspectionStore.loadState(oldInspectStore)
          simStore.loadState(oldSimStore)
          for (const [name, data] of oldGlobalConstants) {
            store.assignGlobalConstant(
              name, 
              data.value, 
              data.units, 
              data.data_reference
            )
          }
          setViewport(oldViewport)
        }
      },
      redo: async () => {
        nodes.value = []
        edges.value = []
        if (flowId === FLOW_IDS.MAIN) {
          simStore.resetStore()
          store.clearGlobalConstants()
          inspectionStore.clearModules()
        }
        setViewport({ x: 0, y: 0, zoom: 1 })
      },
    })

    await nextTick()
  }

  return { clearWorkspace }
}
