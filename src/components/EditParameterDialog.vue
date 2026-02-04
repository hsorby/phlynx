<template>
  <el-dialog
    :model-value="modelValue"
    title="Edit Parameters"
    width="600px"
    @closed="closeDialog"
    teleported
  >
    <div v-if="!variableList" class="error-state">
      <el-alert title="CellML component not found in available modules." type="error" :closable="false" show-icon />
    </div>

    <el-table v-else :data="parameterRows" style="width: 100%" max-height="400">
      <el-table-column prop="name" label="Variable" />
      <el-table-column prop="value" label="Value">
        <template #default="scope">
          <el-input v-model="scope.row.value" placeholder="Enter value..."/>
        </template>
      </el-table-column>
      <el-table-column prop="units" label="Units" width="120" />
      <el-table-column prop="type" label="Type" width="120">
        <el-select v-model="test">
          <el-option v-for="types in parameterTypeOptions" :key="types.value" :label="types.label" :value="types.value" />
        </el-select>
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
    value: 'variable',
    label: 'variable',
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

/**
 * Initialize rows when dialog opens
 */
watch(
  () => [props.modelValue, variableList.value],
  ([isVisible, variables]) => {
    if (!isVisible) {
      parameterRows.value = []
      return
    }
    // Get current saved parameters for this specific module/file
    // const savedParams = builderStore.getParametersForModule(props.sourceFile)
    
    // Build rows based on the module's variable port options 
    // (Assuming portOptions contains the variable metadata from cellml.js)
    parameterRows.value = (variables).map(variable => {
      const instanceVariableName = variable.name + '_' + props.instanceName // will need to do something else global 
      return {
        name: variable.name,
        units: variable.units,
        value: builderStore.getParameterValuesForInstanceVariables(instanceVariableName), 
        // type: 'variable', // Default type; could be enhanced to load existing type
      }
    })
  },
  { immediate: true }
)

function closeDialog() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  // Format data to match the expected parameter file structure in builderStore
  // const payload = parameterRows.value
  //   .filter(row => row.value.trim() !== '')
  //   .map(row => ({
  //     variable_name: row.name,
  //     value: row.value,
  //     units: row.units
  //   }))

  // // Note: builderStore.addParameterFile handles the Map storage
  // // We use the sourceFile as the key to link these parameters to the module
  // const paramFileName = `${props.sourceFile}.params.json`
  // builderStore.addParameterFile(paramFileName, payload)
  
  // // Link this file to the module if not already linked
  // const linkMap = new Map(builderStore.moduleParameterMap)
  // linkMap.set(props.sourceFile, paramFileName)
  // builderStore.applyParameterLinks(linkMap)

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