<template>
  <Dialog
    :visible="modelValue"
    header="Simulation Settings"
    modal
    :draggable="false"
    :style="{ width: '1040px', maxHeight: '90vh' }"
    :appendTo="'body'"
    @update:visible="
      (visible) => {
        if (!visible) closeDialog()
      }
    "
  >
    <div class="dialog-content">
      <div v-if="isLoading" class="loading-state">
        <ProgressSpinner style="width: 44px; height: 44px" strokeWidth="4" />
        <div class="loading-text">
          <strong>Collecting model variables...</strong>
          <span>{{ loadingText }}</span>
        </div>
      </div>

      <TabView v-else v-model:activeIndex="activeTabIndex" class="sim-settings-tabs">
        <TabPanel header="Plot Setup">
          <section class="block">
            <div class="block-header">
              <h4>Variable Visibility</h4>
              <span class="subtle">Choose which variable types are shown in the table.</span>
            </div>
            <div class="type-filters">
              <label v-for="type in variableTypeOptions" :key="type.value" class="type-filter-item">
                <Checkbox v-model="typeFilters[type.value]" binary />
                <span>{{ type.label }}</span>
              </label>
            </div>
          </section>

          <section class="block">
            <div class="block-header">
              <h4>Plot Groups</h4>
              <span class="subtle">Variables in the same group are plotted together.</span>
            </div>
            <div class="group-toolbar">
              <InputText v-model="newGroupName" placeholder="New group name (e.g. Pressure)" class="group-name-input" />
              <Button label="Add Group" icon="pi pi-plus" text @click="addGroup" />
            </div>
            <div class="group-list">
              <div v-for="group in plotGroups" :key="group.id" class="group-chip">
                <span>{{ group.name }}</span>
                <Button
                  icon="pi pi-times"
                  rounded
                  text
                  severity="secondary"
                  size="small"
                  @click="removeGroup(group.id)"
                />
              </div>
            </div>
          </section>

          <section class="block">
            <div class="block-header">
              <h4>Variables To Plot</h4>
              <span class="subtle">{{ visibleRows.length }} shown of {{ variableRows.length }} total</span>
            </div>

            <div class="filter-toolbar" v-if="variableRows.length > 0">
              <Select
                v-model="selectedNode"
                :options="nodeFilterOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Filter by node"
                class="filter-select"
              />
              <!-- <Select
                v-model="selectedVariable"
                :options="variableFilterOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Filter by variable"
                class="filter-select"
              /> -->
              <InputText v-model="nodeSearch" placeholder="Search node name..." class="filter-input" />
              <InputText v-model="variableSearch" placeholder="Search variable name..." class="filter-input" />
              <Button
                label="Reset Filters"
                icon="pi pi-filter-slash"
                text
                severity="secondary"
                @click="resetVariableFilters"
              />
            </div>

            <div class="bulk-toolbar" v-if="visibleRows.length > 0">
              <label class="bulk-select-all">
                <Checkbox :modelValue="allVisibleSelected" binary @update:modelValue="toggleSelectAllVisible" />
                <span>Select all shown</span>
              </label>
              <span class="bulk-count">{{ selectedVisibleCount }} selected</span>
              <Button
                label="Clear Selection"
                icon="pi pi-eraser"
                text
                severity="secondary"
                :disabled="selectedVisibleCount === 0"
                @click="clearSelection"
              />
              <Select
                v-model="bulkGroupId"
                :options="assignGroupOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Assign selected to group"
                class="bulk-group-select"
              />
              <Button
                label="Assign Selected"
                icon="pi pi-check"
                text
                :disabled="selectedVisibleCount === 0 || !bulkGroupId"
                @click="assignSelectedToGroup"
              />
              <Button
                label="Move To Ungrouped"
                icon="pi pi-minus-circle"
                text
                severity="contrast"
                :disabled="selectedVisibleCount === 0"
                @click="moveSelectedToUngrouped"
              />
            </div>

            <div v-if="visibleRows.length === 0" class="empty-state">
              No variables match the current type visibility filters.
            </div>

            <div v-else class="vars-table-wrap">
              <table class="vars-table">
                <thead>
                  <tr>
                    <th style="width: 56px">Sel</th>
                    <th style="width: 70px">Plot</th>
                    <th>Node</th>
                    <th>Variable</th>
                    <th style="width: 170px">Type</th>
                    <th style="width: 120px">Units</th>
                    <th style="width: 250px">Group</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in visibleRows" :key="row.key">
                    <td>
                      <Checkbox v-model="row.selected" binary />
                    </td>
                    <td>
                      <Checkbox v-model="row.plot" binary @change="onPlotToggle(row)" />
                    </td>
                    <td>{{ row.nodeName }}</td>
                    <td>{{ row.variableName }}</td>
                    <td>
                      <Tag :value="row.type" severity="secondary" />
                    </td>
                    <td>{{ row.units || '-' }}</td>
                    <td>
                      <Select
                        v-model="row.groupId"
                        :options="groupOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Select group"
                        :disabled="!row.plot"
                        class="w-full"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </TabPanel>

        <TabPanel header="Simulation Parameters">
          <section class="block">
            <div class="block-header">
              <h4>Simulation Parameters</h4>
              <span class="subtle">Secondary settings passed through to OpenCOR config export.</span>
            </div>
            <div class="settings-grid">
              <div class="field">
                <label>Time Step</label>
                <InputNumber
                  v-model="settingsPayload.timeStep"
                  :min="0"
                  :minFractionDigits="0"
                  :maxFractionDigits="8"
                  fluid
                />
              </div>
              <div class="field">
                <label>Point Interval</label>
                <InputNumber
                  v-model="settingsPayload.pointInterval"
                  :min="0"
                  :minFractionDigits="0"
                  :maxFractionDigits="8"
                  fluid
                />
              </div>
              <div class="field">
                <label>Starting Point</label>
                <InputNumber
                  v-model="settingsPayload.startingPoint"
                  :minFractionDigits="0"
                  :maxFractionDigits="8"
                  fluid
                />
              </div>
              <div class="field">
                <label>Ending Point</label>
                <InputNumber
                  v-model="settingsPayload.endingPoint"
                  :minFractionDigits="0"
                  :maxFractionDigits="8"
                  fluid
                />
              </div>
              <div class="field">
                <label>Solver</label>
                <Select
                  v-model="settingsPayload.solver"
                  :options="solverOptions"
                  optionLabel="label"
                  optionValue="value"
                  fluid
                />
              </div>
              <div class="field">
                <label>Tolerance</label>
                <InputNumber
                  v-model="settingsPayload.tolerance"
                  :min="0"
                  :minFractionDigits="0"
                  :maxFractionDigits="12"
                  fluid
                />
              </div>
              <div class="field">
                <label>Max Steps</label>
                <InputNumber v-model="settingsPayload.maxSteps" :min="1" :useGrouping="false" fluid />
              </div>
            </div>
          </section>
        </TabPanel>
      </TabView>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button label="Cancel" severity="secondary" text @click="closeDialog" />
        <Button label="Save" severity="primary" @click="handleConfirm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import TabPanel from 'primevue/tabpanel'
