<template>
  <div
    class="instance-node"
    :id="id"
    ref="instanceNode"
    :class="{ selected: selected }"
    @contextmenu.stop.prevent="openContextMenu"
    @mousedown.capture="StopDrag"
  >
    <NodeResizer min-width="180" min-height="105" :is-visible="selected" />

    <el-card :class="[domainTypeClass, 'instance-card']" shadow="hover">
      <div v-if="isMissingParameters" class="status-indicator">
        <el-tooltip content="At least one parameter has not been assigned a value" placement="top" effect="light">
          <el-icon class="warning-icon">
            <WarningFilled />
          </el-icon>
        </el-tooltip>
      </div>

      <div class="instance-name" @dblclick="startEditing">
        <span v-if="!isEditing">
          {{ data.name }}
        </span>
        <el-input v-else ref="inputRef" v-model="editingName" size="small" @blur="saveEdit" @keyup.enter="saveEdit" />
      </div>

      <div v-if="data.label" class="instance-label">{{ data.label }}</div>
      <div class="button-group">
        <el-tooltip
          effect="dark"
          content="Set key (colour)"
          placement="bottom"
          :show-after="300"
          :auto-close="1200"
        >
          <el-dropdown trigger="click" @command="handleSetDomainType" @visible-change="(val) => isDropdownOpen = val">
            <el-button size="small" circle class="instance-button">
              <el-icon><Key /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="membrane">Membrane</el-dropdown-item>
                <el-dropdown-item command="process">Process</el-dropdown-item>
                <el-dropdown-item command="compartment">Compartment</el-dropdown-item>
                <el-dropdown-item command="protein">Protein</el-dropdown-item>
                <el-dropdown-item command="undefined" divided>Reset to Default</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>

        <el-tooltip
            class="box-item"
            effect="dark"
            content="Add port node"
            placement="bottom"
            :show-after="300"
            :auto-close="1200"
        >
          <el-dropdown trigger="click" @command="addHandle({ side: $event })">
          
            <el-button size="small" circle class="instance-button">
              <el-icon><Place /></el-icon>
            </el-button>
          
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="left">Left</el-dropdown-item>
                <el-dropdown-item command="right">Right</el-dropdown-item>
                <el-dropdown-item command="top">Top</el-dropdown-item>
                <el-dropdown-item command="bottom">Bottom</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>
        <el-tooltip
            class="box-item"
            effect="dark"
            content="Edit port labels"
            placement="bottom"
            :show-after="300"
            :auto-close="1200"
        >
          <el-button
            size="small"
            circle
            @click="openEditDialog"
            class="instance-button"
          >
            <el-icon><Edit /></el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip
            class="box-item"
            effect="dark"
            content="Edit parameters"
            placement="bottom"
            :show-after="300"
            :auto-close="1200"
        >
          <el-button size="small" circle @click="openEditParameterDialog" class="instance-button">
            <el-icon><Operation /></el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip
            class="box-item"
            effect="dark"
            content="Edit CellML Text"
            placement="bottom"
            :show-after="300"
            :auto-close="1200"
        >
          <el-button
            size="small"
            circle
            @click="openCellMLEditDialog"
            class="instance-button"
            :show-after="300"
            :auto-close="1200"
          >
            <el-icon><CellMLIcon /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </el-card>

    <template v-for="handle in data.handles" :key="handle.uid" class="handle">
      <el-tooltip class="box-item" effect="dark" :content="handle.name" placement="bottom" :show-after="1000">
        <Handle
          :id="getHandleId(handle)"
          :ref="'handle_' + handle.side + '_' + handle.uid"
          :position="handlePosition(handle.side)"
          :style="getHandleStyle(handle, data.handles)"
          class="handle"
        />
        <template #content>
          <el-button
            class="delete-handle-btn"
            type="danger"
            :icon="Delete"
            circle
            plain
            size="small"
            @click.stop="removeHandle(handle.uid)"
          />
        </template>
      </el-tooltip>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { Handle, useVueFlow } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import { Delete, Edit, Key, Place, WarningFilled, Operation } from '@element-plus/icons-vue'
import CellMLIcon from './icons/CellMLIcon.vue'
import { useLibraryStore } from '../stores/libraryStore'
import { useFlowHistoryStore } from '../stores/historyStore'
import { getHandleId, getHandleStyle, handlePosition } from '../utils/handles.js'
import { sanitiseName } from '../utils/nodes'
import { notify } from '../utils/notify'
import { isEditableVariableType, isEmpty } from '../utils/variables'
import '../assets/vueflownode.css'
import { detachReactivity } from '../utils/reactivity'

const { addEdges, edges, removeEdges, updateNodeData, updateNodeInternals, nodes } = useVueFlow()
const historyStore = useFlowHistoryStore()
const libraryStore = useLibraryStore()

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  data: {
    type: Object,
    required: true,
  }, // {handles, module, parameters, id, name}
})

const emit = defineEmits([
  'open-cellml-editor-dialog',
  'open-edit-dialog',
  'open-parameter-editor-dialog',
  'open-context-menu',
])

async function openEditDialog() {
  emit('open-edit-dialog', {
    nodeId: props.id,
    handles: props.data.handles,
    name: props.data.name,
    module: props.data.module,
  })
}

