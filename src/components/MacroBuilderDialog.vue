<template>
  <Dialog
    v-model:visible="visible"
    header="Macro Builder"
    class="macro-dialog"
    :modal="true"
    :draggable="false"
    :closable="true"
    :appendTo="'body'"
    :style="{ width: '95vw', maxWidth: '95vw', height: '90vh' }"
    @hide="closeDialog"
  >
    <div class="macro-dialog-body">
      <aside
        :style="{ width: isAsideCollapsed ? '0px' : asideWidth + 'px' }"
        class="module-aside"
        :class="{ 'module-aside--collapsed': isAsideCollapsed }"
      >
        <h4 class="module-aside-title">Module Library</h4>
        <LibraryArea />
      </aside>

      <div
        class="resize-handle"
        :class="{ 'resize-handle--disabled': isAsideCollapsed }"
        @mousedown="!isAsideCollapsed && startResize($event)"
      >
        <button
          type="button"
          class="aside-collapse-toggle"
          @mousedown.stop
          @click="toggleAsideCollapse"
          v-tooltip.right="isAsideCollapsed ? 'Show module library' : 'Hide module library'"
        >
          <i :class="isAsideCollapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-left'"></i>
        </button>
      </div>

      <main class="workbench-macro">
        <div class="dnd-flow" @drop="onDrop" @dragover.prevent>
          <VueFlow
            :id="FLOW_IDS.MACRO"
            @dragleave="onDragLeave"
            @nodes-change="onNodeChange"
            @edges-change="onEdgeChange"
            :default-edge-options="macroEdgeOptions"
            :connection-line-options="macroEdgeOptions"
            :nodes="nodes"
            :delete-key-code="['Backspace', 'Delete']"
          >
            <template #node-instanceNode="props">
              <InstanceNode
                :id="props.id"
                :data="props.data"
                :selected="props.selected"
                @open-edit-dialog="onOpenEditDialog"
                :ref="(el) => (nodeRefs[props.id] = el)"
              />
            </template>
            <template #node-ghostNode="props">
              <GhostNode :id="props.id" :data="props.data" />
            </template>
            <WorkbenchArea />
          </VueFlow>
        </div>
      </main>
    </div>

    <template #footer>
      <div class="config-panel">
        <label class="repeat-count-control">
          <span>Repeat Count</span>
          <InputNumber v-model="multiplier" :min="1" :showButtons="true" />
        </label>
        <Button label="Cancel" severity="secondary" text @click="closeDialog" />
        <Button label="Generate Macro Node" severity="primary" @click="generateMacro" />
      </div>
    </template>
  </Dialog>

  <GhostSetupModal v-if="isGhostSetupOpen" @confirm="finalizeGhostNode" @cancel="cancelGhostNode" />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'

import WorkbenchArea from './WorkbenchArea.vue'
import LibraryArea from './LibraryArea.vue'
import InstanceNode from './InstanceNode.vue'
import GhostNode from './GhostNode.vue'
import GhostSetupModal from './GhostSetupDialog.vue'
import { useLibraryStore } from '../stores/libraryStore'
import { useResizableAside } from '../composables/useResizableAside'
import { useGtm } from '../composables/useGtm'
import useDragAndDrop from '../composables/useDnD'
import {
  edgeLineOptions,
  FLOW_IDS,
  GHOST_MATH_REF,
  GHOST_MODULE_DEFINITION,
  GHOST_MODULE_FILENAME,
  GHOST_MODULE_REF,
  MACRO_BUILDER_ARROW,
  markerEnd,
} from '../utils/constants'
import { detachReactivity } from '../utils/reactivity'

const { addEdges, edges, findNode, nodes, onConnect, onDragLeave, onNodeChange, onEdgeChange, removeNodes } =
  useVueFlow(FLOW_IDS.MACRO)

const previousNodes = new Set()
const { onDrop, isGhostSetupOpen, pendingGhostNodeId } = useDragAndDrop(previousNodes)
const { trackEvent } = useGtm()

