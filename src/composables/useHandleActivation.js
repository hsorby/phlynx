import { nextTick, ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useFlowHistoryStore } from '../stores/historyStore'
import { HANDLE_VARIANT } from '../utils/constants'
import { getHandleId } from '../utils/handles'
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

  async function revertPendingGhostIfUnused() {
    if (!pendingGhostRevert.value) return

    const { nodeId, handleUid } = pendingGhostRevert.value
    pendingGhostRevert.value = null

    const node = getNodes.value.find((n) => n.id === nodeId)
    const handle = node?.data.handles.find((h) => h.uid === handleUid)
    if (!handle) return

    const handleId = getHandleId(handle)
    const hasEdge = edges.value.some(
      (edge) =>
        (edge.source === nodeId && edge.sourceHandle === handleId) ||
        (edge.target === nodeId && edge.targetHandle === handleId)
    )

    if (!hasEdge) {
      await setHandleVariant(nodeId, handleUid, HANDLE_VARIANT.GHOST)
    }
  }

  return {
    activateHandle,
    beginGhostActivation,
    confirmActivation,
    revertPendingGhostIfUnused,
  }
}