import TabView from 'primevue/tabview'

import { notify } from '../utils/notify'
import { BASELINE_SIMULATION_SETTINGS } from '../utils/constants'

const props = defineProps({
  modelValue: Boolean,
  simulationSettings: {
    type: Object,
    required: true,
  },
  plotConfig: {
    type: Object,
    default: () => ({}),
  },
  nodes: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const variableTypeOptions = [
  { label: 'Variables', value: 'variable' },
  { label: 'Boundary Conditions', value: 'boundary_condition' },
  { label: 'Constants', value: 'constant' },
  { label: 'Global Constants', value: 'global_constant' },
]

const solverOptions = [
  { label: 'CVODE', value: 'CVODE' },
  { label: 'Euler', value: 'Euler' },
  { label: 'Runge Kutta 4', value: 'RungeKutta4' },
]

const settingsPayload = ref({ ...BASELINE_SIMULATION_SETTINGS })
const variableRows = ref([])
const isLoading = ref(false)
const loadingText = ref('Preparing variable list...')
const newGroupName = ref('')
const plotGroups = ref([])
const bulkGroupId = ref(null)
const selectedNode = ref(null)
const selectedVariable = ref(null)
const nodeSearch = ref('')
const variableSearch = ref('')
const activeTabIndex = ref(0)
let loadCycle = 0

const typeFilters = ref({
  variable: true,
  boundary_condition: true,
  constant: false,
  global_constant: false,
})

const groupOptions = computed(() => {
  const options = [{ label: 'Ungrouped', value: null }]
  for (const group of plotGroups.value) {
    options.push({ label: group.name, value: group.id })
  }
  return options
})

const visibleRows = computed(() => {
  const nodeTerm = nodeSearch.value.trim().toLowerCase()
  const variableTerm = variableSearch.value.trim().toLowerCase()

  return variableRows.value.filter((row) => {
    if (!typeFilters.value[row.type]) return false
    if (selectedNode.value && row.nodeName !== selectedNode.value) return false
    if (selectedVariable.value && row.variableName !== selectedVariable.value) return false
    if (nodeTerm && !row.nodeName.toLowerCase().includes(nodeTerm)) return false
    if (variableTerm && !row.variableName.toLowerCase().includes(variableTerm)) return false
    return true
  })
})

const nodeFilterOptions = computed(() => {
  const unique = new Set(variableRows.value.map((row) => row.nodeName))
  const options = [{ label: 'All nodes', value: null }]
  Array.from(unique)
    .sort((a, b) => a.localeCompare(b))
    .forEach((name) => options.push({ label: name, value: name }))
  return options
})

const variableFilterOptions = computed(() => {
  let pool = variableRows.value
  if (selectedNode.value) {
    pool = pool.filter((row) => row.nodeName === selectedNode.value)
  }

  const unique = new Set(pool.map((row) => row.variableName))
  const options = [{ label: 'All variables', value: null }]
  Array.from(unique)
    .sort((a, b) => a.localeCompare(b))
    .forEach((name) => options.push({ label: name, value: name }))
  return options
})

const selectedVisibleCount = computed(() => {
  return visibleRows.value.filter((row) => row.selected).length
})

const allVisibleSelected = computed(() => {
  if (visibleRows.value.length === 0) return false
  return visibleRows.value.every((row) => row.selected)
})

const assignGroupOptions = computed(() => {
  return plotGroups.value.map((group) => ({ label: group.name, value: group.id }))
})

// --- State Management ---

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      await initialiseDialog()
    }
  }
)

