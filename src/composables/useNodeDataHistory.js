import { useVueFlow } from '@vue-flow/core'
import { useFlowHistoryStore } from '../stores/historyStore'
import { useLibraryStore } from '../stores/libraryStore'
import { FLOW_IDS } from '../utils/constants'
import { detachReactivity } from '../utils/reactivity'

/**
 * Records edits to node data, edge couplings and global constants as canvas undo steps. Nodes and
 * edges are found by id on every undo and redo, so a step still applies after they are re-created.
 *
 * @param {string} [flowId=FLOW_IDS.MAIN] - Only the main flow records history.
 * @returns {Object} Snapshot helpers and recordEdit.
 */
export function useNodeDataHistory(flowId = FLOW_IDS.MAIN) {
  const { nodes, edges, findNode, findEdge, updateNodeData } = useVueFlow(flowId)
  const history = useFlowHistoryStore()
  const libraryStore = useLibraryStore()

  /**
   * Copies some data fields of each node.
   *
   * @param {Array<string>} ids
   * @param {Array<string>} keys
   * @returns {Array<{ id: string, fields: Object }>} Missing nodes are left out.
   */
  function captureNodeFields(ids, keys) {
    return ids.flatMap((id) => {
      const data = findNode(id)?.data
      if (!data) return []
      const fields = Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, data[key]]))
      return [{ id, fields: detachReactivity(fields) }]
    })
  }

  /**
   * Writes copied fields back, skipping nodes that no longer exist.
   *
   * @param {ReturnType<typeof captureNodeFields>} snapshot
   */
  function restoreNodeFields(snapshot) {
    snapshot.forEach(({ id, fields }) => {
      if (findNode(id)) updateNodeData(id, detachReactivity(fields))
    })
  }

  /**
   * Finds the edges that start or end at any of the nodes.
   *
   * @param {Array<string>} nodeIds
   * @returns {Array<string>}
   */
  function findIncidentEdgeIds(nodeIds) {
    const ids = new Set(nodeIds)
    return edges.value.filter((edge) => ids.has(edge.source) || ids.has(edge.target)).map((edge) => edge.id)
  }

  /**
   * Copies the couplings of each edge.
   *
   * @param {Array<string>} edgeIds
   * @returns {Array<{ id: string, couplings: Array|undefined }>} Missing edges are left out.
   */
  function captureEdgeCouplings(edgeIds) {
    return edgeIds.flatMap((id) => {
      const edge = findEdge(id)
      return edge ? [{ id, couplings: edge.data?.couplings && detachReactivity(edge.data.couplings) }] : []
    })
  }

  /**
   * Writes copied couplings back, skipping edges that no longer exist.
   *
   * @param {ReturnType<typeof captureEdgeCouplings>} snapshot
   */
  function restoreEdgeCouplings(snapshot) {
    snapshot.forEach(({ id, couplings }) => {
      const edge = findEdge(id)
      if (edge) edge.data = { ...edge.data, couplings: couplings && detachReactivity(couplings) }
    })
  }

  /**
   * Copies the global constants.
   *
   * @returns {Map<string, Object>}
   */
  function captureConstants() {
    return new Map(detachReactivity([...libraryStore.globalVariables.entries()]))
  }

  /**
   * Checks whether any node still has a global constant row with this name.
   *
   * @param {string} name
   * @returns {boolean}
   */
  function isConstantUsed(name) {
    return nodes.value.some((node) =>
      node.data?.variables?.some((row) => row.type === 'global_constant' && row.name === name)
    )
  }

  /**
   * Finds the constants an edit added or changed.
   *
   * @param {Map<string, Object>} before
   * @param {Map<string, Object>} after
   * @returns {Array<{ name: string, before: Object|undefined, after: Object }>}
   */
  function diffConstants(before, after) {
    return [...after].flatMap(([name, value]) => {
      const previous = before.get(name)
      return JSON.stringify(previous) === JSON.stringify(value) ? [] : [{ name, before: previous, after: value }]
    })
  }

  /**
   * Puts constants back to one side of a diff. A constant the edit added is only removed while no
   * node uses it.
   *
   * @param {ReturnType<typeof diffConstants>} changes
   * @param {'before'|'after'} side
   */
  function applyConstants(changes, side) {
    changes.forEach((change) => {
      const constant = change[side]
      if (constant) {
        libraryStore.assignGlobalConstant(change.name, constant.value, constant.units, constant.data_reference, true)
      } else if (!isConstantUsed(change.name)) {
        libraryStore.removeGlobalConstant(change.name)
      }
    })
  }

  /**
   * Runs an edit, then records it as one undo step if it changed the given node fields, the
   * couplings of the given edges, or the global constants. Off the main flow, or during undo and
   * redo, the edit just runs.
   *
   * @param {Object} options
   * @param {string} options.type - The command type.
   * @param {Array<string>} options.nodeIds
   * @param {Array<string>} options.keys - The node data fields the edit may change.
   * @param {Array<string>} [options.edgeIds=[]] - Edges whose couplings the edit may change.
   * @param {Function} options.apply - Makes the edit.
   * @param {Object} [options.library] - Library changes beyond constants: `{ undo, redo }`, run after the node fields are restored.
   * @returns {Promise<boolean>} Whether a step was recorded, once it is on the stack.
   */
  async function recordEdit({ type, nodeIds, keys, edgeIds = [], apply, library }) {
    if (flowId !== FLOW_IDS.MAIN || history.isUndoRedoing) {
      apply()
      return false
    }

    const nodesBefore = captureNodeFields(nodeIds, keys)
    const edgesBefore = captureEdgeCouplings(edgeIds)
    const constantsBefore = captureConstants()
    apply()
    const nodesAfter = captureNodeFields(nodeIds, keys)
    const edgesAfter = captureEdgeCouplings(edgeIds)
    const constants = diffConstants(constantsBefore, captureConstants())

    const isUnchanged =
      !library &&
      !constants.length &&
      JSON.stringify(nodesBefore) === JSON.stringify(nodesAfter) &&
      JSON.stringify(edgesBefore) === JSON.stringify(edgesAfter)
    if (isUnchanged) return false

    let isApplied = true
    await history.executeAndAddCommand({
      type,
      undo: () => {
        restoreNodeFields(nodesBefore)
        restoreEdgeCouplings(edgesBefore)
        library?.undo()
        applyConstants(constants, 'before')
      },
      redo: () => {
        if (isApplied) {
          isApplied = false
          return
        }
        restoreNodeFields(nodesAfter)
        restoreEdgeCouplings(edgesAfter)
        library?.redo()
        applyConstants(constants, 'after')
      },
    })
    return true
  }

  return {
    captureNodeFields,
    restoreNodeFields,
    findIncidentEdgeIds,
    captureEdgeCouplings,
    restoreEdgeCouplings,
    recordEdit,
  }
}
