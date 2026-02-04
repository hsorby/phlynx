<template>
  <el-dialog :model-value="modelValue" title="Edit Parameters" width="780px" @closed="closeDialog" teleported>
    <div v-if="!variableList" class="error-state">
      <el-alert title="CellML component not found in available modules." type="error" :closable="false" show-icon />
    </div>

    <el-table v-else :data="parameterRows" style="width: 100%" max-height="400">
      <el-table-column prop="name" label="Variable" width="200"/>
      <el-table-column prop="value" label="Value">
        <template #default="scope">
          <el-input v-model="scope.row.value" placeholder="Enter value..." :disabled="scope.row.type === 'variable'" />
        </template>
      </el-table-column>
      <el-table-column prop="units" label="Units" width="200"/>
      <el-table-column prop="type" label="Type" width="200">
        <template #default="scope">
          <el-select v-model="scope.row.type" @change="handleTypeChange(scope.row)">
            <el-option v-for="types in parameterTypeOptions" :key="types.value" :label="types.label"
              :value="types.value" />
          </el-select>
        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm" :disabled="!variableList">
          Save Parameters
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useBuilderStore } from '../stores/builderStore'
import { extractVariablesFromModule } from '../utils/cellml'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  // Name of an instantiation of a CellML module
  instanceName: {
    type: String,
    required: true,
  },
  // Internal name of the node associated with this module
  nodeId: {
    type: String,
    required: true,
  },
  // CellML file containing the definition of the module
  sourceFile: {
    type: String,
    required: true,
  },
  // CellML module 
  componentName: {
    type: String,
    required: true,
  },
})

const emit = defineEmits([
  'update:modelValue',
  'confirm',
])

const builderStore = useBuilderStore()

const parameterTypeOptions = [
  {
    value: 'constant',
    label: 'constant',
  },
  {
    value: 'global_constant',
    label: 'global_constant',
  },
  {
    value: 'variable',
    label: 'variable',
  },
  {
    value: 'boundary_condition',
    label: 'boundary_condition',
  },
]

/**
 * Locate the module definition using the builderStore
 */
const variableList = computed(() => {
  const modelString = builderStore.getModuleContent(props.sourceFile)
  return Array.from(extractVariablesFromModule(modelString, props.componentName))
})

const parameterRows = ref([])

// Initialize rows when dialog opens
watch(
  () => [props.modelValue, variableList.value],
  ([isVisible, variables]) => {
    if (!isVisible) {
      parameterRows.value = []
      return
    }

    const module = builderStore.getModulesModule(props.sourceFile, props.componentName)
    const variablesAndUnits = module.configs[0].variables_and_units
    
    const variableMap = new Map(
      variablesAndUnits.map(arr => [arr[0], arr])
    )

    parameterRows.value = (variables).map(variable => {
      const instanceVariableName = variable.name + '_' + props.instanceName
      const storedValue = builderStore.getParameterValueForInstanceVariable(instanceVariableName)

      const configData = variableMap.get(variable.name)
      const parameterType = configData ? configData[3] : 'variable'

      return {
        name: variable.name,
        units: variable.units,
        value: parameterType === 'variable' ? '-' : (storedValue || ''),
        type: parameterType,
      }
    }).sort((a, b) => a.type.localeCompare(b.type))
  },
  { immediate: true }
)

// Handle type change
function handleTypeChange(row) {
  const instanceVariableName = row.name + '_' + props.instanceName

  if (row.type === 'variable') {
    row.value = '-'
  } else {
    const storedValue = builderStore.getParameterValueForInstanceVariable(instanceVariableName)
    row.value = storedValue || ''
  }
}

function closeDialog() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  parameterRows.value.forEach(row => {
    if (row.type === 'constant') {
      const instanceVariableName = row.name + '_' + props.instanceName
      builderStore.setParameterValueForInstanceVariable(instanceVariableName, row.value)
    } else if (row.type === 'global_constant') {
      const instanceVariableName = row.name
      builderStore.setParameterValueForInstanceVariable(instanceVariableName, row.value)
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
</style>