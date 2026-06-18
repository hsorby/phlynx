<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="80%"
    top="5vh"
    class="editor-dialog"
    :before-close="handleBeforeClose"
    @update:model-value="(val) => emit('update:modelValue', val)"
  >
    <div class="editor-container">
      <div v-if="loading" class="loading">Loading CellML source...</div>

      <div v-else class="editor-wrapper">
        <CellMLTextEditor
          :model-value="currentModel"
          :regenerate-on-change="modelValue"
          @update:code="currentModel = $event"
          @save="handleSave('key')"
        />
      </div>

      <div class="status-bar">
        <span v-if="isInternalModule" class="tag internal">
          <i class="icon-lock"></i> Read-Only Source (Internal)
        </span>
        <span v-else class="tag user">
          <i class="icon-user"></i> Editable Source (User Workspace)
        </span>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <!-- "Apply to all" checkbox — only shown when sibling nodes exist -->
        <el-tooltip
          v-if="siblingCount > 0"
          :content="`Also update ${siblingCount} other node${siblingCount !== 1 ? 's' : ''} using ${props.nodeData.componentType} from ${props.nodeData.componentFile}`"
          placement="top"
          effect="light"
        >
          <el-checkbox v-model="applyToAll" class="apply-all-checkbox">
            Apply to all instances
            <el-tag size="small" type="info" style="margin-left: 6px">
              {{ siblingCount + 1 }}
            </el-tag>
          </el-checkbox>
        </el-tooltip>

        <div class="footer-buttons">
          <el-button @click="handleCancel">Cancel</el-button>
          <el-button type="primary" @click="handleSave('button')" :disabled="!isDirty">
            Save Changes
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElButton, ElCheckbox, ElDialog, ElMessageBox, ElTag, ElTooltip } from 'element-plus'
import { useVueFlow } from '@vue-flow/core'
import CellMLTextEditor from './CellMLTextEditor.vue'
import { useLibraryStore } from '../stores/libraryStore'
import { useGtm } from '../composables/useGtm'
import { USER_MODULES_FILE } from '../utils/constants'
import {
  areModelsEquivalent,
  extractComponentsFromCellmlString,
  doesComponentExistInModel,
  getModelComponentNames,
  mergeModelComponents,
} from '../utils/cellml'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  nodeData: {
    type: Object,
    required: true,
    // Expected: { nodeId, name, mathRef }
  },
})

const emit = defineEmits(['update:modelValue', 'save'])

const store = useLibraryStore()
const { trackEvent } = useGtm()
const { nodes } = useVueFlow()

const loading = ref(false)
const currentModel = ref('')
const originalModel = ref('')
const applyToAll = ref(false)

const componentFile = computed(() => {
  return props.nodeData?.mathRef?.split(":")[0]
})

const componentName = computed(() => {
  return props.nodeData?.mathRef?.split(":")[1]
})

const isInternalModule = computed(() => {
  return !!componentFile && componentFile !== USER_MODULES_FILE
})

const isDirty = computed(() => {
  return !areModelsEquivalent(originalModel.value, currentModel.value)
})

const dialogTitle = computed(() => {
  return `Editing: ${props.nodeData.name} (${componentName.value} - ${componentFile.value})`
})

/**
 * Count of other nodes sharing the same componentFile AND componentType.
 * Nodes from a different componentFile are never included, even if the component
 * name happens to match.
 */
const siblingCount = computed(() => {
  if (!componentName.value || !componentFile.value) return 0

  return nodes.value.filter(
    (n) =>
      n.id !== props.nodeData.nodeId &&
      n.data?.module?.mathRef === props.nodeData.mathRef
  ).length
})

// Reset checkbox when dialog opens for a new node.
watch(() => props.nodeData, () => { applyToAll.value = false })

// ── Load content when dialog opens ──────────────────────────────────────────

watch(
  () => props.nodeData,
  async (newData) => {
    if (newData && props.nodeData) {
      loading.value = true
      try {
        const math = await store.availableMath.get(newData.mathRef) 
        currentModel.value = math
        originalModel.value = math
      } catch (e) {
        console.error('Failed to load source', e)
      } finally {
        loading.value = false
      }
    }
  },
  { deep: true }
)

