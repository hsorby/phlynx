import { useFlowHistoryStore } from '../stores/historyStore'
import { useVueFlow } from '@vue-flow/core'
import { nextTick } from 'vue'
import { FLOW_IDS } from './constants'

export function useClearWorkspace() {
    const historyStore = useFlowHistoryStore()
    const {
        nodes,
        edges,
        setViewport,
    } = useVueFlow(FLOW_IDS.MAIN)

    const clearWorkspace = async () => {
        historyStore.clear()
        nodes.value = []
        edges.value = []
        setViewport({ x: 0, y: 0, zoom: 1 })

        await nextTick()
    }

    return { clearWorkspace }
}




