/**
 * useLoadFromCellML.js
 *
 * Composable that, given a CellML file's content, parses its inter-component
 * connections, registers synthesised configs into the builderStore, and loads
 * the resulting nodes + edges into the VueFlow workspace.
 *
 * All ports are general ports. Handle sides are assigned after layout based on
 * the relative position of connected peers.
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
import { SOURCE_PORT_TYPE } from '../utils/constants'

export function useLoadFromCellML() {
  const {
    addNodes,
    addEdges,
    onNodesInitialized,
    fitView,
    updateNodeInternals,
    updateNodeData,
  } = useVueFlow()
  const store = useBuilderStore()
  const historyStore = useFlowHistoryStore()
  const { trackEvent } = useGtm()
  const { clearWorkspace } = useClearWorkspace()

  const layoutPending = ref(false)
  let pendingEdgeData = []
  let layoutCompleteResolve = null
  let layoutCompleteReject = null

  const loadFromCellML = async (cellmlContent, filename) => {
    try {
      await clearWorkspace()

      const { components, edges, configs } = parseCellMLConnections(cellmlContent, filename)

      if (components.length === 0) {
        notify.info({
          title: 'No Connections Found',
          message: `${filename} contains no inter-component connections to visualise.`,
        })
        return
      }

      store.addConfigFile(configs, filename)

      const cellmlResult = processCellMLData(cellmlContent)
      if (cellmlResult.type !== 'success') {
        throw new Error(
          `CellML parse error: ${cellmlResult.issues.map((i) => i.description).join('; ')}`
        )
      }
      const componentDataByName = new Map(
        cellmlResult.components.data.map((c) => [c.componentName, c])
      )

      const nodes = components.map((compName) => {
        const compData = componentDataByName.get(compName) ?? {}
        const variables = compData.variables ?? []
        const portOptions = compData.portOptions ?? []

        store.setVariableParameterValuesForInstance(compName, variables, filename, compName, 0)

        const moduleConfig = store.getModuleConfigFromConfigIndex(filename, compName, 0) ?? {}
        const portLabels = buildPortLabels(moduleConfig)

        // All ports start on the left — sides will be corrected post-layout
        const ports = portLabels.map((pl) => ({
          uid: crypto.randomUUID(),
          type: SOURCE_PORT_TYPE,
          side: 'left',
          name: pl.label,
        }))

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

      // Build adjacency map
      const nodeMap = new Map(initializedNodes.map((n) => [n.id, n]))
      const adjacency = new Map()
      for (const { source, target } of pendingEdgeData) {
        if (!adjacency.has(source)) adjacency.set(source, [])
        if (!adjacency.has(target)) adjacency.set(target, [])
        adjacency.get(source).push(target)
        adjacency.get(target).push(source)
      }

      // Reassign handle sides based on peer positions using updateNodeData
      for (const node of initializedNodes) {
        const peers = adjacency.get(node.id) ?? []
        if (peers.length === 0) continue

        const nx = node.position.x + (node.dimensions?.width ?? 0) / 2
        const ny = node.position.y + (node.dimensions?.height ?? 0) / 2

        const newPorts = node.data.ports.map((port) => {
          const connectedPeers = pendingEdgeData
            .filter(({ source, target }) => {
              const isSource = source === node.id
              const isTarget = target === node.id
              if (!isSource && !isTarget) return false
              const peerId = isSource ? target : source
              const peerNode = nodeMap.get(peerId)
              if (!peerNode) return false
              return peerNode.data.portLabels.some((pl) => pl.label === port.name)
            })
            .map(({ source, target }) =>
              nodeMap.get(source === node.id ? target : source)
            )
            .filter(Boolean)

          if (connectedPeers.length === 0) return port

          const avgPx =
            connectedPeers.reduce(
              (sum, p) => sum + p.position.x + (p.dimensions?.width ?? 0) / 2,
              0
            ) / connectedPeers.length
          const avgPy =
            connectedPeers.reduce(
              (sum, p) => sum + p.position.y + (p.dimensions?.height ?? 0) / 2,
              0
            ) / connectedPeers.length

          const dx = avgPx - nx
          const dy = avgPy - ny

          const side =
            Math.abs(dx) >= Math.abs(dy)
              ? dx >= 0
                ? 'right'
                : 'left'
              : dy >= 0
                ? 'bottom'
                : 'top'

          return { ...port, side }
        })

        updateNodeData(node.id, { ports: newPorts })
      }

      await nextTick()
      updateNodeInternals(initializedNodes.map((n) => n.id))
      await nextTick()

      // Build finalised edges now that handles have correct sides
      const pendingFlowEdgesLocal = pendingEdgeData.flatMap(({ source, target }) => {
        const sourceNode = nodeMap.get(source)
        const targetNode = nodeMap.get(target)
        if (!sourceNode || !targetNode) return []

        // Find shared port label between the two nodes
        const sourceLabels = new Set(sourceNode.data.portLabels.map((pl) => pl.label))
        const sharedLabel = targetNode.data.portLabels.find((pl) =>
          sourceLabels.has(pl.label)
        )?.label
        if (!sharedLabel) return []

        // Use the updated ports from the node data after updateNodeData
        const sourcePort = sourceNode.data.ports.find((p) => p.name === sharedLabel)
        const targetPort = targetNode.data.ports.find((p) => p.name === sharedLabel)
        if (!sourcePort || !targetPort) return []

        return [
          {
            id: `e_cellml_${source}_${target}_${crypto.randomUUID()}`,
            source,
            target,
            sourceHandle: getHandleId(sourcePort),
            targetHandle: getHandleId(targetPort),
          },
        ]
      })

      addEdges(pendingFlowEdgesLocal)
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
      layoutCompleteResolve = null
      layoutCompleteReject = null
    }
  })

  return { loadFromCellML }
}