function openCellMLEditDialog() {
  emit('open-cellml-editor-dialog', {
    nodeId: props.id,
    name: props.data.name,
    mathRef: props.data.module.mathRef,
    moduleRef: props.data.module.moduleRef,
  })
}

function openEditParameterDialog() {
  emit('open-parameter-editor-dialog', {
    nodeId: props.id,
    name: props.data.name,
    mathRef: props.data.module.mathRef
  })
}

const domainTypeClass = computed(() => {
  return props.data.domainType ? `domain-type-${props.data.domainType}` : 'domain-type-default'
})

const isMissingParameters = computed(() => {
  const name = props.data?.name
  if (!name) return true // If there's no component file, it's "missing" parameters

  for (const variable of props.data.variables || []) {
    if (isEditableVariableType(variable.type)) {
      if (variable.type === 'global_constant') {
        const globalConstant = libraryStore.getGlobalConstant(variable.name)
        if (isEmpty(globalConstant?.value)) {
          return true
        }
      } else if (isEmpty(variable.value)) {
        return true
      }
    }
  }
  return false
})

function handleSetDomainType(typeCommand) {
  const newType = typeCommand === 'undefined' ? undefined : typeCommand
  updateNodeData(props.id, { domainType: newType })
}

const applyHandles = async (handlesToSet) => {
  updateNodeData(props.id, { handles: handlesToSet })
  await nextTick()
  updateNodeInternals(props.id)
}

async function removeHandle(handleIdToRemove) {
  const oldHandles = detachReactivity(props.data.handles)

  const handle = oldHandles.find((p) => p.uid === handleIdToRemove)
  if (!handle) return

  const handleId = getHandleId(handle)

  // Find all edges connected to this specific port handle.
  // We need to snapshot these edge objects so we can restore them later
  const connectedEdges = edges.value.filter(
    (edge) =>
      (edge.source === props.id && edge.sourceHandle === handleId) ||
      (edge.target === props.id && edge.targetHandle === handleId)
  )

  const edgesSnapshot = connectedEdges.map((edge) => detachReactivity(edge))

  // Define New Handles (for Redo)
  const newHandles = props.data.handles.filter((h) => h.uid !== handleIdToRemove)

  // Add Composite Command to History
  historyStore.executeAndAddCommand({
    type: 'remove-handle',
    undo: async () => {
      // Restore the handle first (so the handle exists in the DOM).
      await applyHandles(oldHandles)

      // Then, restore the edges.
      if (edgesSnapshot.length > 0) {
        addEdges(edgesSnapshot)
      }
    },
    redo: async () => {
      // Remove the edges.
      if (edgesSnapshot.length > 0) {
        removeEdges(edgesSnapshot.map((e) => e.id))
      }

      // Then, remove the port
      await applyHandles(newHandles)
    },
  })
}

const addHandle = async (handleToAdd) => {
  const oldHandles = [...props.data.handles]

  const newPort = {
    ...handleToAdd,
    uid: crypto.randomUUID(),
  }

  const newHandles = [...props.data.handles, newPort]

  await applyHandles(newHandles)

  historyStore.addCommand({
    type: 'add-handle',
    undo: async () => {
      applyHandles(oldHandles)
    },
    redo: async () => {
      applyHandles(newHandles)
    },
  })
}

const isEditing = ref(false)
const editingName = ref('')
const inputRef = ref(null) 

async function startEditing(event) {
  event.stopPropagation()

  isEditing.value = true
  editingName.value = props.data.name

  await nextTick()
  inputRef.value?.focus()
}

function StopDrag(event) {
  if (isEditing.value) {
    event.stopPropagation()
  }
}

// This is triggered by pressing Enter or clicking away
function saveEdit() {
  if (!editingName.value || editingName.value.trim() === '') {
    isEditing.value = false
    return
  }

  const sanitisedName = sanitiseName(editingName.value)

  if (!sanitisedName) {
    isEditing.value = false
    return
  }

  const nameExists = nodes.value.some((node) => node.id !== props.id && node.data && node.data.name === sanitisedName)

  if (nameExists) {
    notify.error({ message: 'An instance with this name already exists.' })
    return
  }

  // Update the node's data in the store
  updateNodeData(props.id, { name: sanitisedName })
  isEditing.value = false
  setTimeout(() => {
    libraryStore.setParameterValuesForInstance(
      sanitisedName,
      props.data.variables,
      props.data.componentFile,
      props.data.componentType,
      props.data.configIndex
    )
    updateNodeData(props.id, { variables: props.data.variables })
  }, 100) // Delay to ensure the DOM has updated
}

function openContextMenu(event) {
  emit('open-context-menu', {
    clientX: event.clientX,
    clientY: event.clientY,
    nodeId: props.id,
  })
}

</script>

<style lang="scss" scoped>
@import '../assets/vueflowhandle.css';

.instance-node {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border-radius: 10px;
}

.instance-node > .el-card,
.instance-card {
  width: 100%;
  height: 100%;
  margin: 0;
  border-radius: 10px;
  box-sizing: border-box;
  position: relative;
  border: 3px solid rgba(0,0,0,0.04);
}

.status-indicator {
  position: absolute;
  top: 0px;
  right: 0px;
  z-index: 10;
  background-color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.warning-icon {
  color: var(--el-color-warning);
  font-size: 18px;
  cursor: help;

  &:hover {
    color: var(--el-color-warning-dark-2);
  }
}

.instance-button {
  margin: 0;
}
</style>
