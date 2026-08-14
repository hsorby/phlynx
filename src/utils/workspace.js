import { useVueFlow } from '@vue-flow/core'
import { nextTick } from 'vue'
import { useFlowHistoryStore } from '../stores/historyStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSimulationSettingsStore } from '../stores/simulationSettingsStore'
import { FLOW_IDS } from './constants'

// TODO - move to composables
export function useClearWorkspace() {
  const historyStore = useFlowHistoryStore()
  const libraryStore = useLibraryStore()
  const simulationSettingsStore = useSimulationSettingsStore()
  const { nodes, edges, setViewport } = useVueFlow(FLOW_IDS.MAIN)

  const clearWorkspace = async () => {
    historyStore.clear()
    libraryStore.clearGlobalConstants()
    simulationSettingsStore.resetStore()
    nodes.value = []
    edges.value = []
    setViewport({ x: 0, y: 0, zoom: 1 })

    await nextTick()
  }

  return { clearWorkspace }
}
