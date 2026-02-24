/**
 * useLoadFromCellML.js
 *
 * Composable that, given a CellML file's content, parses its inter-component
 * connections, registers synthesised configs into the builderStore, and loads
 * the resulting nodes + edges into the VueFlow workspace using the same layout
 * pipeline as useLoadFromVesselArray.
 */
import { useVueFlow } from '@vue-flow/core'
import { nextTick, ref } from 'vue'

import { useBuilderStore } from '../stores/builderStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import { runFcoseLayout } from '../services/layouts/cytoscape'
import { useClearWorkspace } from '../utils/workspace'
import { notify } from '../utils/notify'
import { useGtm } from './useGtm'
import { buildPortLabels } from '../services/import/buildPorts'
import { processCellMLData } from '../utils/cellml'
import { parseCellMLConnections } from '../services/import/parseCellmlConnections'
import { getHandleId } from '../utils/ports'
import { SOURCE_PORT_TYPE, TARGET_PORT_TYPE } from '../utils/constants'

export function useLoadFromCellML() {
  const { addNodes, addEdges, onNodesInitialized, fitView, updateNodeInternals } = useVueFlow()
  const store = useBuilderStore()
  const historyStore = useFlowHistoryStore()
  const { trackEvent } = useGtm()
  const { clearWorkspace } = useClearWorkspace()

  const layoutPending = ref(false)
  let pendingEdgeData = []    // raw { source, target } pairs from the parser
  let pendingFlowEdges = []   // finalised VueFlow edge objects, built after nodes initialise
  let layoutCompleteResolve = null
  let layoutCompleteReject = null

  /**
   * Main entry point.
   *
   * @param {string} cellmlContent - Raw CellML XML string
   * @param {string} filename      - The filename (e.g. 'tran_2009.cellml')
   */
  const loadFromCellML = async (cellmlContent, filename) => {
    try {
      await clearWorkspace()

      // --- Parse connections ---
      const { components, edges, configs } = parseCellMLConnections(cellmlContent, filename)

      if (components.length === 0) {
        notify.info({
          title: 'No Connections Found',
          message: `${filename} contains no inter-component connections to visualise.`,
        })
        return
      }

      // --- Register synthesised configs so port labels are available on each module ---
      console.log(configs)
      store.addConfigFile(configs, filename)

      // --- Parse variables and portOptions directly from the CellML content ---
      const cellmlResult = processCellMLData(cellmlContent)
      if (cellmlResult.type !== 'success') {
        throw new Error(`CellML parse error: ${cellmlResult.issues.map(i => i.description).join('; ')}`)
      }
      const componentDataByName = new Map(
        cellmlResult.components.data.map((c) => [c.componentName, c])
      )

      // Pre-compute per-component edge membership so each node gets exactly one
      // port handle per edge it participates in.
      // entrance (in) → left handle; exit (out) → right handle.
      const entranceEdgePeers = new Map()  // compName → Set of peer names (incoming)
      const exitEdgePeers = new Map()      // compName → Set of peer names (outgoing)
      for (const { source, target } of edges) {
        if (!exitEdgePeers.has(source)) exitEdgePeers.set(source, new Set())
        exitEdgePeers.get(source).add(target)
        if (!entranceEdgePeers.has(target)) entranceEdgePeers.set(target, new Set())
        entranceEdgePeers.get(target).add(source)
      }

      const nodes = components.map((compName) => {
        const compData = componentDataByName.get(compName) ?? {}
        const variables = compData.variables ?? []
        const portOptions = compData.portOptions ?? []

        // Match parameter values now that the store is populated
        store.setVariableParameterValuesForInstance(compName, variables, filename, compName, 0)

        // Retrieve the config we just registered (always index 0 for CellML-derived configs)
        const moduleConfig = store.getModuleConfigFromConfigIndex(filename, compName, 0) ?? {}
        const portLabels = buildPortLabels(moduleConfig)

        // One port handle per edge — named after the peer for tooltip clarity
        const ports = [
          ...[...(entranceEdgePeers.get(compName) ?? [])].map((peer) => ({
            uid: crypto.randomUUID(),
            type: TARGET_PORT_TYPE,
            side: 'left',
            name: peer,
          })),
          ...[...(exitEdgePeers.get(compName) ?? [])].map((peer) => ({
            uid: crypto.randomUUID(),
            type: SOURCE_PORT_TYPE,
            side: 'right',
            name: peer,
          })),
        ]

        return {
          id: compName,
          type: 'moduleNode',
          position: { x: 100, y: 100 },
          style: { opacity: 0 },
          data: {
            componentName: compName,
            configIndex: 0,
            label: `${compName} — ${filename}`,
            name: compName,
            portLabels,
            portOptions,
            ports,
            hasPrescribedPosition: false,
            sourceFile: filename,
            variables,
          },
        }
      })

      pendingEdgeData = edges

      const layoutCompletePromise = new Promise((resolve, reject) => {
        layoutCompleteResolve = resolve
        layoutCompleteReject = reject
      })

      layoutPending.value = true
      addNodes(nodes)

      await layoutCompletePromise

      trackEvent('cellml_connection_load', {
        category: 'CellML',
        action: 'load_from_cellml_connections',
        label: `Components: ${components.length}, Edges: ${edges.length}`,
        file_type: 'cellml',
      })
    } catch (error) {
      notify.error({ message: `Failed to load CellML connections: ${error.message}` })
      layoutPending.value = false
      pendingEdgeData = []
      layoutCompleteResolve = null
      layoutCompleteReject = null
      throw error
    }
  }

  onNodesInitialized(async (initializedNodes) => {
    if (!layoutPending.value || initializedNodes.length === 0) return

    const resolveFunc = layoutCompleteResolve
    const rejectFunc = layoutCompleteReject

    try {
      runFcoseLayout(initializedNodes, pendingEdgeData)
      await nextTick()
      updateNodeInternals(initializedNodes.map((n) => n.id))

      // Build finalised VueFlow edges now that port handles have been measured
      const nodeMap = new Map(initializedNodes.map((n) => [n.id, n]))

      pendingFlowEdges = pendingEdgeData.flatMap(({ source, target }) => {
        const sourceNode = nodeMap.get(source)
        const targetNode = nodeMap.get(target)
        if (!sourceNode || !targetNode) return []

        // Each port node is named after its peer, so we can match exactly —
        // the source node's exit port named after `target`, and the target
        // node's entrance port named after `source`.
        const sourcePort = sourceNode.data.ports.find(
          (p) => p.type === SOURCE_PORT_TYPE && p.name === target
        )
        const targetPort = targetNode.data.ports.find(
          (p) => p.type === TARGET_PORT_TYPE && p.name === source
        )

        if (!sourcePort || !targetPort) return []

        return [{
          id: `e_cellml_${source}_${target}_${crypto.randomUUID()}`,
          source,
          target,
          sourceHandle: getHandleId(sourcePort),
          targetHandle: getHandleId(targetPort),
        }]
      })

      addEdges(pendingFlowEdges)
      historyStore.clear()
      await nextTick()

      fitView({ padding: 0.2, duration: 800 })
      await new Promise((resolve) => setTimeout(resolve, 800))

      if (resolveFunc) resolveFunc()
    } catch (error) {
      historyStore.clear()
      notify.error({ message: 'Error organising CellML connection layout' })
      if (rejectFunc) rejectFunc(error)
    } finally {
      layoutPending.value = false
      pendingEdgeData = []
      pendingFlowEdges = []
      layoutCompleteResolve = null
      layoutCompleteReject = null
    }
  })

  return { loadFromCellML }
}