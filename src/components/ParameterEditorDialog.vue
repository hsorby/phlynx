<template>
  <Dialog
    v-model:visible="dialogVisible"
    modal
    :closable="!isLoading"
    :dismissableMask="!isLoading"
    :style="{ width: '800px', maxWidth: '95vw' }"
  >
    <div class="dialog-body">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-content">
          <img :src="phlynxspinner" alt="Loading" class="loading-spinner" />
          <span>{{ loadingText }}</span>
        </div>
      </div>

      <template v-if="hasVariables">
        <div class="toolbar-row">
          <div class="search-group">
            <InputText
              v-model="searchQuery"
              :placeholder="`Search by variable ${searchColumn} ...`"
              class="search-input"
            />
            <Button v-if="searchQuery" icon="pi pi-times" text rounded severity="secondary" @click="searchQuery = ''" />
          </div>

          <Select
            v-model="searchColumn"
            :options="searchColumnOptions"
            optionLabel="label"
            optionValue="value"
            class="search-column"
          />
        </div>

        <div class="bulk-controls">
          <span>Bulk Update Type:</span>
          <Select
            v-model="bulkTypeValue"
            :options="PARAMETER_TYPE_OPTIONS"
            optionLabel="label"
            optionValue="value"
            placeholder="Select type..."
            class="bulk-select"
          />
          <Button :disabled="selectedRows.length === 0" @click="applyBulkType">
            Apply to {{ selectedRows.length }} selected
          </Button>
        </div>

        <DataTable
          ref="parametersTable"
          v-model:selection="selectedRows"
          :value="filteredParameterRows"
          selectionMode="multiple"
          dataKey="name"
          scrollable
          scrollHeight="400px"
          tableStyle="min-width: 100%"
          :sortField="sortField"
          :sortOrder="sortOrder"
          @sort="handleSortChange"
        >
          <Column selectionMode="multiple" headerStyle="width: 3rem" />
          <Column field="name" header="Variable" sortable style="width: 180px" />

          <Column field="value" header="Value" sortable style="min-width: 220px">
            <template #body="slotProps">
              <InputText
                v-if="isEditableVariableType(slotProps.data.type)"
                v-model="slotProps.data.value"
                placeholder="Enter value..."
                class="w-full"
              />
              <span v-else>-</span>
            </template>
          </Column>

          <Column field="units" header="Units" sortable style="width: 150px" />

          <Column field="type" header="Type" sortable style="width: 220px">
            <template #body="slotProps">
              <Select
                v-model="slotProps.data.type"
                :options="PARAMETER_TYPE_OPTIONS"
                optionLabel="label"
                optionValue="value"
                class="w-full"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button severity="primary" @click="handleConfirm">Save Parameters</Button>
        <Button severity="secondary" outlined @click="closeDialog">Cancel</Button>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useVueFlow } from '@vue-flow/core'
import { PARAMETER_TYPE_OPTIONS } from '../utils/constants'

import { useAppConfirm } from '../composables/useConfirmDialog'
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

const emit = defineEmits(['update:modelValue', 'save'])

const searchColumn = ref('name')
const searchColumnOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Units', value: 'units' },
  { label: 'Type', value: 'type' },
]
const searchQuery = ref('')
const libraryStore = useLibraryStore()
const isLoading = ref(false)
const loadingText = ref('Loading parameters...')
const hasVariables = ref(false)
const parametersTable = ref(null)
const parameterRows = ref([])
const selectedRows = ref([])
const bulkTypeValue = ref('')
const sortField = ref('type')
const sortOrder = ref(1)
const { confirm } = useAppConfirm()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

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

function sortParameterRows(field = 'type', order = 1) {
  parameterRows.value.sort((a, b) => {
    let result = 0
    const valA = String(a[field] || '').toLowerCase()
    const valB = String(b[field] || '').toLowerCase()
    result = valA.localeCompare(valB)

    if (result !== 0) {
      return order === 1 ? result : -result
    }

    return a.name.localeCompare(b.name)
  })
}

function loadData() {
  parameterRows.value = props.variables.map((row) => {
    const displayValue = row.type === 'global_constant' ? libraryStore.getGlobalConstant(row.name)?.value : row.value

    return {
      name: row.name,
      value: displayValue,
      units: row.units,
      type: row.type,
      access: row.access,
    }
  })

  sortParameterRows('type', 1)
  sortField.value = 'type'
  sortOrder.value = 1
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

  parametersTable.value?.clearSelection()
  selectedRows.value = []
  bulkTypeValue.value = ''
}

/**
 * Handle manual sorting.
 */
function handleSortChange(event) {
  const field = event?.sortField || 'type'
  const order = event?.sortOrder === -1 ? -1 : 1

  sortField.value = field
  sortOrder.value = order
  sortParameterRows(field, order)
}

function closeDialog() {
  emit('update:modelValue', false)
}

async function handleConfirm() {
  // Check if user has selections and a bulk type chosen but hasn't applied
  if (selectedRows.value.length > 0 && bulkTypeValue.value) {
    const proceed = await confirm({
      header: 'Unapplied Bulk Changes',
      message: `You have ${selectedRows.value.length} row(s) selected with bulk type "${bulkTypeValue.value}" that hasn't been applied. Do you want to continue without applying these changes?`,
      severity: 'warning',
      acceptLabel: 'Save Without Applying',
      rejectLabel: 'Go Back',
    })

    if (!proceed) {
      return // User chose to go back, so exit the function without saving.
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
.dialog-body {
  position: relative;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
}

.loading-spinner {
  width: 48px;
  height: 48px;
}

.toolbar-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.search-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.search-input {
  flex: 1;
}

.search-column,
.bulk-select {
  width: 140px;
}

.bulk-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
