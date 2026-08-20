import { useVueFlow } from '@vue-flow/core'
import { nextTick } from 'vue'
import { useFlowHistoryStore } from '../stores/historyStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSimulationSettingsStore } from '../stores/simulationSettingsStore'
import { useInspectionModuleStore } from '../stores/inspectionModuleStore'
import { FLOW_IDS } from '../utils/constants'

export function useClearWorkspace(flowId = FLOW_IDS.MAIN) {
  const { nodes, edges, setViewport } = useVueFlow(flowId)

  const clearWorkspace = async () => {
    nodes.value = []
    edges.value = []
    setViewport({ x: 0, y: 0, zoom: 1 })

    await nextTick()
  }

  return { clearWorkspace }
}
