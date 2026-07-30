<template>
  <el-dialog
    :model-value="modelValue"
    title="Macro Builder"
    class="macro-dialog"
    fullscreen
    @update:model-value="closeDialog"
  >
    <el-container style="flex-grow: 1; min-height: 0">
      <el-aside :width="asideWidth + 'px'" class="module-aside">
        <h4 style="margin-top: 0">Module Library </h4>
        <LibraryArea />
      </el-aside>

      <div class="resize-handle" @mousedown="startResize">
        <el-icon class="handle-icon"><DCaret /></el-icon>
      </div>

      <el-main class="workbench-macro">
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
      </el-main>
    </el-container>
    <template #footer>
      <div class="config-panel">
        <el-input-number v-model="multiplier" label="Repeat Count" />
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button @click="generateMacro" type="primary"
          >Generate Macro Node</el-button
        >
      </div>
    </template>
  </el-dialog>

  <GhostSetupModal
    v-if="isGhostSetupOpen"
    @confirm="finalizeGhostNode"
    @cancel="cancelGhostNode"
  />
</template>

<script setup>
import { ref, watch } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { DCaret } from '@element-plus/icons-vue'
import {
  ElDialog,
  ElContainer,
  ElAside,
  ElMain,
  ElButton,
  ElInputNumber,
  ElIcon,
} from 'element-plus'

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

const {
  addEdges,
  edges,
  findNode,
  nodes,
  onConnect,
  onDragLeave,
  onNodeChange,
  onEdgeChange,
  removeNodes,
} = useVueFlow(FLOW_IDS.MACRO) 

const previousNodes = new Set()
const { onDrop, isGhostSetupOpen, pendingGhostNodeId } =
  useDragAndDrop(previousNodes)
const { trackEvent } = useGtm()

const { width: asideWidth, startResize } = useResizableAside(200, 150, 400)
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

const macroEdgeOptions = {
  ...edgeLineOptions,
  markerEnd: {
    type: markerEnd, 
    id: MACRO_BUILDER_ARROW,    
  }
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
  emit('update:modelValue', false)
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
    file_type: 'json'
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
.workbench-macro {
  padding: 0;
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
</style>

<style>
.macro-dialog .el-dialog__body {
  height: calc(100vh - 120px);
  padding: 0 !important; 
  display: flex;
  flex-direction: column;
}
</style>