const { width: asideWidth, startResize } = useResizableAside(200, 150, 400)
const isAsideCollapsed = ref(false)

function toggleAsideCollapse() {
  isAsideCollapsed.value = !isAsideCollapsed.value
}

const libraryStore = useLibraryStore()

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'generate', 'edit-node'])

const multiplier = ref(1)
const nodeRefs = ref({})

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const macroEdgeOptions = {
  ...edgeLineOptions,
  markerEnd: {
    type: markerEnd,
    id: MACRO_BUILDER_ARROW,
  },
}

onConnect((connection) => {
  // Match what we specify in connectionLineOptions.
  const newEdge = {
    ...connection,
    ...macroEdgeOptions,
  }

  addEdges(newEdge)
})

function onOpenEditDialog(eventPayload) {
  emit('edit-node', {
    ...eventPayload,
    instanceId: FLOW_IDS.MACRO,
  })
}

watch(
  () => props.modelValue,
  (newVal) => {
    newVal
      ? libraryStore.addModule(GHOST_MODULE_DEFINITION)
      : libraryStore.removeModule(GHOST_MATH_REF, GHOST_MODULE_REF)
  }
)

function closeDialog() {
  visible.value = false
}

function generateMacro() {
  const serializedNodes = nodes.value.map((node) => {
    const dataSnapshot = detachReactivity(node.data)

    return {
      id: node.id,
      type: node.type,
      position: { ...node.position },
      data: dataSnapshot,
      width: node.dimensions?.width || node.width || 150, // Fallback safe
      height: node.dimensions?.height || node.height || 50,
    }
  })

  const serializedEdges = edges.value.map((e) => ({ ...e }))

  const macroData = {
    flow: { nodes: serializedNodes, edges: serializedEdges },
    repeatCount: multiplier.value,
  }

  trackEvent('macro_action', {
    category: 'MacroBuilder',
    action: 'generate_macro',
    label: `Nodes: ${nodes.value.length}`,
    file_type: 'json',
  })
  emit('generate', macroData)
  closeDialog()
}

const finalizeGhostNode = (selectedTargetNodeId) => {
  const ghostNode = findNode(pendingGhostNodeId.value)

  if (ghostNode) {
    ghostNode.data = {
      ...ghostNode.data,
      targetNodeId: selectedTargetNodeId,
    }
  }

  isGhostSetupOpen.value = false
  pendingGhostNodeId.value = null
}

// --- Handle Modal Cancellation ---
const cancelGhostNode = () => {
  // If user cancels, we should remove the empty ghost node they just dropped
  if (pendingGhostNodeId.value) {
    removeNodes([pendingGhostNodeId.value])
  }

  isGhostSetupOpen.value = false
  pendingGhostNodeId.value = null
}
</script>

<style scoped>
.macro-dialog-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.module-aside {
  flex-shrink: 0;
  border-right: 1px solid var(--p-surface-border);
  padding: 1rem;
  overflow: auto;
  background: var(--p-surface-0);
}

.module-aside-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.resize-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  cursor: col-resize;
  background: var(--p-surface-100);
  transition: background-color 0.2s ease;
}

.resize-handle--disabled {
  cursor: default;
}

.aside-collapse-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 9999px;
  background: var(--p-surface-0);
  color: var(--p-text-muted-color);
  cursor: pointer;
  box-shadow: 0 0 0 1px var(--p-surface-border);
}

.aside-collapse-toggle:hover {
  background: var(--p-surface-100);
}

.module-aside--collapsed {
  overflow: hidden;
  padding: 0;
  border-right: 0;
}

.workbench-macro {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dnd-flow {
  flex-grow: 1;
  height: 100%;
  width: 100%;
  position: relative;
}

.config-panel {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: flex-end;
}

.repeat-count-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
}
</style>

<style>
.macro-dialog .p-dialog-content {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.macro-dialog .p-dialog-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--p-surface-border);
}
</style>
