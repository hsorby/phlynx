<template>
  <Dialog
    :visible="modelValue"
    modal
    :header="dialogTitle"
    :dismissableMask="!loading"
    :style="{ width: '95vw', maxWidth: '1680px', height: '90vh', maxHeight: '960px' }"
    class="module-editor-dialog"
    @update:visible="onDialogVisibleChange"
  >
    <div v-if="loading" class="loading-overlay">
      <ProgressSpinner style="width: 44px; height: 44px" strokeWidth="4" />
      <span>Loading instance data...</span>
    </div>

    <div v-else class="editor-grid" ref="editorGridRef" :class="{ 'is-dragging': dragging }">
      <!-- LEFT COLUMN: CellML Text Editor -->
      <div class="pane left-pane" :style="leftPaneStyle">
        <div class="editor-wrapper">
          <CellMLTextEditor
            :key="mathRef"
            :model-value="currentModel"
            @update:code="handleCodeUpdate"
            @ready="handleEditorReady"
            @save="handleSave"
          />
        </div>
      </div>

      <!-- RESIZE HANDLE (also carries the collapse/expand control) -->
      <div
        class="resizer"
        :class="{ 'resizer--collapsed': rightCollapsed }"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize editor and parameter panels"
        tabindex="0"
        @pointerdown="startResize"
        @dblclick="resetSplit"
        @keydown.left.prevent="nudgeSplit(-2)"
        @keydown.right.prevent="nudgeSplit(2)"
      >
        <div class="resizer-grip"></div>
        <button
          type="button"
          class="resizer-toggle"
          :title="rightCollapsed ? 'Expand parameter/port panel' : 'Collapse parameter/port panel'"
          :aria-label="rightCollapsed ? 'Expand panel' : 'Collapse panel'"
          @pointerdown.stop
          @click.stop="toggleRightPanel"
        >
          <i :class="rightCollapsed ? 'pi pi-angle-left' : 'pi pi-angle-right'"></i>
        </button>
      </div>

      <!-- RIGHT COLUMN: Parameter & Port Tabs -->
      <div class="pane right-pane" :class="{ 'right-pane--collapsed': rightCollapsed }">
        <!-- Collapsed rail: just a slim strip with a vertical label, click to expand -->
        <button
          v-if="rightCollapsed"
          type="button"
          class="collapsed-rail"
          @click="toggleRightPanel"
        >
          <span class="collapsed-rail-label">
            {{ activeTab === 'parameters' ? `Parameters (${parameterRows.length})` : `Ports (${editablePorts.length})` }}
          </span>
        </button>

        <Tabs v-else v-model:value="activeTab" class="right-pane-tabs">
          <TabList>
            <Tab value="parameters">
              <i class="pi pi-sliders-h tab-icon"></i>
              Parameters ({{ parameterRows.length }})
            </Tab>
            <Tab value="ports">
              <i class="pi pi-pencil tab-icon"></i>
              Ports ({{ editablePorts.length }})
            </Tab>
          </TabList>

          <TabPanels class="tab-panels-container">
            <!-- TAB 1: PARAMETER EDITOR -->
            <TabPanel value="parameters" class="tab-panel-flex">
              <div class="parameters-tab-body">
                <div class="toolbar-container">
                  <div class="search-group">
                    <div class="search-input-wrapper">
                      <InputText
                        v-model="searchQuery"
                        size="small"
                        :placeholder="`Search by ${searchColumn}...`"
                        class="search-input"
                      />
                      <Button
                        v-if="searchQuery"
                        icon="pi pi-times"
                        text
                        rounded
                        severity="secondary"
                        size="small"
                        class="clear-search-btn"
                        @click="searchQuery = ''"
                      />
                    </div>
                    <Select
                      v-model="searchColumn"
                      :options="searchColumnOptions"
                      optionLabel="label"
                      optionValue="value"
                      size="small"
                      class="search-column"
                    />
                  </div>

                  <div class="bulk-controls">
                    <span class="bulk-label">Bulk Type:</span>
                    <Select
                      v-model="bulkTypeValue"
                      size="small"
                      :options="PARAMETER_TYPE_OPTIONS"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Select type..."
                      class="bulk-select"
                    />
                    <Button
                      size="small"
                      :disabled="selectedRows.length === 0"
                      @click="applyBulkType"
                    >
                      Apply ({{ selectedRows.length }})
                    </Button>
                  </div>
                </div>

                <div class="table-flex-wrapper">
                  <DataTable
                    ref="parametersTable"
                    v-model:selection="selectedRows"
                    :value="filteredParameterRows"
                    dataKey="name"
                    scrollable
                    scrollHeight="flex"
                    tableStyle="min-width: 520px"
                    :sortField="sortField"
                    :sortOrder="sortOrder"
                    class="p-datatable-sm parameters-table"
                    @sort="handleSortChange"
                  >
                    <Column selectionMode="multiple" headerStyle="width: 2.2rem" />
                    <Column field="name" bodyClass="small-text-col" header="Name" sortable style="min-width: 120px" />
                    <Column field="value" header="Value" sortable style="min-width: 120px">
                      <template #body="slotProps">
                        <InputText
                          v-if="isEditableVariableType(slotProps.data.type)"
                          v-model="slotProps.data.value"
                          size="small"
                          placeholder="Enter value..."
                          class="w-full"
                        />
                        <span v-else class="text-muted">-</span>
                      </template>
                    </Column>
                    <Column field="units" bodyClass="small-text-col" header="Units" sortable style="min-width: 110px" />
                    <Column field="type" header="Type" sortable style="min-width: 120px">
                      <template #body="slotProps">
                        <Select
                          v-model="slotProps.data.type"
                          :options="PARAMETER_TYPE_OPTIONS"
                          optionLabel="label"
                          optionValue="value"
                          size="small"
                          class="w-full"
                        />
                      </template>
                    </Column>
                  </DataTable>
                </div>
              </div>
            </TabPanel>

            <!-- TAB 2: PORT EDITOR -->
            <TabPanel value="ports" class="tab-panel-flex">
              <div class="ports-tab-body">
                <div class="ports-header">
                  <label class="form-label">Port Definitions</label>
                  <Button icon="pi pi-plus" label="Add Port" severity="success" size="small" rounded outlined @click="addPort" />
                </div>

                <div v-if="editablePorts.length" class="table-flex-wrapper">
                  <DataTable
                    :value="editablePorts"
                    size="small"
                    stripedRows
                    scrollable
                    scrollHeight="flex"
                    tableStyle="min-width: 580px"
                  >
                    <Column header="Type" style="min-width: 90px">
                      <template #body="slotProps">
                        <Select
                          v-model="slotProps.data.portType"
                          :options="PORT_TYPE_OPTIONS"
                          optionLabel="label"
                          optionValue="value"
                          size="small"
                          class="w-full"
                        />
                      </template>
                    </Column>

                    <Column header="Label" style="min-width: 140px">
                      <template #body="slotProps">
                        <InputText v-model="slotProps.data.label" placeholder="Enter label" size="small" class="w-full" />
                      </template>
                    </Column>

                    <Column header="Variable(s)" style="min-width: 180px">
                      <template #body="slotProps">
                        <MultiSelect
                          v-model="slotProps.data.variables"
                          :options="variables"
                          optionLabel="name"
                          optionValue="name"
                          size="small"
                          placeholder="Select variables"
                          class="w-full"
                          :maxSelectedLabels="3"
                        />
                      </template>
                    </Column>

                    <Column header="Multiport" style="min-width: 110px">
                      <template #body="slotProps">
                        <div class="flex flex-col gap-1">
                          <Select
                            v-model="slotProps.data.multiportType"
                            :options="MULTIPORT_OPTIONS"
                            optionLabel="label"
                            optionValue="value"
                            size="small"
                            placeholder="Select"
                            class="w-full"
                          />
                          <div v-if="slotProps.data.multiportType === 'Multiply'" class="flex items-center gap-1">
                            <span class="multiply-prefix">&times;</span>
                            <InputNumber
                              v-model="slotProps.data.multiplyFactor"
                              :showButtons="false"
                              size="small"
                              placeholder="1"
                              class="w-full"
                            />
                          </div>
                        </div>
                      </template>
                    </Column>

                    <Column header="" style="width: 56px; min-width: 56px">
                      <template #body="slotProps">
                        <Button
                          icon="pi pi-trash"
                          severity="danger"
                          rounded
                          text
                          size="small"
                          @click="deletePort(editablePorts.indexOf(slotProps.data))"
                        />
                      </template>
                    </Column>
                  </DataTable>
                </div>
                <div v-else class="empty-state">No ports defined for this instance.</div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>

    <!-- DIALOG FOOTER -->
    <template #footer>
      <div class="dialog-footer">
        <div
          v-if="siblingCount > 0"
          class="apply-all-checkbox"
          :title="`Also update ${siblingCount} other node${
            siblingCount !== 1 ? 's' : ''
          } using ${componentName} from ${componentFile}`"
        >
          <Checkbox v-model="applyToAll" binary inputId="applyToAll" />
          <label for="applyToAll">Apply CellML changes to all instances</label>
          <Tag severity="info" :value="String(siblingCount + 1)" />
        </div>

        <div class="footer-buttons">
          <Button label="Cancel" severity="secondary" text @click="handleCancel" />
          <Button label="Save All Changes" severity="primary" @click="handleSave" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useVueFlow } from '@vue-flow/core'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Divider from 'primevue/divider'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Tag from 'primevue/tag'

import CellMLTextEditor from './CellMLTextEditor.vue'
import { useLibraryStore } from '../stores/libraryStore'
import { useGtm } from '../composables/useGtm'
import { useConfirmDialog } from '../composables/useConfirmDialog'

import { PARAMETER_TYPE_OPTIONS, PORT_TYPE_OPTIONS, MULTIPORT_OPTIONS } from '../utils/constants'
import { isEditableVariableType, isEmpty } from '../utils/variables'
import { sanitiseName } from '../utils/nodes'
import { detachReactivity } from '../utils/reactivity'
import { notify } from '../utils/notify'
import { getModelComponentNames, areModelsEquivalent } from '../utils/cellml'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  id: { type: String, required: true },
  initialName: { type: String, default: '' },
  mathRef: { type: String, required: true },
  variables: { type: Array, default: () => [] },
  initialPorts: { type: Array, default: () => [] },
  existingNames: { type: Array, default: () => [] },
  defaultTab: { type: String, default: 'parameters' }, // 'parameters' or 'ports'
})

const emit = defineEmits(['update:modelValue', 'save'])

const store = useLibraryStore()
const { trackEvent } = useGtm()
const { nodes } = useVueFlow()
const { alert, confirm } = useConfirmDialog()

// ── State ────────────────────────────────────────────────────────────────────
const loading = ref(false)
const activeTab = ref('parameters')

// CellML State
const currentModel = ref('')
const originalModel = ref('')
const applyToAll = ref(false)

// Parameter State
const parameterRows = ref([])
const selectedRows = ref([])
const searchQuery = ref('')
const searchColumn = ref('name')
const searchColumnOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Units', value: 'units' },
  { label: 'Type', value: 'type' },
]
const bulkTypeValue = ref('')
const sortField = ref('name')
const sortOrder = ref(1)

// Port & Instance State
const editableName = ref('')
const editablePorts = ref([])

// ── Split / Collapse State ──────────────────────────────────────────────────
const SPLIT_STORAGE_KEY = 'instanceEditorDialog.leftPanePercent'
const DEFAULT_LEFT_PERCENT = 48
const MIN_LEFT_PERCENT = 32
const MAX_LEFT_PERCENT = 72

function loadStoredSplit() {
  try {
    const stored = Number(window.localStorage.getItem(SPLIT_STORAGE_KEY))
    if (Number.isFinite(stored) && stored >= MIN_LEFT_PERCENT && stored <= MAX_LEFT_PERCENT) {
      return stored
    }
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) - fall back to default
  }
  return DEFAULT_LEFT_PERCENT
}

const editorGridRef = ref(null)
const leftPercent = ref(loadStoredSplit())
const rightCollapsed = ref(false)
const dragging = ref(false)

const leftPaneStyle = computed(() => {
  if (rightCollapsed.value) return { flex: '1 1 auto' }
  return { flex: `0 0 ${leftPercent.value}%` }
})

function clampPercent(value) {
  return Math.min(MAX_LEFT_PERCENT, Math.max(MIN_LEFT_PERCENT, value))
}

function updateSplitFromClientX(clientX) {
  const grid = editorGridRef.value
  if (!grid) return
  const rect = grid.getBoundingClientRect()
  if (!rect.width) return
  const percent = ((clientX - rect.left) / rect.width) * 100
  leftPercent.value = clampPercent(percent)
}

function persistSplit() {
  try {
    window.localStorage.setItem(SPLIT_STORAGE_KEY, String(leftPercent.value))
  } catch (e) {
    // ignore storage errors
  }
}

function onResizeMove(event) {
  if (!dragging.value) return
  updateSplitFromClientX(event.clientX)
}

function stopResize() {
  if (!dragging.value) return
  dragging.value = false
  window.removeEventListener('pointermove', onResizeMove)
  persistSplit()
}

function startResize(event) {
  if (rightCollapsed.value) return
  dragging.value = true
  event.target?.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', stopResize, { once: true })
}

function nudgeSplit(delta) {
  leftPercent.value = clampPercent(leftPercent.value + delta)
  persistSplit()
}

function resetSplit() {
  leftPercent.value = DEFAULT_LEFT_PERCENT
  persistSplit()
}

function toggleRightPanel() {
  rightCollapsed.value = !rightCollapsed.value
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onResizeMove)
})

// ── Computed ─────────────────────────────────────────────────────────────────
const componentFile = computed(() => props.mathRef?.split(':')[0])
const componentName = computed(() => props.mathRef?.split(':')[1])

const dialogTitle = computed(() => {
  return `Editing: ${editableName.value || props.initialName} (${componentName.value} - ${componentFile.value})`
})

const siblings = computed(() => {
  if (!componentName.value || !componentFile.value) return []
  return nodes.value.filter((n) => n.id !== props.id && n.data?.mathRef === props.mathRef).map((n) => n.id)
})

const siblingCount = computed(() => siblings.value.length)

const isDirty = computed(() => {
  return !areModelsEquivalent(originalModel.value, currentModel.value)
})

const filteredParameterRows = computed(() => {
  if (!searchQuery.value.trim()) return parameterRows.value
  const query = searchQuery.value.toLowerCase()
  const columnKey = searchColumn.value
  return parameterRows.value.filter((row) => String(row[columnKey] || '').toLowerCase().includes(query))
})

// ── Watchers & Handlers ──────────────────────────────────────────────────────
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      loading.value = true
      applyToAll.value = false
      activeTab.value = props.defaultTab || 'parameters'

      // Load Instance & Port data
      editableName.value = props.initialName
      editablePorts.value = detachReactivity(props.initialPorts || []).map((port) => ({
        ...port,
        variables: Array.isArray(port.variables)
          ? port.variables.map((v) => (typeof v === 'object' && v !== null ? v.name : v))
          : []
      }))

      // Load Parameters
      parameterRows.value = props.variables.map((row) => ({
        name: row.name,
        value: row.type === 'global_constant' ? store.getGlobalConstant(row.name)?.value : row.value,
        units: row.units,
        type: row.type,
        access: row.access,
      }))
      sortParameterRows('type', 1)

      // Load CellML
      try {
        if (props.mathRef) {
          const math = store.availableMath.get(props.mathRef)
          currentModel.value = math || ''
          originalModel.value = math || ''
        }
      } catch (e) {
        console.error('Failed to load CellML source', e)
      } finally {
        loading.value = false
      }
    }
  }
)

function handleCodeUpdate(newCode) {
  currentModel.value = newCode
}

function handleEditorReady(canonicalMath) {
  currentModel.value = canonicalMath
  originalModel.value = canonicalMath
}

function sortParameterRows(field = 'type', order = 1) {
  parameterRows.value.sort((a, b) => {
    const valA = String(a[field] || '').toLowerCase()
    const valB = String(b[field] || '').toLowerCase()
    const result = valA.localeCompare(valB)
    return result !== 0 ? (order === 1 ? result : -result) : a.name.localeCompare(b.name)
  })
}

function handleSortChange(event) {
  const field = event?.sortField || 'type'
  const order = event?.sortOrder === -1 ? -1 : 1
  sortField.value = field
  sortOrder.value = order
  sortParameterRows(field, order)
}

function applyBulkType() {
  if (!bulkTypeValue.value || selectedRows.value.length === 0) return
  const targetType = bulkTypeValue.value
  selectedRows.value.forEach((row) => {
    row.type = targetType
  })
  selectedRows.value = []
  bulkTypeValue.value = ''
}

function addPort() {
  editablePorts.value.push({
    portType: 'general_ports',
    variables: [],
    label: '',
    multiportType: 'None',
    multiplyFactor: 1,
  })
}

function deletePort(index) {
  editablePorts.value.splice(index, 1)
}

const onDialogVisibleChange = (visible) => {
  if (visible) {
    emit('update:modelValue', true)
  } else {
    handleCancel()
  }
}

async function handleCancel() {
  if (isDirty.value) {
    const confirmed = await confirm({
      header: 'Unsaved Changes',
      message: 'Are you sure you want to discard changes?',
      severity: 'warning',
      acceptLabel: 'Discard & Close',
      rejectLabel: 'Cancel',
    })
    if (!confirmed) return
  }
  emit('update:modelValue', false)
}

// ── Save Processing ──────────────────────────────────────────────────────────
async function handleSave() {
  // 1. Validate Instance Name
  if (!editableName.value || !editableName.value.trim()) {
    notify.error({ message: 'Instance name cannot be empty.' })
    activeTab.value = 'ports'
    return
  }
  const sanitised = sanitiseName(editableName.value)
  if (!sanitised) {
    notify.error({ message: 'Instance name is invalid.' })
    activeTab.value = 'ports'
    return
  }
  editableName.value = sanitised

  const nameExists = props.existingNames.some((n) => n === editableName.value && n !== props.initialName)
  if (nameExists) {
    notify.error({ message: 'An instance with this name already exists.' })
    activeTab.value = 'ports'
    return
  }

  // 2. Validate Ports
  const finalPorts = editablePorts.value.filter((p) => p.variables?.length && p.label?.trim())
  const invalidFactor = finalPorts.find((p) => p.multiportType === 'Multiply' && isEmpty(p.multiplyFactor))
  if (invalidFactor) {
    notify.error({ message: `Port "${invalidFactor.label}" has Multiply selected but missing scale factor.` })
    activeTab.value = 'ports'
    return
  }

  // 3. Process Global Constants from Parameters
  parameterRows.value.forEach((row) => {
    if (row.type === 'global_constant') {
      store.assignGlobalConstant(row.name, row.value, row.units, row.data_reference)
    }
  })

  // 4. Process CellML Source Changes
  let newMathRef = props.mathRef
  if (isDirty.value) {
    const componentNames = getModelComponentNames(currentModel.value)
    if (!componentNames || componentNames.length === 0) {
      window.alert('Could not find a valid component name in the model.')
      return
    }
    const newComponentName = componentNames[0].trim()
    newMathRef = `${componentFile.value}:${newComponentName}`

    if (newMathRef !== props.mathRef && store.availableMath.has(newMathRef)) {
      await alert({
        header: 'Name Conflict',
        message: 'Name clash detected. Please rename the component in the editor before saving.',
        severity: 'error',
      })
      return
    }
    store.addMath(newMathRef, currentModel.value)
  }

  const updateAll = (siblingCount.value > 0 && applyToAll.value) || siblingCount.value === 0

  trackEvent('editor_action', {
    category: 'Editor',
    action: 'save_unified_module',
    label: editableName.value,
  })

  // Emit consolidated payload to parent workspace
  emit('confirm', {
    id: props.id,
    name: editableName.value,
    mathRef: newMathRef,
    math: currentModel.value,
    variables: parameterRows.value,
    ports: finalPorts,
    updateAll,
    siblings: updateAll ? siblings.value : undefined,
  })

  emit('update:modelValue', false)
}
</script>

<style scoped>
.module-editor-dialog {
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

.module-editor-dialog :deep(.p-dialog-content) {
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  padding-bottom: 16px !important;
}

/* ── Design tokens (kept local to this dialog for consistent typography) ── */
.editor-grid {
  --dlg-fs-label: 0.875rem;   /* 14px - field/section labels */
  --dlg-fs-body: 0.875rem;    /* 14px - table cells, inputs */
  --dlg-fs-small: 0.8125rem;  /* 13px - secondary/meta text */
  --dlg-fs-tiny: 0.75rem;     /* 12px - badges, prefixes only */

  display: flex;
  align-items: stretch;
  gap: 0;
  flex: 1 1 auto;
  min-height: 0;
  height: clamp(520px, 69vh, 940px);
}

.editor-grid.is-dragging {
  cursor: col-resize;
  user-select: none;
}

.pane {
  display: flex;
  flex-direction: column;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 12px;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.left-pane {
  min-width: 340px;
}

.editor-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Resize handle between the two panes; also hosts the collapse/expand button ── */
.resizer {
  position: relative;
  flex: 0 0 14px;
  margin: 0 -3px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  z-index: 2;
  touch-action: none;
}

.resizer--collapsed {
  cursor: pointer;
}

.resizer-grip {
  width: 4px;
  height: 48px;
  border-radius: 3px;
  background: var(--p-content-border-color);
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.resizer--collapsed .resizer-grip {
  opacity: 0.35;
}

.resizer:hover .resizer-grip,
.resizer:focus-visible .resizer-grip {
  background: var(--p-primary-color);
}

.resizer:focus-visible {
  outline: none;
}

.resizer-toggle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--p-content-border-color);
  border-radius: 999px;
  background: var(--p-content-background);
  color: var(--p-text-muted-color);
  cursor: pointer;
  z-index: 3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  opacity: 0.55;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.resizer:hover .resizer-toggle,
.resizer:focus-visible .resizer-toggle,
.resizer--collapsed .resizer-toggle {
  opacity: 1;
}

.resizer-toggle:hover {
  color: var(--p-text-color);
  background: var(--p-content-hover-background, rgba(0, 0, 0, 0.04));
}

/* ── Right pane / collapse behaviour ── */
.right-pane {
  position: relative;
  flex: 1 1 auto;
  min-width: 300px;
  transition: min-width 0.15s ease, flex-basis 0.15s ease;
}

.right-pane--collapsed {
  flex: 0 0 32px;
  min-width: 32px;
  padding: 8px 4px;
  align-items: center;
}

.collapsed-rail {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.collapsed-rail-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: var(--dlg-fs-label);
  font-weight: 600;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

/* ── Tabs: make the whole chain fill available height so the scroll ── */
/* region reaches the bottom of the panel instead of leaving blank   */
/* space underneath it on taller screens.                            */
.right-pane-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.right-pane-tabs :deep(.p-tablist) {
  flex-shrink: 0;
}

.tab-panels-container {
  flex: 1;
  min-height: 0;
  padding-top: 12px;
}

.right-pane-tabs :deep(.p-tabpanels) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-panel-flex {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.right-pane-tabs :deep(.p-tabpanel) {
  height: 100%;
}

.parameters-tab-body,
.ports-tab-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.table-flex-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-flex-wrapper :deep(.p-datatable) {
  display: flex !important;
  flex-direction: column !important;
  min-height: 0 !important;
  height: 100% !important;
  overflow: hidden !important;
}

.table-flex-wrapper :deep(.p-datatable-table-container),
.table-flex-wrapper :deep(.p-datatable-wrapper) {
  min-height: 0 !important;
  flex: 1 1 auto !important;
  overflow-y: auto !important;
}

.tab-icon {
  margin-right: 6px;
  font-size: var(--dlg-fs-small);
}

/* Parameters Tab Styles */
.toolbar-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 12px;
  background-color: var(--p-content-hover-background, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
}

.search-group, .bulk-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-group {
  flex-wrap: wrap;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 160px;
  min-width: 120px;
}

.search-input-wrapper :deep(.p-inputtext) {
  width: 100%;
}

.clear-search-btn {
  position: absolute;
  right: 2px;
  width: 1.25rem !important;
  height: 1.25rem !important;
}

.bulk-controls {
  padding-top: 8px;
  border-top: 1px solid var(--p-content-border-color);
  flex-wrap: wrap;
}

.bulk-controls .bulk-select {
  margin-right: auto;
}

.search-column { width: 130px; flex: 0 0 auto; }
.bulk-select { width: 180px; }
.bulk-label { font-size: var(--dlg-fs-small); color: var(--p-text-muted-color); white-space: nowrap; }

/* Ports Tab Styles */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-weight: 600;
  font-size: var(--dlg-fs-label);
}

.ports-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.empty-state {
  color: var(--p-text-muted-color);
  font-size: var(--dlg-fs-small);
  margin-top: 16px;
  text-align: center;
}

.multiply-prefix {
  font-size: var(--dlg-fs-tiny);
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.w-full { width: 100%; }
.text-muted { color: var(--p-text-muted-color); }

/* Normalise table typography - DataTable renders these cells directly */
/* in our own template output (not teleported), so :deep() reaches them. */
.right-pane :deep(.p-datatable) {
  font-size: var(--dlg-fs-body);
}

.right-pane :deep(.p-datatable-thead > tr > th) {
  font-size: var(--dlg-fs-small);
  font-weight: 600;
}

.right-pane :deep(.p-select-label),
.right-pane :deep(.p-inputtext) {
  font-size: var(--dlg-fs-body);
}

/* Footer */
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  width: 100%;
}

.apply-all-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
  font-size: 0.85rem;
}

.footer-buttons {
  display: flex;
  gap: 8px;
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 12px;
}

@media (max-width: 900px) {
  .editor-grid {
    flex-direction: column;
  }

  .left-pane {
    min-width: 0;
    flex-basis: 45vh !important;
  }

  .resizer {
    display: none;
  }

  .right-pane {
    flex-basis: 45vh !important;
    min-width: 0;
  }

  .right-pane--collapsed {
    display: none;
  }
}
</style>
