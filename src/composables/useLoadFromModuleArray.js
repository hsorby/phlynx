import { useVueFlow } from '@vue-flow/core'
import { nextTick, ref } from 'vue'

import { useLibraryStore } from '../stores/libraryStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import { validateWorkflowModules } from '../services/import/validateWorkflow'
import { buildWorkflowGraph } from '../services/import/buildWorkflow'
import { runElkLayout } from '../services/layouts/elk'
import { runFcoseLayout } from '../services/layouts/cytoscape'
import { runPortGranularLayout } from '../services/layouts/dagre'
import { runRescaleLayout } from '../services/layouts/rescale'
import { notify } from '../utils/notify'
import { useGtm } from './useGtm'
import { useClearWorkspace } from '../utils/workspace' 

export function useLoadFromModuleArray() {
  const { nodes, edges, addNodes, addEdges, setViewport, onNodesInitialized, fitView, updateNodeInternals } =
    useVueFlow()
  const store = useLibraryStore()
  const historyStore = useFlowHistoryStore()
  const { trackEvent } = useGtm()
  const { clearWorkspace } = useClearWorkspace()
  
  const layoutPending = ref(false)
  let pendingEdges = []
  let pendingNodeDataMap = new Map()
  let pendingProgressCallback = null
  let layoutCompleteResolve = null
  let layoutCompleteReject = null

  const loadFromModuleArray = async (configData, progressCallback = null) => {
    try {
      await clearWorkspace()

      pendingProgressCallback = progressCallback

      if (progressCallback) {
        progressCallback(0, configData.modules.length, 'Building graph...')
      }

      const result = buildWorkflowGraph(store, configData.modules, progressCallback)

      pendingEdges = result.edges
      pendingNodeDataMap.clear()
      result.nodes.forEach((n) => {
        store.setParameterValuesForInstance(
          n.data.name,
          n.data.variables,
          n.data.sourceFile,
          n.data.componentName,
          n.data.configIndex
        )
        pendingNodeDataMap.set(n.id, n.data)
      })

      if (progressCallback) {
        progressCallback(configData.modules.length, configData.modules.length, 'Graph built, calculating layout...')
      }

      // Create a promise that will resolve when layout is complete
      const layoutCompletePromise = new Promise((resolve, reject) => {
        layoutCompleteResolve = resolve
        layoutCompleteReject = reject
      })

      layoutPending.value = true
      addNodes(result.nodes) // Adds invisible nodes

      // Wait for the layout to complete before returning
      await layoutCompletePromise

      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_from_module_array',
        label: `Modules: ${configData.modules.length}`,
        file_type: 'module_array',
      })
    } catch (error) {
      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_from_module_array',
        label: `Error: ${error.message}`,
        file_type: 'module_array',
      })
      notify.error({ message: `Failed to load workflow: ${error.message}` })
      layoutPending.value = false
      pendingProgressCallback = null
      layoutCompleteResolve = null
      layoutCompleteReject = null
      throw error
    }
  }

  onNodesInitialized(async (initializedNodes) => {
    if (!layoutPending.value || initializedNodes.length === 0) return

    const callback = pendingProgressCallback
    const resolveFunc = layoutCompleteResolve
    const rejectFunc = layoutCompleteReject

    try {
      // If position is not declared in module array file,
      // Run Layout (Calculates positions & sorts port arrays).
      // Could make this choice configurable later.
      if (callback) {
        callback(initializedNodes.length, initializedNodes.length, 'Organizing layout...')
      }

      // Run layout algorithm
      if (initializedNodes[0].data.hasPrescribedPosition) {
        // recalculate declared positions to ensure compatibility with workspace dimensions
        runRescaleLayout(initializedNodes)
      } else {
        // runPortGranularLayout(initializedNodes, pendingEdges)
        // runElkLayout(initializedNodes, pendingEdges)
        runFcoseLayout(initializedNodes, pendingEdges)
      }

      await nextTick()

      // Handles may have moved from initial positions. Update node data from pending map.
      updateNodeInternals(initializedNodes.map((n) => n.id))

      if (callback) {
        callback(initializedNodes.length, initializedNodes.length, 'Connecting nodes...')
      }

      // Add the finalized edges
      addEdges(pendingEdges)

      historyStore.clear()
      await nextTick()

      // Report finalizing
      if (callback) {
        callback(initializedNodes.length, initializedNodes.length, 'Finalizing view...')
      }

      fitView({ padding: 0.2, duration: 800 })

      await new Promise((resolve) => setTimeout(resolve, 800))

      if (callback) {
        callback(initializedNodes.length, initializedNodes.length, 'Complete.')
      }

      if (resolveFunc) {
        resolveFunc()
      }
    } catch (error) {
      historyStore.clear()
      notify.error({ message: 'Error organizing graph layout' })
      if (rejectFunc) {
        rejectFunc(error)
      }
    } finally {
      layoutPending.value = false
      pendingEdges = []
      pendingProgressCallback = null
      layoutCompleteResolve = null
      layoutCompleteReject = null
    }
  })

  return { loadFromModuleArray }
}
