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
import { getHandleId } from '../utils/handles'
import { buildHandles } from '../services/import/buildPorts'

export function useLoadFromModuleArray() {
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
  let pendingPositionProvided = false
  let layoutCompleteResolve = null
  let layoutCompleteReject = null

  const { createInstanceNode } = useDragAndDrop(pendingHistoryNodes)

  function buildNodes(libraryStore, instances, progressCallback = null) {
    const posProvided = []
    instances.forEach((instance, index) => {
      if (progressCallback) {
        progressCallback(index, instances.length, instance.name)
      }

      const module = libraryStore.availableModules.get(`${instance.module_type}:${instance.module_subtype}`)

      if (!module) {
        console.warn(
          `No config found for module "${instance.name}" ` +
            `(module_type: ${instance.module_type}, module_subtype: ${instance.module_subtype})`
        )
      }

      const hasPosition = instance.x !== undefined && instance.y !== undefined
      if (progressCallback && index === instances.length) {
        progressCallback(instances.length, instances.length, 'Building connections...')
      }

      const position = hasPosition
        ? { x: instance.x, y: -instance.y } 
        : { x: 100, y: 100 } 

      posProvided.push(hasPosition)

      const handles = buildHandles(instance)
      createInstanceNode(module, position, handles)
    })
    return posProvided.every(Boolean)
  }

  function buildEdges(instances) {
    const pendingEdges = []
    const nodeMap = new Map(nodes.value.map((n) => [n.data.name, n]))

    // Taken non-multiport ports
    const usedPortKeys = new Set()
  
    // For each target node, track how many times it has been connected to as a
    // target so far — this is its inp_modules ordinal index for the next edge.
    const targetInboundCount = new Map()

    instances.forEach((instance) => {
      if (!instance.out_instances) return
  
      const sourceNode = nodeMap.get(instance.name)
      if (!sourceNode || sourceNode.data.error) return
  
      const targets = instance.out_instances.split(' ').filter((t) => t.trim())
      targets.forEach((targetName, sourceIndex) => { 
        const targetNode = nodeMap.get(targetName)
        if (!targetNode || targetNode.data.error) return
  
        const sourceHandle = sourceNode.data.handles.find(
          (p) => p.type === SOURCE_PORT_TYPE && p.name === targetName
        )

        const targetHandle = targetNode.data.handles.find(
          (p) => p.type === TARGET_PORT_TYPE && p.name === instance.name
        )

        if (!sourceHandle || !targetHandle) {
          console.warn(
            `[buildEdges] Could not find matching handles between "${instance.name}" and "${targetName}" — skipping.`
          )
          return
        }

        // how many times this target node has already been connected
        // to as a target. 

        const targetIndex = targetInboundCount.get(targetName) ?? 0

        // Resolve the specific port couplings for this conduit edge, taking
        // ordinal position into account for repeated same-label slots.
        const couplings = resolvePortCouplings(
          sourceNode.data.ports ?? [],
          targetNode.data.ports ?? [],
          sourceIndex,
          targetIndex,
        )

        if (couplings.length === 0) {
          console.warn(
            `[buildEdges] No compatible port label matches between "${instance.name}" and "${targetName}" — conduit edge skipped.`
          )
          return
        }
  
        // Enforce the non-multiport single-connection constraint.
        // All-or-nothing: if any coupling violates it, the whole conduit is rejected.
        const { valid, conflicts } = checkAndClaimCouplings(
          instance.name,
          targetName,
          couplings,
          usedPortKeys
        )
  
        if (!valid) {
          console.warn(
            `[buildEdges] Conduit "${instance.name}" -> "${targetName}" rejected:\n` +
              conflicts.map((c) => `  • ${c}`).join('\n')
          )
          return
        }
  
        // Increment the target's inbound count only after a successful edge
        targetInboundCount.set(targetName, targetIndex + 1)
  
        addEdges({
          id: `${sourceNode.id}--${targetNode.id}`,
          source: sourceNode.id,
          target: targetNode.id,
          sourceHandle: getHandleId(sourceHandle),
          targetHandle: getHandleId(targetHandle),
          data: {
            couplings,
          },
        })
      })
    })
  }
  
  function buildWorkflowGraph(libraryStore, instances, progressCallback = null) {
    const positionProvided = buildNodes(libraryStore, instances, progressCallback)
    buildEdges(instances)
    return positionProvided
  }

  const loadFromModuleArray = async (configData, progressCallback = null) => {
    try {
      await clearWorkspace()

      pendingProgressCallback = progressCallback

      if (progressCallback) {
        progressCallback(0, configData.modules.length, 'Building graph...')
      }

      pendingPositionProvided = buildWorkflowGraph(store, configData.modules, progressCallback)

      if (progressCallback) {
        progressCallback(configData.modules.length, configData.modules.length, 'Graph built, calculating layout...')
      }

      // Create a promise that will resolve when layout is complete
      const layoutCompletePromise = new Promise((resolve, reject) => {
        layoutCompleteResolve = resolve
        layoutCompleteReject = reject
      })

      layoutPending.value = true

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
      // Nodes are now mounted and measured (dimensions/handle bounds are
      // real), so it's safe to lay out and update handle internals.
      if (callback) {
        callback(initializedNodes.length, initializedNodes.length, 'Organizing layout...')
      }

          // Run layout algorithm
      if (pendingPositionProvided) {
        // recalculate declared positions to ensure compatibility with workspace dimensions
        runRescaleLayout(nodes.value)
      } else {
        // runPortGranularLayout(initializedNodes, pendingEdges)
        // runElkLayout(initializedNodes, pendingEdges)
        runFcoseLayout(nodes.value, edges.value)
      }

      await nextTick()

      // Handles may have moved from initial positions. Update node data from pending map.
      updateNodeInternals(nodes.value.map((n) => n.id))

      if (callback) {
        callback(nodes.value.length, nodes.value.length, 'Connecting nodes...')
      }

      historyStore.clear()
      await nextTick()

      // Report finalizing
      if (callback) {
        callback(nodes.value.length, nodes.value.length, 'Finalizing view...')
      }

      fitView({ padding: 0.2, duration: 800 })  

      if (callback) {
        callback(nodes.value.length, nodes.value.length, 'Complete.')
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

  return { loadFromModuleArray }
}
