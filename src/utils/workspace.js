import { useVueFlow } from '@vue-flow/core'
import { nextTick } from 'vue'
import { useFlowHistoryStore } from '../stores/historyStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useInspectionModuleStore } from '../stores/inspectionModuleStore'
import { FLOW_IDS } from './constants'

export function useClearWorkspace() {
    const historyStore = useFlowHistoryStore()
    const libraryStore = useLibraryStore()
    const inspectionModuleStore = useInspectionModuleStore()
    const {
        nodes,
        edges,
        setViewport,
    } = useVueFlow(FLOW_IDS.MAIN)

    const clearWorkspace = async () => {
        historyStore.clear()
        libraryStore.clearGlobalConstants()
        inspectionModuleStore.clearModules()
        nodes.value = []
        edges.value = []
        setViewport({ x: 0, y: 0, zoom: 1 })

        await nextTick()
    }

    return { clearWorkspace }
}
