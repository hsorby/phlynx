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
          :key="mathRef"
          :model-value="currentModel"
          @update:code="currentModel = $event"
          @ready="handleEditorReady"
          @save="handleSave('key')"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <!-- "Apply to all" checkbox — only shown when sibling nodes exist -->
        <el-tooltip
          v-if="siblingCount > 0"
          :content="`Also update ${siblingCount} other node${siblingCount !== 1 ? 's' : ''} using ${componentName} from ${componentFile}`"
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
  nodeId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    default: '',
  },
  mathRef: {
    type: String,
    required: true,
  },
  variables: {
    type: Array,
    required: true,
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
  return props.mathRef?.split(":")[0]
})

const componentName = computed(() => {
  return props.mathRef?.split(":")[1]
})

const isDirty = computed(() => {
  return !areModelsEquivalent(originalModel.value, currentModel.value)
})

const dialogTitle = computed(() => {
  return `Editing: ${props.name} (${componentName.value} - ${componentFile.value})`
})

/**
 * Count of other nodes sharing the same componentFile AND componentType.
 * Nodes from a different componentFile are never included, even if the component
 * name happens to match.
 */
const siblingCount = computed(() => {
  return siblings.value.length
})

const siblings = computed(() => {
  if (!componentName.value || !componentFile.value) return 0

  return nodes.value
    .filter((n) =>
      n.id !== props.nodeId &&
      n.data?.mathRef === props.mathRef
    )
    .map((n) => n.id)
})

// Reset checkbox when dialog opens for a new node.
watch(() => props.modelValue, () => { applyToAll.value = false })

// ── Load content when dialog opens ──────────────────────────────────────────

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen && props.mathRef) {
      loading.value = true
      try {
        const math = await store.availableMath.get(props.mathRef) 
        currentModel.value = math
        originalModel.value = math
      } catch (e) {
        console.error('Failed to load source', e)
      } finally {
        loading.value = false
      }
    }
  }
)

// Called once by CellMLTextEditor after it mounts, with the canonical
// (round-tripped) form of the model it was given, so
// isDirty only ever reflects genuine edits, not incidental differences
// between the raw stored form and whatever the editor's own pipeline
// produces for identical content.
const handleEditorReady = (canonicalMath) => {
  currentModel.value = canonicalMath
  originalModel.value = canonicalMath
}

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
  const newComponentName = componentNames[0].trim()
  const newMathRef = `${componentFile.value}:${newComponentName}`

  try {
    const mathRefExists = store.availableMath.has(newMathRef)
    if (mathRefExists) {
      ElMessageBox.alert( 
        `Name clash detected, please rename the component in the editor before saving.`,
        'Name Conflict',
        { type: 'error' }
      )
      return
    } else {
      store.addMath(newMathRef, currentModel.value)
    }

    //   - scope 'single' with siblings: create new mathRef and update current instance
    //   - scope 'all': update math at mathRef and update mathRef (if needed)
    const updateAll = (siblingCount.value > 0 && applyToAll.value) || siblingCount.value === 0

    trackEvent('editor_action', {
      category: 'Editor',
      action: updateAll ? 'save_all' : 'save_single',
      label: newComponentName,
      file_type: 'cellml',
    })

    emit('save', {
      updateAll,
      mathRef: newMathRef,
      math: currentModel.value,
      nodeId: props.nodeId,
      siblings: updateAll ? siblings.value : undefined,
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