watch(selectedNode, () => {
  if (!selectedVariable.value) return
  const stillValid = variableRows.value.some(
    (row) => row.variableName === selectedVariable.value && (!selectedNode.value || row.nodeName === selectedNode.value)
  )
  if (!stillValid) {
    selectedVariable.value = null
  }
})

function cloneSettings(input) {
  return {
    ...BASELINE_SIMULATION_SETTINGS,
    ...(input || {}),
  }
}

function makeGroupId(index) {
  return `plot-${index + 1}`
}

function normaliseGroups(existingGroups) {
  if (!Array.isArray(existingGroups) || existingGroups.length === 0) {
    return [{ id: makeGroupId(0), name: 'Plot 1' }]
  }

  return existingGroups.map((group, index) => ({
    id: group.id || makeGroupId(index),
    name: group.name || `Plot ${index + 1}`,
  }))
}

function buildVariableRows(nodes, selectedByKey) {
  const rows = []
  const defaultGroupId = plotGroups.value[0]?.id || null

  for (const node of nodes || []) {
    if (!node?.data?.name) continue
    for (const variable of node.data.variables || []) {
      if (!variable?.name) continue

      const key = `${node.id}::${variable.name}`
      const existing = selectedByKey.get(key)
      const type = variable.type || 'variable'
      const defaultPlotted = type === 'variable' || type === 'boundary_condition'

      rows.push({
        key,
        nodeId: node.id,
        nodeName: node.data.name,
        variableName: variable.name,
        units: variable.units || '',
        type,
        plot: existing?.plot ?? defaultPlotted,
        groupId: existing?.groupId ?? (defaultPlotted ? defaultGroupId : null),
        selected: false,
      })
    }
  }

  return rows.sort((a, b) => {
    const nodeDiff = a.nodeName.localeCompare(b.nodeName)
    if (nodeDiff !== 0) return nodeDiff
    return a.variableName.localeCompare(b.variableName)
  })
}

async function initialiseDialog() {
  loadCycle += 1
  const currentCycle = loadCycle

  isLoading.value = true
  loadingText.value = 'Preparing simulation settings...'

  settingsPayload.value = cloneSettings(props.simulationSettings)

  const existingPlotConfig = props.simulationSettings?.plotConfig || {}
  plotGroups.value = normaliseGroups(existingPlotConfig.groups)

  const selectedByKey = new Map((existingPlotConfig.selections || []).map((selection) => [selection.key, selection]))

  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))

  if (currentCycle !== loadCycle) return

  loadingText.value = 'Scanning nodes and variables...'
  variableRows.value = buildVariableRows(props.nodes, selectedByKey)
  resetVariableFilters()

  if (variableRows.value.length === 0) {
    notify.info({
      title: 'No Variables Found',
      message: 'No variables were found on the current nodes.',
    })
  }

  isLoading.value = false
}

function resetVariableFilters() {
  selectedNode.value = null
  selectedVariable.value = null
  nodeSearch.value = ''
  variableSearch.value = ''
}

