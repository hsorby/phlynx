import { nextTick, ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useFlowHistoryStore } from '../stores/historyStore'
import { HANDLE_VARIANT } from '../utils/constants'
import { getHandleId, getHandleUidFromHandleId } from '../utils/handles'
import { detachReactivity } from '../utils/reactivity'

const pendingGhostRevert = ref(null)

export function useHandleActivation() {
  const { getNodes, updateNodeData, updateNodeInternals, edges } = useVueFlow()
  const historyStore = useFlowHistoryStore()

  async function setHandleVariant(nodeId, handleUid, variant) {
    const node = getNodes.value.find((n) => n.id === nodeId)
    if (!node) return

    const handle = node.data.handles.find((h) => h.uid === handleUid)
    if (!handle || handle.variant === variant) return

    const oldHandles = detachReactivity(node.data.handles)
    const newHandles = node.data.handles.map((h) =>
      h.uid === handleUid ? { ...h, variant } : h
    )

    const apply = async (handles) => {
      updateNodeData(nodeId, { handles })
      await nextTick()
      updateNodeInternals(nodeId)
    }

    await apply(newHandles)

    historyStore.addCommand({
      type: `set-handle-variant-${variant}`,
      undo: () => apply(oldHandles),
      redo: () => apply(newHandles),
    })
  }

  async function activateHandle(nodeId, handleUid) {
    await setHandleVariant(nodeId, handleUid, HANDLE_VARIANT.DEFAULT)
  }

  function beginGhostActivation(nodeId, handleUid) {
    pendingGhostRevert.value = { nodeId, handleUid }
    activateHandle(nodeId, handleUid)
  }

  function confirmActivation() {
    pendingGhostRevert.value = null
  }

  /**
   * Reverts a single handle to the ghost variant, but only if no remaining
   * edge still terminates on it. `excludeEdgeIds` lets callers check this
   * *before* the edge(s) being removed have actually left `edges.value`
   * (e.g. inside onEdgeChange, ahead of applyEdgeChanges), so the check
   * doesn't see its own soon-to-be-removed edge as "still in use".
   */
  async function revertHandleIfUnused(nodeId, handleUid, { excludeEdgeIds = [] } = {}) {
    const node = getNodes.value.find((n) => n.id === nodeId)
    const handle = node?.data.handles.find((h) => h.uid === handleUid)
    if (!handle) return

    const handleId = getHandleId(handle)
    const hasEdge = edges.value.some(
      (edge) =>
        !excludeEdgeIds.includes(edge.id) &&
        ((edge.source === nodeId && edge.sourceHandle === handleId) ||
          (edge.target === nodeId && edge.targetHandle === handleId))
    )

    if (!hasEdge) {
      await setHandleVariant(nodeId, handleUid, HANDLE_VARIANT.GHOST)
    }
  }

  async function revertPendingGhostIfUnused() {
    if (!pendingGhostRevert.value) return

    const { nodeId, handleUid } = pendingGhostRevert.value
    pendingGhostRevert.value = null

    await revertHandleIfUnused(nodeId, handleUid)
  }

  /**
   * Reverts both ends of a removed edge to ghost (each only if unused
   * elsewhere). Pass the edge's own id(s) in excludeEdgeIds when calling
   * this ahead of the edge actually being removed from edges.value.
   */
  async function revertHandlesForEdge(edge, excludeEdgeIds = [edge.id]) {
    if (edge.sourceHandle) {
      await revertHandleIfUnused(edge.source, getHandleUidFromHandleId(edge.sourceHandle), {
        excludeEdgeIds,
      })
    }
    if (edge.targetHandle) {
      await revertHandleIfUnused(edge.target, getHandleUidFromHandleId(edge.targetHandle), {
        excludeEdgeIds,
      })
    }
  }

  /** Re-activates both ends of a restored edge, e.g. on undo of a removal. */
  async function reactivateEdgeHandles(edge) {
    if (edge.sourceHandle) {
      await activateHandle(edge.source, getHandleUidFromHandleId(edge.sourceHandle))
    }
    if (edge.targetHandle) {
      await activateHandle(edge.target, getHandleUidFromHandleId(edge.targetHandle))
    }
  }

  return {
    activateHandle,
    beginGhostActivation,
    confirmActivation,
    revertPendingGhostIfUnused,
    revertHandleIfUnused,
    revertHandlesForEdge,
    reactivateEdgeHandles,
  }
}