const checkDirtyAndProceed = (confirmAction) => {
  if (isDirty.value) {
    ElMessageBox.confirm('You have unsaved changes. Are you sure you want to close?', 'Warning', { type: 'warning' })
      .then(() => confirmAction())
      .catch(() => {})
  } else {
    confirmAction()
  }
}

const handleBeforeClose = (done) => checkDirtyAndProceed(done)
const handleCancel = () => checkDirtyAndProceed(() => emit('update:modelValue', false))

// ── Save ─────────────────────────────────────────────────────────────────────
//
// Both scope: single and scope: all perform identical merge logic — the
// component is written to USER_MODULES_FILE under whatever name is in the
// editor. The only difference is which nodes get redirected in Workspace:
//   scope: single -> only the editing node
//   scope: all    -> all nodes sharing originalComponentFile + originalComponentName

const handleSave = async (source) => {
  if (source === 'key' && !isDirty.value) return

  const componentNames = getModelComponentNames(currentModel.value)
  if (!componentNames || componentNames.length === 0) {
    ElMessageBox.alert('Could not find a valid component name in the model.', 'Parse Error', { type: 'error' })
    return
  }

  const newName = componentNames[0].trim()
  const currentName = props.nodeData.componentType

  try {
    // Determine whether to replace an existing UserModules entry or append.
    //
    // We must not replace when other nodes still point to currentName:
    //   - Internal modules: always appending (first write to UserModules).
    //   - scope 'single' with siblings: other nodes depend on currentName,
    //     so we append newName alongside it rather than removing currentName.
    //   - scope 'single' with no siblings: safe to replace in place.
    //   - scope 'all': replace in place, all nodes will be redirected to newName.
    const hasSiblings = siblingCount.value > 0
    const isAppending = isInternalModule.value || (!applyToAll.value && hasSiblings)

    const existingModel = await store.getModelByCollectionName(USER_MODULES_FILE)

    // Block if the name is already taken by a different component.
    // Updating in place (newName === currentName and we own it) is always allowed.
    const nameExists = doesComponentExistInModel(existingModel, newName)
    const isUpdatingInPlace = nameExists && newName === currentName && !isAppending

    if (nameExists && !isUpdatingInPlace) {
      ElMessageBox.alert(
        `A component named "${newName}" already exists in User Modules. Please rename the component in the editor before saving.`,
        'Name Conflict',
        { type: 'error' }
      )
      return
    }

    const oldNameForMerge = isAppending ? undefined : currentName

    const mergedModel = mergeModelComponents(
      existingModel,
      currentModel.value,
      newName,
      oldNameForMerge
    )
    if (!mergedModel) throw new Error('Merge operation returned empty string.')

    trackEvent('editor_action', {
      category: 'Editor',
      action: applyToAll.value ? 'save_all' : 'save_single',
      label: newName,
      file_type: 'cellml',
    })

    emit('save', {
      nodeId: props.nodeData.nodeId,
      scope: applyToAll.value ? 'all' : 'single',
      model: mergedModel,
      componentType: newName,
      componentFile: USER_MODULES_FILE,
      originalComponentType: currentName,
      originalComponentFile: props.nodeData.componentFile,
      originalConfigIndex: props.nodeData.configIndex,
    })

    emit('update:modelValue', false)
  } catch (error) {
    console.error(error)
    ElMessageBox.alert(`Failed to save changes: ${error.message}`, 'Save Error', { type: 'error' })
  }
}
</script>

<style scoped>
.editor-container {
  height: 75vh;
  display: flex;
  flex-direction: column;
}

.editor-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tag.internal {
  color: orange;
  font-weight: bold;
}

.tag.user {
  color: green;
  font-weight: bold;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  width: 100%;
}

.apply-all-checkbox {
  margin-right: auto;
  font-size: 13px;
}

.footer-buttons {
  display: flex;
  gap: 8px;
}
</style>