function addGroup() {
  const name = newGroupName.value.trim()
  if (!name) return

  const id = `plot-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  plotGroups.value.push({ id, name })
  newGroupName.value = ''
}

function removeGroup(groupId) {
  plotGroups.value = plotGroups.value.filter((group) => group.id !== groupId)
  if (bulkGroupId.value === groupId) bulkGroupId.value = null
  variableRows.value.forEach((row) => {
    if (row.groupId === groupId) row.groupId = null
  })
}

function onPlotToggle(row) {
  if (!row.plot) {
    row.groupId = null
    return
  }

  if (!row.groupId) {
    row.groupId = plotGroups.value[0]?.id || null
  }
}

function toggleSelectAllVisible(nextValue) {
  visibleRows.value.forEach((row) => {
    row.selected = Boolean(nextValue)
  })
}

function assignSelectedToGroup() {
  if (!bulkGroupId.value) return

  let updatedCount = 0
  visibleRows.value.forEach((row) => {
    if (!row.selected) return
    row.plot = true
    row.groupId = bulkGroupId.value
    updatedCount += 1
  })

  if (updatedCount > 0) {
    notify.success({
      title: 'Bulk Assign Applied',
      message: `Assigned ${updatedCount} variable${updatedCount === 1 ? '' : 's'} to selected group.`,
    })
  }
}

function clearSelection() {
  visibleRows.value.forEach((row) => {
    row.selected = false
  })
}

function moveSelectedToUngrouped() {
  let updatedCount = 0
  visibleRows.value.forEach((row) => {
    if (!row.selected) return
    row.plot = true
    row.groupId = null
    updatedCount += 1
  })

  if (updatedCount > 0) {
    notify.success({
      title: 'Bulk Ungroup Applied',
      message: `Moved ${updatedCount} variable${updatedCount === 1 ? '' : 's'} to ungrouped.`,
    })
  }
}

// --- Handlers ---
const handleConfirm = () => {
  const selected = variableRows.value.filter((row) => row.plot)

  if (selected.some((row) => !row.groupId) && plotGroups.value.length > 0) {
    const fallbackGroupId = plotGroups.value[0].id
    selected.forEach((row) => {
      if (!row.groupId) row.groupId = fallbackGroupId
    })
  }

  const groupsById = new Map(plotGroups.value.map((group) => [group.id, group]))
  const groupsWithVariables = plotGroups.value
    .map((group) => {
      const selections = selected.filter((row) => row.groupId === group.id)
      return {
        id: group.id,
        name: group.name,
        selections: selections.map((row) => ({
          key: row.key,
          nodeId: row.nodeId,
          nodeName: row.nodeName,
          variableName: row.variableName,
          units: row.units,
          type: row.type,
          plot: true,
          groupId: row.groupId,
        })),
      }
    })
    .filter((group) => group.selections.length > 0)

  const ungroupedSelections = selected
    .filter((row) => !groupsById.has(row.groupId))
    .map((row) => ({
      key: row.key,
      nodeId: row.nodeId,
      nodeName: row.nodeName,
      variableName: row.variableName,
      units: row.units,
      type: row.type,
      plot: true,
      groupId: null,
    }))

  emit('confirm', {
    simulationSettings: settingsPayload.value,
    // ...settingsPayload.value,
    plotConfig: {
      groups: plotGroups.value,
      groupedSelections: groupsWithVariables,
      selections: [...groupsWithVariables.flatMap((group) => group.selections), ...ungroupedSelections],
    },
  })

  closeDialog()
}

const closeDialog = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 300px;
}
:deep(.sim-settings-tabs .p-tabview-panels) {
  padding: 12px 0 0;
}
.sim-settings-tabs {
  width: 100%;
}
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 260px;
}
.loading-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.loading-text span {
  font-size: 12px;
  color: #909399;
}
.block {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}
.block-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.block-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}
.subtle {
  font-size: 12px;
  color: #909399;
}
.type-filters {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.type-filter-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.group-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.group-name-input {
  width: 300px;
}
.group-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.group-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #dcdfe6;
  border-radius: 16px;
  padding: 3px 6px 3px 10px;
  background: #f8f9fb;
}
.bulk-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.filter-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.filter-select {
  width: 220px;
}
.filter-input {
  width: 220px;
}
.bulk-select-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.bulk-count {
  font-size: 12px;
  color: #606266;
}
.bulk-group-select {
  width: 260px;
}
.vars-table-wrap {
  max-height: 320px;
  overflow: auto;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.vars-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.vars-table th,
.vars-table td {
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid #f2f4f7;
  vertical-align: middle;
}
.vars-table thead th {
  position: sticky;
  top: 0;
  background: #f8f9fb;
  z-index: 1;
  font-weight: 700;
}
.empty-state {
  font-size: 13px;
  color: #909399;
  padding: 10px 0;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font-size: 12px;
  color: #606266;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1000px) {
  .settings-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
