import { useVueFlow } from '@vue-flow/core'
import { nextTick, ref } from 'vue'

import { useLibraryStore } from '../stores/libraryStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import useDragAndDrop from './useDnD'
import { validateWorkflowModules } from '../services/import/validateWorkflow'
import { runElkLayout } from '../services/layouts/elk'
import { runFcoseLayout } from '../services/layouts/cytoscape'
import { runPortGranularLayout } from '../services/layouts/dagre'
import { runRescaleLayout } from '../services/layouts/rescale'
import { notify } from '../utils/notify'
import { useGtm } from './useGtm'
import { useClearWorkspace } from '../utils/workspace' 
import { resolvePortCouplings, checkAndClaimCouplings, buildUsedPortKeys } from '../utils/edges'
import { SOURCE_PORT_TYPE, TARGET_PORT_TYPE } from '../utils/constants'
import { buildWorkflowGraph } from '../services/import/buildWorkflow'
import { detachReactivity } from '../utils/reactivity'

export function useLoadFromInstanceArray() {
  const { nodes, edges, findNode, addNodes, addEdges, setViewport, onNodesInitialized, fitView, updateNodeInternals } =
    useVueFlow()
  const store = useLibraryStore()
  const historyStore = useFlowHistoryStore()
  const { trackEvent } = useGtm()
  const { clearWorkspace } = useClearWorkspace()
  
  const layoutPending = ref(false)
  const pendingHistoryNodes = new Set()
  let pendingEdges = []
  let pendingNodeDataMap = new Map()
  let pendingProgressCallback = null
  let layoutCompleteResolve = null
  let layoutCompleteReject = null

  const loadFromInstanceArray = async (instanceArray, progressCallback = null) => {
    try {
      await clearWorkspace()

      pendingProgressCallback = progressCallback

      if (progressCallback) {
        progressCallback(0, instanceArray.instances.length, 'Building graph...')
      }

      const result = buildWorkflowGraph(instanceArray.instances, store.availableModules, nodes.value, progressCallback)

      console.log(detachReactivity(result))
      pendingEdges = result.pendingEdges

      if (progressCallback) {
        progressCallback(instanceArray.instances.length, instanceArray.instances.length, 'Graph built, calculating layout...')
      }

      // Create a promise that will resolve when layout is complete
      const layoutCompletePromise = new Promise((resolve, reject) => {
        layoutCompleteResolve = resolve
        layoutCompleteReject = reject
      })

      layoutPending.value = true

      addNodes(result.pendingInstances)

      // Wait for the layout to complete before returning
      await layoutCompletePromise

      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_from_instance_array',
        label: `Modules: ${instanceArray.instances.length}`,
        file_type: 'instance_array',
      })
    } catch (error) {
      trackEvent('workflow_load_action', {
        category: 'Workflow',
        action: 'load_from_instance_array',
        label: `Error: ${error.message}`,
        file_type: 'instance_array',
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
      // Nodes are now mounted and measured (dimensions/handle bounds are
      // real), so it's safe to lay out and update handle internals.
      if (callback) {
        callback(initializedNodes.length, initializedNodes.length, 'Organizing layout...')
      }

      // Run layout algorithm
      if (initializedNodes[0].style?.opacity !== 0) {
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
      pendingPositionProvided = false
      layoutCompleteResolve = null
      layoutCompleteReject = null
    }
  })

  return { loadFromInstanceArray }
}
