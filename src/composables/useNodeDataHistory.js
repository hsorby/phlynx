import { useVueFlow } from '@vue-flow/core'
import { useFlowHistoryStore } from '../stores/historyStore'
import { useLibraryStore } from '../stores/libraryStore'
import { FLOW_IDS } from '../utils/constants'
import { detachReactivity } from '../utils/reactivity'

const isSame = (value, otherValue) => JSON.stringify(value) === JSON.stringify(otherValue)

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
   * Writes copied fields back to each node whose fields still match `expected`, skipping nodes that
   * no longer exist or that something else has changed since.
   *
   * @param {ReturnType<typeof captureNodeFields>} snapshot
   * @param {ReturnType<typeof captureNodeFields>} expected
   */
  function restoreNodeFields(snapshot, expected) {
    const expectedById = new Map(expected.map(({ id, fields }) => [id, fields]))
    snapshot.forEach(({ id, fields }) => {
      const current = captureNodeFields([id], Object.keys(fields))[0]
      if (!current || !isSame(current.fields, expectedById.get(id))) return
      updateNodeData(id, detachReactivity(fields))
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
   * Writes copied couplings back to each edge whose couplings still match `expected`, skipping
   * edges that no longer exist or that something else has changed since.
   *
   * @param {ReturnType<typeof captureEdgeCouplings>} snapshot
   * @param {ReturnType<typeof captureEdgeCouplings>} expected
   */
  function restoreEdgeCouplings(snapshot, expected) {
    const expectedById = new Map(expected.map(({ id, couplings }) => [id, couplings]))
    snapshot.forEach(({ id, couplings }) => {
      const edge = findEdge(id)
      if (!edge || !isSame(edge.data?.couplings, expectedById.get(id))) return
      edge.data = { ...edge.data, couplings: couplings && detachReactivity(couplings) }
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
      return isSame(previous, value) ? [] : [{ name, before: previous, after: value }]
    })
  }

  /**
   * Puts constants back to one side of a diff, skipping any that something else has changed since.
   * A constant the edit added is only removed while no node uses it.
   *
   * @param {ReturnType<typeof diffConstants>} changes
   * @param {'before'|'after'} side
   */
  function applyConstants(changes, side) {
    changes.forEach((change) => {
      const expected = side === 'before' ? change.after : change.before
      if (!isSame(libraryStore.getGlobalConstant(change.name), expected)) return
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

    const isUnchanged = !library && !constants.length && isSame(nodesBefore, nodesAfter) && isSame(edgesBefore, edgesAfter)
    if (isUnchanged) return false

    let isApplied = true
    await history.executeAndAddCommand({
      type,
      undo: () => {
        restoreNodeFields(nodesBefore, nodesAfter)
        restoreEdgeCouplings(edgesBefore, edgesAfter)
        library?.undo()
        applyConstants(constants, 'before')
      },
      redo: () => {
        if (isApplied) {
          isApplied = false
          return
        }
        restoreNodeFields(nodesAfter, nodesBefore)
        restoreEdgeCouplings(edgesAfter, edgesBefore)
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
