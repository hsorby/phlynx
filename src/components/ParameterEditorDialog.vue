<template>
  <el-dialog
    :model-value="modelValue"
    title="Edit Parameters"
    width="800px"
    @closed="closeDialog"
    teleported
    :close-on-click-modal="!isLoading"
    :close-on-press-escape="!isLoading"
    :show-close="!isLoading"
  >
    <div
      v-loading="isLoading"
      :element-loading-text="loadingText"
      :element-loading-svg="phlynxspinner"
      element-loading-svg-view-box="0, 0, 100, 100"
      element-loading-background="var(--el-mask-color-extra-light)"
    >
      <template v-if="hasVariables">
        <el-input
          v-model="searchQuery"
          :placeholder="`Search by variable ${searchColumn} ...`"
          clearable
          style="margin-bottom: 12px"
          ><template #append>
            <el-select v-model="searchColumn" style="width: 100px">
              <el-option label="Name" value="name" />
              <el-option label="Units" value="units" />
              <el-option label="Type" value="type" /> </el-select></template
        ></el-input>
        <div style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center">
          <span>Bulk Update Type:</span>
          <el-select v-model="bulkTypeValue" placeholder="Select type..." style="width: 200px">
            <el-option
              v-for="types in PARAMETER_TYPE_OPTIONS"
              :key="types.value"
              :label="types.label"
              :value="types.value"
            />
          </el-select>
          <el-button type="primary" :disabled="selectedRows.length === 0" @click="applyBulkType">
            Apply to {{ selectedRows.length }} selected
          </el-button>
        </div>
        <el-table
          ref="parametersTable"
          :data="filteredParameterRows"
          style="width: 100%"
          max-height="400"
          :default-sort="{ prop: 'value', order: 'ascending' }"
          @sort-change="handleSortChange"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="name" label="Variable" width="180" sortable="custom" />

          <el-table-column prop="value" label="Value" min-width="50" sortable="custom">
            <template #default="scope">
              <el-input
                v-if="isEditableVariableType(scope.row.type)"
                v-model="scope.row.value"
                placeholder="Enter value..."
              />
              <el-input 
                v-else 
                model-value="-"
                disabled 
              />
            </template>
          </el-table-column>

          <el-table-column prop="units" label="Units" width="150" sortable="custom" />

          <el-table-column prop="type" label="Type" width="200" sortable="custom">
            <template #default="scope">
              <el-select v-model="scope.row.type" @change="handleTypeChange(scope.row)">
                <el-option
                  v-for="types in PARAMETER_TYPE_OPTIONS"
                  :key="types.value"
                  :label="types.label"
                  :value="types.value"
                />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleConfirm" type="primary">
          Save Parameters
        </el-button>
        <el-button @click="closeDialog">
          Cancel
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, h } from 'vue'
import {
  ElDialog,
  ElInput,
  ElTable,
  ElTableColumn,
  ElSelect,
  ElOption,
  ElButton,
  ElAlert,
  ElTooltip,
  ElMessageBox,
} from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { useVueFlow } from '@vue-flow/core'
import { PARAMETER_TYPE_OPTIONS } from '../utils/constants'

import { useLibraryStore } from '../stores/libraryStore'
import { isEditableVariableType } from '../utils/variables'
import phlynxspinner from '/src/assets/phlynxspinner.svg?raw'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  id: {
    type: String,
    default: '',
  },
  variables: {
    type: Array,
    default: () => [],
  }, 
})

const emit = defineEmits([
  'update:modelValue',
  'save',
])

const searchColumn = ref('name')
const searchQuery = ref('')
const libraryStore = useLibraryStore()
const isLoading = ref(false)
const loadingText = ref('Loading parameters...')
const hasVariables = ref(false)
const parametersTable = ref(null)
const parameterRows = ref([])
const selectedRows = ref([])
const bulkTypeValue = ref('')

const filteredParameterRows = computed(() => {
  if (!searchQuery.value.trim()) {
    return parameterRows.value
  }

  const query = searchQuery.value.toLowerCase()
  const columnKey = searchColumn.value // 'name', 'units', or 'type'

  return parameterRows.value.filter((row) => {
    // Get the value of the selected column safely.
    const targetValue = String(row[columnKey] || '').toLowerCase()

    // Check for match.
    return targetValue.includes(query)
  })
})

function loadData() {
  parametersTable.value.clearSort() // Clear any existing sort state
  parameterRows.value = props.variables.map((row) => {
    const displayValue =
      row.type === 'global_constant' ? libraryStore.getGlobalConstant(row.name)?.value : row.value

    return {
      name: row.name,
      value: displayValue,
      units: row.units,
      type: row.type,
      access: row.access,
    }
  })

  handleSortChange({ prop: 'type', order: 'ascending' }, true)
}

// Initialize rows when dialog opens
watch(
  () => props.modelValue,
  async (isOpen) => {
    parameterRows.value = []
    if (isOpen) {
      isLoading.value = true
      hasVariables.value = true
      selectedRows.value = []
      bulkTypeValue.value = ''

      await new Promise((resolve) => setTimeout(resolve, 50))

      try {
        loadData()
      } finally {
        isLoading.value = false
      }
    }
  }
)

function handleSelectionChange(selection) {
  selectedRows.value = selection
}

function applyBulkType() {
  if (!bulkTypeValue.value || selectedRows.value.length === 0) return

  selectedRows.value.forEach((row) => {
    row.type = bulkTypeValue.value
  })
  
  // Clear selections and bulk type after applying
  parametersTable.value.clearSelection()
  bulkTypeValue.value = ''
}

/**
 * Handle manual sorting.
 */
function handleSortChange({ prop, order }) {
  if (!order) {
    prop = 'type' // Default sort by Type when user cancels sorting
    order = 'ascending'
  }

  parameterRows.value.sort((a, b) => {
    let result = 0
    const valA = String(a[prop] || '').toLowerCase()
    const valB = String(b[prop] || '').toLowerCase()
    result = valA.localeCompare(valB)

    // If the primary values are DIFFERENT, respect the user's sort direction (Asc/Desc)
    if (result !== 0) {
      return order === 'ascending' ? result : -result
    }

    // If primary values are SAME (e.g. both are 'Constant'), sort by Name.
    // We force this to be Ascending (A-Z) for readability,
    // regardless of the primary column's sort direction.
    return a.name.localeCompare(b.name)
  })
}

function closeDialog() {
  emit('update:modelValue', false)
}

async function handleConfirm() {
  // Check if user has selections and a bulk type chosen but hasn't applied
  if (selectedRows.value.length > 0 && bulkTypeValue.value) {
    try {
      await ElMessageBox.confirm(
        `You have ${selectedRows.value.length} row(s) selected with bulk type "${bulkTypeValue.value}" that hasn't been applied. Do you want to continue without applying these changes?`,
        'Unapplied Bulk Changes',
        {
          confirmButtonText: 'Save Without Applying',
          cancelButtonText: 'Go Back',
          type: 'warning',
        }
      )
    } catch {
      // User clicked "Go Back" or closed the dialog
      return
    }
  }

  parameterRows.value.forEach((row) => {
    if (row.type === 'global_constant') {
      libraryStore.assignGlobalConstant(row.name, row.value, row.units, row.data_reference) 
    }
  })

  emit('save', {
    id: props.id,
    variables: parameterRows.value,
  })
  
  closeDialog()
}
</script>

<style scoped>
.error-state {
  padding: 20px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.ambiguous-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ambiguous-select {
  flex-grow: 1;
}

.warning-icon {
  color: var(--el-color-warning);
  font-size: 18px;
  cursor: help;
}
</style>