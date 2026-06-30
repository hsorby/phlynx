<template>
  <el-dialog :model-value="modelValue" title="Edit Module Instance" width="800px" teleported @closed="resetForm"
    @update:model-value="closeDialog" @mousedown.stop @wheel.stop>
    <el-form :model="editableData" label-position="left" @submit.prevent="handleConfirm">
      <el-form-item label="Instance Name">
        <el-input v-model="editableData.name" placeholder="Enter instance name" />
      </el-form-item>

     <el-divider />

      <label class="el-form-label">Ports:</label>
      <el-table
        :data="editableData.ports"
        style="width: 100%; margin-top: 10px"
        empty-text="No port labels added"
      >
        <!-- Type -->
        <el-table-column label="Type" width="80">
          <template #default="scope">
            <el-select v-model="scope.row.portType" size="small">
              <el-option
                v-for="option in PORT_TYPE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </template>
        </el-table-column>

        <!-- Label -->
        <el-table-column label="Label" width="250">
          <template #default="scope">
            <el-input
              v-model="scope.row.label"
              size="small"
              placeholder="Enter label"
            />
          </template>
        </el-table-column>

        <!-- Variables -->
        <el-table-column label="Variable(s)" min-width="150">
          <template #default="scope">
            <el-select
              v-model="scope.row.variables"
              multiple
              collapse-tags
              collapse-tags-tooltip
              size="small"
              placeholder="Select variables"
              style="width: 100%"
            >
              <el-option
                v-for="variable in props.variables"
                :key="variable.name"
                :label="variable.name"
                :value="variable.name"
                :disabled="isVariableDisabled(variable.name, scope.row.variables)"
              />
            </el-select>
          </template>
        </el-table-column>

        <!-- Multiport -->
        <el-table-column label="Multiport" width="100">
          <template #default="scope">
            <div style="display: flex; flex-direction: column; gap: 5px">
              <el-select
                v-model="scope.row.multiportType"
                size="small"
                placeholder="Select"
                style="width: 100%"
              >
                <el-option
                  v-for="option in multiportOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                  :disabled="option.value === 'Sum' && scope.row.option?.length > 1"
                />
              </el-select>
              <div
                v-if="scope.row.multiport === 'Multiply'"
                style="display: flex; align-items: center; gap: 5px"
              >
                <span class="multiply-prefix">&times;</span>
                <el-input-number
                  v-model="scope.row.multiplyFactor"
                  :controls="false"
                  size="small"
                  placeholder="1"
                  style="width: 100%"
                />
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- Delete -->
        <el-table-column label="" width="60" align="center">
          <template #default="scope">
            <el-button
              type="danger"
              :icon="Delete"
              circle
              plain
              size="small"
              @click="deletePort(scope.$index)"
            />
          </template>
        </el-table-column>
      </el-table>

      <!-- Add Button -->
      <div style="margin-top: 12px">
        <el-tooltip content="Add Port Label" placement="bottom" :show-after="1000">
          <el-button
            type="success"
            :icon="Plus"
            plain
            circle
            @click="addPort"
          />
        </el-tooltip>
      </div>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button type="primary" @click="handleConfirm"> Confirm </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput, ElButton, ElInputNumber } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import { useGtm } from '../composables/useGtm'
import { notify } from '../utils/notify'
import { sanitiseName } from '../utils/nodes'
import { detachReactivity } from '../utils/reactivity'
import { PORT_TYPE_OPTIONS, multiportOptions } from '../utils/constants'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  nodeId: {
    type: String,
    default: '',
  },
  initialName: {
    type: String,
    default: '',
  },
  variables: {
    type: Array,
    default: () => [],
  },
  initialPorts: { 
    type: Array,
    default: () => [],
  },
  existingNames: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'update:modelValue', // Required for v-model
  'confirm', // Emits the new data
])

const editableData = reactive({
  name: '',
  ports: [], // Will hold objects like { variable: 'var_a', label: 'label_1' }
})

const { trackEvent } = useGtm()

function resetForm() {
  editableData.name = props.initialName
  editableData.ports = detachReactivity(props.initialPorts || [])
}

function closeDialog() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  if (!editableData.name || !editableData.name.trim()) {
    notify.error({ message: 'Instance name cannot be empty.' })
    return
  }

  const sanitisedName = sanitiseName(editableData.name)
  if (!sanitisedName) {
    notify.error({ message: 'Instance name is invalid.' })
    return
  }
  editableData.name = sanitisedName

  const nameExists = props.existingNames.some(
    (name) => name === editableData.name && name !== props.initialName
  )
  
  if (nameExists) {
    notify.error({ message: 'An instance with this name already exists.' })
    return
  }

  const finalPorts = editableData.ports.filter(
    (p) => p.variables && p.label && p.label.trim()
  )

  const invalidFactor = finalPorts.find(
    (p) => p.multiportType === 'Multiply' && (isEmpty(p.multiplyFactor))
  )
  
  if (invalidFactor) {
    notify.error({ message: `Port "${invalidFactor.label}" has Multiply selected but the scale factor is missing or zero.` })
    return
  }

  trackEvent('edit_module_action', {
    category: 'EditModule',
    action: 'edit_module',
    label: editableData.name, 
    file_type: 'JSON'
  })
  
  emit('confirm', {
    name: editableData.name,
    nodeId: props.nodeId,
    ports: finalPorts,
  })

  closeDialog()
}

watch(
  () => [props.initialName, , props.initialPorts, props.modelValue],
  () => {
    if (props.modelValue) {
      resetForm()
    }
  },
  { deep: true, immediate: true }
)

watch(
  () => editableData.ports.map(p => p.variable),
  (newVariables) => {
    newVariables.forEach((varName, i) => {
      if (varName?.length > 1 && editableData.ports[i].multiportType === 'Sum') {
        editableData.ports[i].multiportType = 'None'
      }
    })
  },
  { deep: true }
)

watch(
  () => editableData.ports.map(p => p.multiportType),
  (newMultiports) => {
    newMultiports.forEach((mp, i) => {
      if (mp !== 'Multiply') {
        editableData.ports[i].multiplyFactor = 1
      }
    })
  },
  { deep: true }
)

const usedVariables = computed(() => {
  return new Set(
    editableData.ports
      .map((p) => p.variable)
      .filter(Boolean)
      .flat()
  )
})

function isVariableDisabled(variableName, currentSelection) {
  // Disable if:
  // 1. It's in the usedVariables Set
  // 2. And it's NOT an variable this row already has selected

  // FIXME: Disabling for now as circ auto configs have multiple ports with same variable options, and this logic would prevent that. We can revisit if we want to enforce unique variable options across ports in the future.
  // return (usedVariables.value.has(optionName) && currentSelection.includes(optionName) === false)
  return false
}

function addPort() {
  editableData.ports.push({
    portType: 'general_ports',
    variable: '',
    label: '',
    multiportType: 'None',
    multiplyFactor: 1,
  })
}

function deletePort(index) {
  editableData.ports.splice(index, 1)
}
</script>

<style scoped>
.el-form-item {
  margin-bottom: 15px;
}

.el-form-label {
  font-weight: 600;
  margin-bottom: 12px;
  font-size: 16px;
  display: block;
}

.multiply-prefix {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-info);
}
</style>