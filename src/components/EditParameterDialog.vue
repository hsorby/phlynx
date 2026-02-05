<template>
  <el-dialog
    :model-value="modelValue"
    title="Edit Parameters"
    width="850px"
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
        <el-table :data="filteredParameterRows" style="width: 100%" max-height="400">
          <el-table-column prop="name" label="Variable" width="180" sortable :sort-method="sortByAmbiguity" />

          <el-table-column label="Value" min-width="250" sortable>
            <template #default="scope">
              <el-input v-if="scope.row.type === 'variable'" v-model="scope.row.value" disabled placeholder="-" />

              <div v-else-if="scope.row.isAmbiguous" class="ambiguous-container">
                <el-select
                  v-model="scope.row.value"
                  placeholder="Select value..."
                  class="ambiguous-select"
                  filterable
                  allow-create
                  default-first-option
                  @change="handleAmbiguitySelection(scope.row)"
                >
                  <el-option v-for="opt in scope.row.valueOptions" :key="opt" :label="opt" :value="opt" />
                </el-select>
                <el-tooltip content="Multiple values found for this variable name and unit. Please select one.">
                  <el-icon class="warning-icon"><Warning /></el-icon>
                </el-tooltip>
              </div>

              <el-input v-else v-model="scope.row.value" placeholder="Enter value..." />
            </template>
          </el-table-column>

          <el-table-column prop="units" label="Units" width="150" sortable />

          <el-table-column prop="type" label="Type" width="200" sortable>
            <template #default="scope">
              <el-select v-model="scope.row.type" @change="handleTypeChange(scope.row)">
                <el-option
                  v-for="types in parameterTypeOptions"
                  :key="types.value"
                  :label="types.label"
                  :value="types.value"
                />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </template>
      <div v-else class="error-state">
        <el-alert title="CellML component not found in available modules." type="error" :closable="false" show-icon />
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm" :disabled="!hasVariables"> Save Parameters </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, h } from 'vue'
import { Warning } from '@element-plus/icons-vue'
import { useBuilderStore } from '../stores/builderStore'
import { extractVariablesFromModule } from '../utils/cellml'
import phlynxspinner from '/src/assets/phlynxspinner.svg?raw'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  instanceName: { type: String, required: true },
  nodeId: { type: String, required: true },
  sourceFile: { type: String, required: true },
  componentName: { type: String, required: true },
})

const emit = defineEmits(['update:modelValue'])

const searchColumn = ref('name')
const searchQuery = ref('')
const builderStore = useBuilderStore()
const parameterRows = ref([])
const isLoading = ref(false)
const loadingText = ref('Loading parameters...')
const hasVariables = ref(false)

const parameterTypeOptions = [
  { value: 'constant', label: 'constant' },
  { value: 'global_constant', label: 'global_constant' },
  { value: 'variable', label: 'variable' },
  { value: 'boundary_condition', label: 'boundary_condition' },
]

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

// Helper to look up values and detect ambiguity
function resolveValue(name, type, units) {
  if (type === 'variable' || type === 'boundary_condition') {
    return { value: '-', isAmbiguous: false, options: [] }
  }

  // Determine lookup key based on type
  const lookupName = name + (type === 'global_constant' ? '' : '_' + props.instanceName)

  const assignedValue = builderStore.getAssignedParameterValueForInstanceVariable(lookupName)
  if (assignedValue) {
    return { value: assignedValue.value, isAmbiguous: false, options: [] }
  }
  // Get all raw matches from store
  const allMatches = builderStore.getParameterValuesForInstanceVariable(lookupName) || []

  // We only care about values that were stored with the same units as the current variable
  const relevantMatches = allMatches.filter((match) => match?.units === units)

  // Extract unique values to avoid duplicates in dropdown
  // (e.g. if 3 modules all use T=310 Kelvin, we just show 310 once)
  const uniqueValues = [...new Set(relevantMatches.map((m) => m.value))]

  if (uniqueValues.length > 1) {
    return {
      value: '', // Force user to choose
      isAmbiguous: true,
      options: uniqueValues,
    }
  } else if (uniqueValues.length === 1) {
    return {
      value: uniqueValues[0],
      isAmbiguous: false,
      options: [],
    }
  }

  return { value: '', isAmbiguous: false, options: [] }
}

function loadData() {
  const modelString = builderStore.getModuleContent(props.sourceFile)

  // This is the heavy line:
  const variables = Array.from(extractVariablesFromModule(modelString, props.componentName))

  if (!variables || variables.length === 0) {
    hasVariables.value = false
    return
  }
  const module = builderStore.getModulesModule(props.sourceFile, props.componentName)

  // Create a map for fast config lookup
  // Structure of configs: [name, units, accessability, type]
  const variablesAndUnits = module.configs[0].variables_and_units
  const configMap = new Map(variablesAndUnits.map((arr) => [arr[0], arr]))

  console.log('Extracted variables for parameter editing:', variables)
  parameterRows.value = variables
    .map((variable) => {
      const configData = configMap.get(variable.name)
      // Default to 'variable' if not found in config
      const initialType = configData ? configData[3] : 'variable'

      const result = resolveValue(variable.name, initialType, variable.units)

      return {
        name: variable.name,
        units: variable.units,
        type: initialType,
        value: result.value,
        isAmbiguous: result.isAmbiguous,
        valueOptions: result.options,
      }
    })
    .sort((a, b) => a.type.localeCompare(b.type))
}
// Initialize rows when dialog opens
watch(
  () => props.modelValue,
  async (isOpen) => {
    parameterRows.value = []
    if (isOpen) {
      isLoading.value = true
      hasVariables.value = true

      await new Promise((resolve) => setTimeout(resolve, 50))

      try {
        loadData()
      } finally {
        isLoading.value = false
      }
    }
  }
)

function handleAmbiguitySelection(row) {
  row.isAmbiguous = false
}

// Handle type change re-triggers lookup
function handleTypeChange(row) {
  const result = resolveValue(row.name, row.type, row.units)

  row.value = result.value
  row.isAmbiguous = result.isAmbiguous
  row.valueOptions = result.options
}

function sortByAmbiguity(a, b) {
  // If A is ambiguous and B is not, A comes first
  if (a.isAmbiguous && !b.isAmbiguous) return -1
  if (!a.isAmbiguous && b.isAmbiguous) return 1

  // If both are same status, sort alphabetically by name
  const valA = a.name || ''
  const valB = b.name || ''
  return valA.localeCompare(valB)
}

function closeDialog() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  parameterRows.value.forEach((row) => {
    // Only save if it's a parameter type and has a value
    if (row.type !== 'variable' && row.type !== 'boundary_condition' && row.value) {
      const isGlobal = row.type === 'global_constant'
      const storageName = row.name + (isGlobal ? '' : '_' + props.instanceName)

      // We pass the units too, ensuring the store saves it correctly for future filtering
      builderStore.assignInstanceVariableParameterValue(storageName, row.value, row.units, isGlobal)
    }
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
