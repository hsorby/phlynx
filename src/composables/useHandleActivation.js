import { nextTick } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useFlowHistoryStore } from '../stores/historyStore'
import { HANDLE_VARIANT } from '../utils/constants'
import { detachReactivity } from '../utils/reactivity'

export function useHandleActivation() {
  const { getNodes, updateNodeData, updateNodeInternals } = useVueFlow()
  const historyStore = useFlowHistoryStore()

  async function activateHandle(nodeId, handleUid) {
    const node = getNodes.value.find((n) => n.id === nodeId)
    if (!node) return

    const handle = node.data.handles.find((h) => h.uid === handleUid)
    if (!handle || handle.variant !== HANDLE_VARIANT.GHOST) return

    const oldHandles = detachReactivity(node.data.handles)
    const newHandles = node.data.handles.map((h) =>
      h.uid === handleUid ? { ...h, variant: HANDLE_VARIANT.DEFAULT } : h
    )

    const apply = async (handles) => {
      updateNodeData(nodeId, { handles })
      await nextTick()
      updateNodeInternals(nodeId)
    }

    await apply(newHandles)

    historyStore.addCommand({
      type: 'activate-ghost-handle',
      undo: () => apply(oldHandles),
      redo: () => apply(newHandles),
    })
  }

  return { activateHandle }
}
