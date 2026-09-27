<template>
  <Dialog
    :visible="modelValue"
    modal
    :dismissableMask="!loading"
    :draggable="false"
    :style="{ width: '95vw', maxWidth: '1680px', height: '90vh', maxHeight: '960px' }"
    class="module-editor-dialog"
    @update:visible="onDialogVisibleChange"
  >
    <template #header>
      <div class="custom-dialog-header">

        <div class="header-group">
          <span class="header-label">Instance:</span>
          <SanitisedInput
            v-model="editableName"
            :sanitise="sanitiseName"
            placeholder="Instance name..."
            width="260px"
            font-size="1rem"
          />
        </div>

        <div class="header-group header-group--end">
          <span class="header-label">Component:</span>
          <span
            :title="isManaged ? '' : 'While Simple Mode is off, the text sets the component name (def comp ... as).'"
          >
            <SanitisedInput
              v-model="editableComponentName"
              :sanitise="sanitiseName"
              :fallback="componentNameForEditor"
              :disabled="!isManaged"
              placeholder="Component name..."
              width="200px"
              font-size="1rem"
            />
          </span>
          <span class="header-file" :title="`Defined in ${componentFile}`">
            <i class="pi pi-file"></i>
            <span class="header-file-name">{{ componentFile }}</span>
          </span>
        </div>
      </div>
    </template>

    <div v-if="loading" class="loading-overlay">
      <ProgressSpinner style="width: 44px; height: 44px" strokeWidth="4" />
      <span>Loading instance data...</span>
    </div>

    <div
      v-else
      class="editor-grid"
      ref="editorGridRef"
      :class="{ 'is-dragging': dragging, 'is-suppressed': isScreenTooSmall }"
      :inert="isScreenTooSmall"
    >
      <!-- LEFT COLUMN: CellML Text Editor -->
      <div class="pane left-pane" :style="leftPaneStyle" :class="{ 'left-pane--collapsed': rightCollapsed }">
        <div class="editor-wrapper">
          <CellMLTextEditor
            ref="cellmlEditorRef"
            :key="mathRef"
            :model-value="currentModel"
            v-model:simple="isManaged"
            :component-name="componentNameForEditor"
            :definitions="editorDefinitions"
            @update:component-name="onEditorComponentName"
            @change="handleEditorChange"
            @save="handleSave"
            @undo="handleEditorUndo"
            @redo="handleEditorRedo"
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
        <button
          v-if="rightCollapsed"
          type="button"
          class="collapsed-rail"
          :aria-label="railAriaLabel"
          @click="toggleRightPanel"
        >
          <span v-if="activeTab === 'parameters' && issueChips.length" class="rail-badges">
            <span
              v-for="chip in issueChips"
              :key="chip.key"
              class="rail-badge"
              :class="`issue-chip--${chip.kind}`"
              :title="chip.label"
            >
              <i :class="['pi', chip.icon]"></i>
              {{ chip.count }}
            </span>
          </span>
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
                  <div class="legend-row">
                    <span class="legend-item"><span class="legend-swatch legend-swatch--state"></span>State variable</span>
                    <span class="legend-item"><span class="legend-swatch legend-swatch--initialiser"></span>Initial-value variable</span>
                  </div>

                  <div class="search-group">
                    <div class="search-input-wrapper flex-1">
                      <IconField class="w-full">
                        <InputIcon class="pi pi-search" />
                        <InputText
                          v-model="searchQuery"
                          class="w-full"
                          size="small"
                          :placeholder="`Search by ${searchColumn}...`"
                        />
                        <InputIcon
                          v-if="searchQuery"
                          class="clear-search-btn pi pi-times-circle"
                          @click="searchQuery = ''"
                        />
                      </IconField>
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

                  <div v-if="issueChips.length" class="issue-summary">
                    <span class="issue-summary-label">Show only:</span>
                    <button
                      v-for="chip in issueChips"
                      :key="chip.key"
                      type="button"
                      class="issue-chip"
                      :class="[`issue-chip--${chip.kind}`, { 'issue-chip--active': activeIssueKeys.includes(chip.key) }]"
                      :aria-pressed="activeIssueKeys.includes(chip.key)"
                      :title="activeIssueKeys.includes(chip.key) ? 'Showing only these. Click to show all again.' : 'Click to show only these'"
                      @click="toggleIssueFilter(chip.key)"
                    >
                      <i :class="['pi', chip.icon]"></i>
                      {{ chip.label }}
                    </button>
                  </div>
                </div>

                <div class="table-flex-wrapper">
                  <DataTable
                    ref="parametersTable"
                    v-model:selection="selectedRows"
                    :value="visibleParameterRows"
                    dataKey="name"
                    scrollable
                    scrollHeight="flex"
                    tableStyle="min-width: 560px; table-layout: fixed"
                    :sortField="sortField"
                    :sortOrder="sortOrder"
                    :customSort="true"
                    :rowClass="parameterRowClass"
                    class="p-datatable-sm parameters-table"
                    @sort="handleSortChange"
                  >
                    <Column selectionMode="multiple" headerStyle="width: 2rem" />
                    <Column field="name" bodyClass="small-text-col" header="Name" sortable style="min-width: 120px">
                      <template #body="slotProps">
                        <span class="name-cell">
                          <SanitisedInput
                            v-if="isRenamableInitialiser(slotProps.data)"
                            :model-value="slotProps.data.name"
                            :sanitise="cleanName"
                            :notice="duplicateNameNotice(slotProps.data)"
                            placeholder="Initialiser name..."
                            @update:model-value="(val) => renameInitialiser(slotProps.data, val)"
                          />
                          <span v-else class="cell-static-text">{{ slotProps.data.name }}</span>
                          <Tag
                            v-if="isSharedInitialiserRow(slotProps.data)"
                            severity="info"
                            class="shared-initialiser-badge"
                            :value="`×${initialiserUsage.get(slotProps.data.name)}`"
                            :title="`Initial value for: ${statesUsingInitialiser(slotProps.data.name).join(', ')}`"
                          />
                        </span>
                      </template>
                    </Column>
                    <Column field="value" header="Value" sortable style="width: 160px">
                      <template #body="slotProps">
                        <span
                          v-if="slotProps.data.textInit"
                          class="cell-static text-muted"
                          title="Initial value set in the CellML text"
                        >
                          <span class="cell-static-text">{{ slotProps.data.textInit }}</span>
                        </span>
                        <Select
                          v-else-if="slotProps.data.stateRole === 'state'"
                          :model-value="slotProps.data.initialiser || NEW_INITIALISER_VALUE"
                          :options="initialiserOptionsFor(slotProps.data)"
                          optionLabel="label"
                          optionValue="value"
                          size="small"
                          class="w-full"
                          title="Which variable supplies this state's initial value"
                          @update:model-value="(val) => onInitialiserPick(slotProps.data, val)"
                        />
                        <InputText
                          v-else-if="isEditableVariableType(slotProps.data.type)"
                          v-model="slotProps.data.value"
                          size="small"
                          :placeholder="isValueMissing(slotProps.data) ? 'Value required' : 'Enter value...'"
                          class="w-full"
                        />
                        <span v-else class="cell-static text-muted" title="Computed elsewhere in the math">-</span>
                      </template>
                    </Column>
                    <Column field="units" bodyClass="small-text-col" header="Units" sortable style="width: 152px">
                      <template #body="slotProps">
                        <SanitisedInput
                          v-if="isManaged"
                          v-model="slotProps.data.units"
                          :sanitise="cleanName"
                          :notice="unknownUnitsNotice(slotProps.data)"
                          floating
                          placeholder="e.g. millivolt"
                        />
                        <span v-else class="cell-static text-muted" title="Edit units in the CellML text">
                          <span class="cell-static-text">{{ slotProps.data.units || '—' }}</span>
                          <i
                            v-if="unknownUnitsNotice(slotProps.data)"
                            class="pi pi-exclamation-triangle units-flag"
                            :title="unknownUnitsNotice(slotProps.data)"
                          ></i>
                        </span>
                      </template>
                    </Column>
                    <Column field="type" header="Type" sortable style="width: 140px">
                      <template #body="slotProps">
                        <Select
                          :model-value="displayType(slotProps.data)"
                          :options="PARAMETER_TYPE_OPTIONS"
                          :disabled="slotProps.data.stateRole === 'state' || !!slotProps.data.textInit"
                          optionLabel="label"
                          optionValue="value"
                          size="small"
                          class="w-full"
                          @update:model-value="slotProps.data.type = $event"
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
                    <Column header="" style="width: 25px">
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
                    <Column header="Type" style="width: 3cap">
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
                          :options="parameterRows"
                          optionLabel="name"
                          optionValue="name"
                          size="small"
                          placeholder="Select variables"
                          class="w-full"
                          :maxSelectedLabels="3"
                          filter
                          autoFilterFocus
                          resetFilterOnHide
                          filterPlaceholder="Search variables..."
                          emptyFilterMessage="No matching variables"
                          :pt="{ overlay: { class: 'ports-variable-overlay' } }"
                        >
                          <template #filtericon>
                            <span class="ports-variable-filter-icons">
                              <i class="pi pi-search"></i>
                              <i
                                class="search-clear-input pi pi-times-circle"
                                role="button"
                                aria-label="Clear search"
                                @mousedown.prevent
                                @click.stop="clearPortVariableSearch"
                              ></i>
                            </span>
                          </template>
                        </MultiSelect>
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
                  </DataTable>
                </div>
                <div v-else class="empty-state">No ports defined for this instance.</div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>

    <!-- OVERLAY:  -->
    <Transition name="resize-warning">
      <div v-if="isScreenTooSmall" class="resize-warning-overlay">
        <div class="resize-warning-card">
          <div class="resize-warning-icon">
            <i class="pi pi-angle-double-left resize-warning-arrow resize-warning-arrow--left"></i>
            <i class="pi pi-desktop resize-warning-window"></i>
            <i class="pi pi-angle-double-right resize-warning-arrow resize-warning-arrow--right"></i>
          </div>
          <h3 class="resize-warning-title">More room needed</h3>
          <p class="resize-warning-copy">
            Widen your browser window to keep editing — the parameter and port panels
            need a bit more horizontal space to display properly.
          </p>
          <div
            class="resize-warning-meter"
            role="img"
            :aria-label="`Window is ${currentWidth} pixels wide, ${MIN_REQUIRED_WIDTH} needed`"
          >
            <div class="resize-warning-meter-track">
              <div class="resize-warning-meter-fill" :style="{ width: widthProgressPercent + '%' }"></div>
            </div>
            <div class="resize-warning-meter-labels">
              <span>{{ currentWidth }}px</span>
              <span>{{ MIN_REQUIRED_WIDTH }}px needed</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- DIALOG FOOTER -->
    <template #footer>
      <div class="dialog-footer" v-if="!loading && !isScreenTooSmall">
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { analyzeModelXml } from 'cellml-text-editor'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import InputIcon from 'primevue/inputicon'
import IconField from 'primevue/iconfield'
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
import SanitisedInput from './SanitisedInput.vue'
import { useWebWorkerFn } from '@vueuse/core'
import { useLibraryStore } from '../stores/libraryStore'
import { useIssueFilter } from '../composables/useIssueFilter'
import { useFlowHistoryStore } from '../stores/historyStore'
import { useGtm } from '../composables/useGtm'
import { useConfirmDialog } from '../composables/useConfirmDialog'

import {
  isEditableVariableType,
  isEmpty,
  isNumericLiteral,
  rowsFromAnalysis,
  rowsFromDeclaredVariables,
  syncInitialiserUnits,
  analyzeMathRoles,
  buildVariableDeclarations,
} from '../utils/variables'
import {
  PARAMETER_TYPE_OPTIONS,
  PORT_TYPE_OPTIONS,
  NO_ACCESS,
  VALUE_REQUIRED_TYPES,
  MULTIPORT_OPTIONS
} from '../utils/constants'
import { cleanName, sanitiseName } from '../utils/identifiers'
import { detachReactivity } from '../utils/reactivity'
import { notify } from '../utils/notify'
import { getModelComponentNames, areModelsEquivalent, extractVariablesFromMath } from '../utils/cellml'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  id: { type: String, required: true },
  initialName: { type: String, default: '' },
  mathRef: { type: String, required: true },
  variables: { type: Array, default: () => [] },
  initialPorts: { type: Array, default: () => [] },
  existingNames: { type: Array, default: () => [] },
  defaultTab: { type: String, default: 'parameters' },  // 'parameters' or 'ports'
  initialManaged: { type: Boolean, default: true },     // persisted per-instance
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const store = useLibraryStore()
const history = useFlowHistoryStore()

const { trackEvent } = useGtm()
const { nodes } = useVueFlow()
const { confirm } = useConfirmDialog()

// Sentinel option value meaning "create a brand-new dedicated initialiser", as opposed to picking
// an existing variable's name from the dropdown.
const NEW_INITIALISER_VALUE = '__new_initialiser__'

// ── State ────────────────────────────────────────────────────────────────────
const loading = ref(false)
const activeTab = ref('parameters')

// CellML State
const currentModel = ref('')       // parsed XML representation
const currentCellmlText = ref('')  // raw CellML source text
const originalModel = ref('')
const applyToAll = ref(false)

// Parameter State
const parameterRows = ref([])
const selectedRows = ref([])

// Simple Mode
const isManaged = ref(false)
let rowsBuiltAsManaged = false
const unresolvedVariableNames = ref(new Set())

// Search Query & Sort State
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

// Component Name
const editableComponentName = ref('')
const componentNameForEditor = ref('')

watch(editableComponentName, (value) => {
  const cleaned = cleanName(value)
  if (cleaned) componentNameForEditor.value = cleaned
})

// Advanced Mode component name
function onEditorComponentName(name) {
  editableComponentName.value = name
  componentNameForEditor.value = name
}

// Ref to the CellML editor, used to imperatively replay text during undo/redo
const cellmlEditorRef = ref(null)

// ── Split / Collapse State ──────────────────────────────────────────────────
const SPLIT_STORAGE_KEY = 'instanceEditorDialog.leftPanePercent'
const DEFAULT_LEFT_PERCENT = 55
const MIN_LEFT_PERCENT = 32
const MAX_LEFT_PERCENT = 60
const MIN_REQUIRED_WIDTH = 1000;

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

onUnmounted(() => {
  window.removeEventListener('pointermove', onResizeMove)
})

// ── Too-small-window overlay ────────────────────────────────────────────────
const RESIZE_MEDIA_QUERY = `(min-width: ${MIN_REQUIRED_WIDTH}px)`
const isScreenTooSmall = ref(false)
const currentWidth = ref(window.innerWidth)

const widthProgressPercent = computed(() =>
  Math.min(100, Math.round((currentWidth.value / MIN_REQUIRED_WIDTH) * 100))
)

let resizeMql = null
let widthRafId = null

function updateCurrentWidth() {
  currentWidth.value = window.innerWidth
  widthRafId = null
}

function scheduleWidthUpdate() {
  if (widthRafId !== null) return
  widthRafId = requestAnimationFrame(updateCurrentWidth)
}

function handleMediaChange(event) {
  isScreenTooSmall.value = !event.matches
}

watch(isScreenTooSmall, (tooSmall) => {
  if (tooSmall) {
    updateCurrentWidth()
    window.addEventListener('resize', scheduleWidthUpdate, { passive: true })
  } else {
    window.removeEventListener('resize', scheduleWidthUpdate)
    if (widthRafId !== null) {
      cancelAnimationFrame(widthRafId)
      widthRafId = null
    }
  }
})

onMounted(() => {
  resizeMql = window.matchMedia(RESIZE_MEDIA_QUERY)
  isScreenTooSmall.value = !resizeMql.matches
  resizeMql.addEventListener('change', handleMediaChange)
})

onUnmounted(() => {
  resizeMql?.removeEventListener('change', handleMediaChange)
  window.removeEventListener('resize', scheduleWidthUpdate)
  if (widthRafId !== null) cancelAnimationFrame(widthRafId)
})

// ── Initialiser sharing: usage tracking, picker options, rename/reassign/cleanup ────────────────

/** Map: initialiser name -> how many states currently point at it. */
const initialiserUsage = computed(() => {
  const counts = new Map()
  for (const row of parameterRows.value) {
    if (row.stateRole === 'state' && row.initialiser) {
      counts.set(row.initialiser, (counts.get(row.initialiser) ?? 0) + 1)
    }
  }
  return counts
})

function isInitialiserRow(row) {
  return (initialiserUsage.value.get(row.name) ?? 0) > 0
}

function isSharedInitialiserRow(row) {
  return (initialiserUsage.value.get(row.name) ?? 0) > 1
}

/**
 * Only a row that (a) is currently some state's initialiser and (b) isn't itself computed by an
 * equation elsewhere in the math is safe to rename from the table. A computed row - even though
 * it's playing the initialiser role, like `c_init` in SN_soma - is still referenced directly by
 * name in the math (`<ci>c_init</ci>`) exactly like any other math-referenced variable, so
 * renaming it here would desync the CellML text the same way renaming a state or an ordinary
 * referenced constant would.
 */
function isRenamableInitialiser(row) {
  if (row.stateRole === 'state') return false
  if (row.type === 'variable') return false
  return isInitialiserRow(row)
}

function statesUsingInitialiser(name) {
  return parameterRows.value.filter((row) => row.stateRole === 'state' && row.initialiser === name).map((row) => row.name)
}

/**
 * The name a brand-new initialiser for `stateRow` would get: "<state>_init", or the same with a
 * numeric suffix if that name is already taken by some other row in the table. Shared by the
 * picker's "New" label and createNewInitialiserFor, so what's offered and what actually gets
 * created can never disagree.
 */
function nextAvailableInitialiserName(stateRow) {
  const defaultName = `${stateRow.name}_init`
  const existingNames = new Set(parameterRows.value.map((row) => row.name))
  let name = defaultName
  let counter = 1
  while (existingNames.has(name)) {
    name = `${defaultName}_${counter++}`
  }
  return name
}

/**
 * Non-state rows grouped by their (cleaned) units, rebuilt once whenever parameterRows changes
 * rather than re-scanned in full for every state row. A model with many states and many
 * variables made initialiserOptionsFor an O(states x rows) full-table scan on every render of
 * every state's Value cell - for a large model this was the single biggest cost in opening (and
 * then interacting with) this dialog. Looking candidates up by units, O(1), turns that into a
 * single O(rows) pass overall.
 */
const rowsByUnits = computed(() => {
  const index = new Map() // cleaned units -> rows[]
  for (const row of parameterRows.value) {
    if (row.stateRole === 'state') continue
    const units = cleanName(row.units)
    if (!units) continue
    if (!index.has(units)) index.set(units, [])
    index.get(units).push(row)
  }
  return index
})

/**
 * Options for a state's initial-value picker: create a brand-new dedicated initialiser (default
 * name "<state>_init"), or point at any existing unit-compatible variable - including one already
 * used by another state (that's exactly how a shared initialiser gets created), and including one
 * that's itself computed elsewhere in the math (e.g. SN_soma's `c_init`) - CellML doesn't care
 * whether a named initial value is a free-standing constant or a computed quantity, only that the
 * units match.
 *
 * The state's *current* initialiser is always included even if it's missing from the units index
 * for some reason (e.g. its units field is blank or was hand-edited to something that no longer
 * matches) - otherwise the dropdown would show as unselected despite the state having a real,
 * valid assignment.
 */
function initialiserOptionsFor(stateRow) {
  const stateUnits = cleanName(stateRow.units)
  const candidates = (stateUnits ? rowsByUnits.value.get(stateUnits) : undefined)?.filter((row) => row !== stateRow) ?? []

  if (stateRow.initialiser && !candidates.some((row) => row.name === stateRow.initialiser)) {
    const currentRow = parameterRows.value.find((row) => row.name === stateRow.initialiser)
    if (currentRow) candidates.unshift(currentRow)
  }

  const options = [{ label: `New (${nextAvailableInitialiserName(stateRow)})`, value: NEW_INITIALISER_VALUE }]
  candidates.forEach((row) => {
    options.push({ label: row.type === 'variable' ? `${row.name} (computed)` : row.name, value: row.name })
  })
  return options
}

/** Creates a brand-new dedicated initialiser row for `stateRow` and returns its name. */
function createNewInitialiserFor(stateRow) {
  const name = nextAvailableInitialiserName(stateRow)

  parameterRows.value.push({
    name,
    value: '',
    units: stateRow.units,
    type: 'constant',
    access: NO_ACCESS,
  })
  return name
}

/**
 * After a state is re-pointed away from `previousInitialiserName`, checks whether that initialiser
 * is now unused by every state and, if so, asks before removing it from the table entirely.
 */
async function maybeCleanupOrphanedInitialiser(previousInitialiserName) {
  if (!previousInitialiserName) return
  if ((initialiserUsage.value.get(previousInitialiserName) ?? 0) > 0) return // still in use elsewhere

  const row = parameterRows.value.find((r) => r.name === previousInitialiserName)
  if (!row) return

  const confirmed = await confirm({
    header: 'Remove unused initialiser?',
    message: `"${previousInitialiserName}" is no longer used to set any state's initial value. Remove it from the parameter table?`,
    severity: 'warning',
    acceptLabel: 'Remove',
    rejectLabel: 'Keep',
  })
  if (!confirmed) return

  const index = parameterRows.value.indexOf(row)
  if (index !== -1) parameterRows.value.splice(index, 1)
}

async function onInitialiserPick(stateRow, selectedValue) {
  const previousInitialiser = stateRow.initialiser

  let targetName = selectedValue
  if (selectedValue === NEW_INITIALISER_VALUE) {
    targetName = createNewInitialiserFor(stateRow)
  }

  if (targetName === previousInitialiser) return

  stateRow.initialiser = targetName

  await maybeCleanupOrphanedInitialiser(previousInitialiser)
}

/** Renames an initialiser row and repoints every state that was using it to the new name. */
function renameInitialiser(row, newName) {
  const oldName = row.name
  const cleaned = cleanName(newName)
  if (!cleaned || cleaned === oldName) return

  const collides = parameterRows.value.some((other) => other !== row && cleanName(other.name) === cleaned)
  if (collides) return // the live notice already communicates this - just refuse the change

  row.name = cleaned
  parameterRows.value.forEach((other) => {
    if (other.stateRole === 'state' && other.initialiser === oldName) other.initialiser = cleaned
  })
}

/**
 * Notice shown next to a renamed initialiser when its (sanitised) name collides with any other
 * row in the table. Duplicate row names would silently break every name-keyed lookup downstream
 * (buildVariableDeclarations, the picker options above, port variable selection, ...), so this is
 * surfaced live as the person types, in addition to the hard block in handleSave.
 */
function duplicateNameNotice(row) {
  const cleaned = cleanName(row.name)
  if (!cleaned) return ''
  const isDuplicate = parameterRows.value.some((other) => other !== row && cleanName(other.name) === cleaned)
  return isDuplicate ? `"${cleaned}" is already used by another variable` : ''
}

/** Two flat categories, denoted purely by a left-edge colour - green for a state, purple for
 * anything currently serving as an initialiser (shared or not, computed or not). No nesting,
 * indentation, or adjacency: a row's position in the table is decided only by the active sort. */
function parameterRowClass(row) {
  return {
    'parameter-row--unresolved': unresolvedVariableNames.value.has(row.name) || isValueMissing(row),
    'parameter-row--state': row.stateRole === 'state',
    'parameter-row--initialiser': isInitialiserRow(row),
  }
}

/**
 * Ensures every current state has a `stateRole`/`initialiser` pointing at a real row, creating the
 * "<state>_init" default only when nothing else already supplies that state's initial value.
 * Sharing (multiple states pointing at the same initialiser) is left entirely alone here - this
 * only ever fills in what's missing; it never touches an initialiser a state already has, whether
 * that came from the model's own CellML or from a previous pick in this dialog.
 */
function resolveStateInitialisers(rows, stateNames) {
  const currentStateNames = new Set(stateNames)
  const byName = new Map(rows.map((row) => [row.name, row]))

  // A row still marked as a state that no longer is one loses that marking; its initialiser
  // pointer is dropped too (whether the initialiser row itself survives depends on whether
  // anything else still references it, same as any other unreferenced variable).
  for (const row of rows) {
    if (row.stateRole === 'state' && !currentStateNames.has(row.name)) {
      delete row.stateRole
      delete row.initialiser
    }
  }

  for (const stateName of currentStateNames) {
    const stateRow = byName.get(stateName)
    if (!stateRow) continue

    stateRow.stateRole = 'state'
    stateRow.type = 'variable'

    if (stateRow.initialiser && byName.has(stateRow.initialiser)) continue // already resolved

    // No known initialiser - fall back to the "<state>_init" convention. This is only ever a
    // *default* name for a brand-new initialiser; it can be freely renamed or re-pointed at an
    // existing variable afterwards via the picker in the Value column.
    const defaultName = `${stateName}_init`
    let initialiserRow = byName.get(defaultName)
    if (!initialiserRow) {
      const seed = String(stateRow.value ?? '').trim()
      initialiserRow = {
        name: defaultName,
        value: isNumericLiteral(seed) ? seed : '',
        units: stateRow.units,
        type: 'constant',
        access: NO_ACCESS,
      }
      rows.push(initialiserRow)
      byName.set(defaultName, initialiserRow)
    }
    stateRow.initialiser = defaultName
  }

  return rows
}

const editorDefinitions = computed(() => buildVariableDeclarations(parameterRows.value))

// ── Missing / invalid data ───────────────────────────────────────────────────
const isBlank = (value) => String(value ?? '').trim() === ''

function isValueMissing(row) {
  return !row.textInit && VALUE_REQUIRED_TYPES.has(row.type) && isBlank(row.value)
}

const displayType = (row) => (row.textInit ? 'variable' : row.type)

function unknownUnitsNotice(row) {
  const cleaned = cleanName(row.units)
  if (!cleaned || store.availableUnitNames.has(cleaned)) return ''
  return `"${cleaned}" isn't defined in the units library`
}

const ISSUE_MATCHERS = {
  units: (row) => unresolvedVariableNames.value.has(row.name),
  values: (row) => isValueMissing(row),
  unknown: (row) => !!unknownUnitsNotice(row),
}

const issueChips = computed(() => {
  const rows = parameterRows.value
  const count = (fn) => rows.filter(fn).length
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

  const missingUnits = count(ISSUE_MATCHERS.units)
  const missingValues = count(ISSUE_MATCHERS.values)
  const unknownUnits = count(ISSUE_MATCHERS.unknown)

  const chips = []
  if (missingUnits) {
    chips.push({ key: 'units', kind: 'units', icon: 'pi-exclamation-circle', count: missingUnits, label: `${plural(missingUnits, 'variable')} missing units` })
  }
  if (missingValues) {
    chips.push({ key: 'values', kind: 'units', icon: 'pi-sliders-h', count: missingValues, label: `${plural(missingValues, 'value')} required` })
  }
  if (unknownUnits) {
    chips.push({ key: 'unknown', kind: 'unknown', icon: 'pi-info-circle', count: unknownUnits, label: `${plural(unknownUnits, 'unit')} not in library` })
  }
  return chips
})

// ── "Show only" filter ───────────────────────────────────────────────────────
const issueFilter = useIssueFilter({
  rows: parameterRows,
  matchers: ISSUE_MATCHERS,
  availableKeys: computed(() => issueChips.value.map((chip) => chip.key)),
})
const activeIssueKeys = issueFilter.activeKeys
const toggleIssueFilter = issueFilter.toggle

// Screen readers get the same information the badges show.
const railAriaLabel = computed(() => {
  const summary = activeTab.value === 'parameters' ? issueChips.value.map((chip) => chip.label).join(', ') : ''
  const label = activeTab.value === 'parameters' ? `Parameters (${parameterRows.value.length})` : `Ports (${editablePorts.value.length})`
  return summary ? `Expand panel. ${label}. ${summary}` : `Expand panel. ${label}`
})

// ── Computed ─────────────────────────────────────────────────────────────────
const componentFile = computed(() => props.mathRef?.split(':')[0])
const componentName = computed(() => props.mathRef?.split(':')[1])

const siblings = computed(() => {
  if (!componentName.value || !componentFile.value) return []
  return nodes.value.filter((n) => n.id !== props.id && n.data?.mathRef === props.mathRef).map((n) => n.id)
})

const siblingCount = computed(() => siblings.value.length)

const isDirty = computed(() =>
  !areModelsEquivalent(originalModel.value, currentModel.value)
)

const filteredParameterRows = computed(() => {
  let rows = parameterRows.value

  rows = rows.filter(issueFilter.isShown)

  if (!searchQuery.value.trim()) return rows
  const query = searchQuery.value.toLowerCase()
  const columnKey = searchColumn.value
  return rows.filter((row) => String(row[columnKey] || '').toLowerCase().includes(query))
})

const visibleParameterRows = computed(() => filteredParameterRows.value)

// ── Watchers & Handlers ──────────────────────────────────────────────────────
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      loading.value = true
      applyToAll.value = false
      activeTab.value = props.defaultTab || 'parameters'
      isManaged.value = props.initialManaged
      rowsBuiltAsManaged = props.initialManaged
      issueFilter.reset()
      unresolvedVariableNames.value = new Set()

      // Load Instance & Port data
      editableName.value = props.initialName
      editableComponentName.value = componentName.value
      componentNameForEditor.value = componentName.value
      editablePorts.value = detachReactivity(props.initialPorts || []).map((port) => ({
        ...port,
        variables: Array.isArray(port.variables)
          ? port.variables.map((v) => (typeof v === 'object' && v !== null ? v.name : v))
          : []
      }))

      // Load Parameters. Carry over stateRole/initialiser from the saved node data (when present)
      // so a known initialiser assignment - especially a shared one, or one that isn't itself
      // referenced in the math and so has no other way to be re-detected - has something to be
      // recognised from and carried forward on the very first analysis pass below. Note `type` is
      // deliberately carried over too - rowsFromAnalysis/rowsFromDeclaredVariables re-derive it
      // from the math on that first pass regardless (see resolveType in variables.js), so a stale
      // persisted 'constant' on a computed initialiser self-heals rather than sticking around.
      parameterRows.value = props.variables.map((row) => ({
        name: row.name,
        value: row.type === 'global_constant' ? store.getGlobalConstant(row.name)?.value : row.value,
        units: row.units,
        type: row.type,
        access: row.access,
        ...(row.stateRole === 'state' ? { stateRole: 'state', initialiser: row.initialiser } : {}),
      }))
      sortParameterRows('type', 1)

      // Load CellML
      try {
        if (props.mathRef) {
          const math = store.availableMath.get(props.mathRef)
          currentModel.value = math
          originalModel.value = math
          seedRowsFromStoredModel(math)
        }
      } catch (e) {
        console.error('Failed to load CellML source', e)
      } finally {
        await nextTick()
        loading.value = false
      }
    }
  }
)

// ── Text editor events ───────────────────────────────────────────────────────
let pendingChange = Promise.resolve()

function handleEditorChange(change) {
  pendingChange = pendingChange
    .then(() => processEditorChange(change))
    .catch((error) => console.error('Failed to process CellML editor change', error))
}

/** Routes a change event from the CellML editor to the handler for its source. */
async function processEditorChange({ source, text, valid, xml, analysis }) {
  if (source === 'init') {
    handleInitialLoad(text, valid, xml, analysis)
  } else if (!valid) {
    if (source === 'edit') await handleInvalidEdit(text)
  } else if (source === 'external') {
    currentModel.value = xml
    currentCellmlText.value = text
    syncUnresolved(analysis)

    // A mode switch refreshes the table.
    const rows = rowsForCurrentMode(xml, analysis)
    if (rows && (rowsBuiltAsManaged !== isManaged.value || !sameNames(rows, parameterRows.value))) {
      parameterRows.value = rows
      rowsBuiltAsManaged = isManaged.value
    }
  } else {
    await handleValidEdit(xml, text, analysis)
  }
}

function syncUnresolved(analysis) {
  unresolvedVariableNames.value = new Set(isManaged.value ? analysis.unresolved : [])
}

const MODEL_ANALYSIS_CACHE_LIMIT = 20
const modelXmlAnalysisCache = new Map() // xml string -> analyzeModelXml() result
const mathRolesCache = new Map() // xml string -> analyzeMathRoles() result

function memoized(cache, key, compute) {
  if (!key) return compute()
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const result = compute()
  cache.set(key, result)
  if (cache.size > MODEL_ANALYSIS_CACHE_LIMIT) cache.delete(cache.keys().next().value) // evict oldest
  return result
}

const analyzeModelXmlCached = (xml) => memoized(modelXmlAnalysisCache, xml, () => analyzeModelXml(xml))
const analyzeMathRolesCached = (xml) => memoized(mathRolesCache, xml, () => analyzeMathRoles(xml))

/** Builds parameter rows from `xml`/`analysis` for whichever mode (Simple/Advanced) is active. */
function rowsForCurrentMode(xml, analysis) {
  const previousRows = parameterRows.value

  if (isManaged.value) {
    const rows = rowsFromAnalysis(analysis, previousRows, analyzeMathRolesCached(xml))
    resolveStateInitialisers(rows, analysis.stateVariables)
    syncInitialiserUnits(rows)
    return rows
  }

  let declared
  try {
    declared = extractVariablesFromMath(xml)
  } catch (error) {
    console.warn('Could not read variables from the CellML text', error)
    return null
  }
  if (!declared) return null

  const rows = rowsFromDeclaredVariables(declared, analysis, previousRows)
  resolveStateInitialisers(rows, analysis.stateVariables)
  syncInitialiserUnits(rows)
  return rows
}

function sameNames(rows, otherRows) {
  const names = new Set(otherRows.map((row) => row.name))
  return rows.length === otherRows.length && rows.every((row) => names.has(row.name))
}

/** Builds the initial parameter rows from the model when the editor mounts. */
function handleInitialLoad(text, valid, xml, analysis) {
  currentCellmlText.value = text
  if (!valid) return

  currentModel.value = xml
  originalModel.value = xml
  syncUnresolved(analysis)

  const rows = rowsForCurrentMode(xml, analysis)
  if (!rows) return
  parameterRows.value = rows
  rowsBuiltAsManaged = isManaged.value

  const names = new Set(rows.map((row) => row.name))
  for (const port of editablePorts.value) {
    if (Array.isArray(port.variables)) port.variables = port.variables.filter((name) => names.has(name))
  }
}

/** Seeds the table from the stored model before the editor mounts, so units already in the XML aren't lost on first parse. */
function seedRowsFromStoredModel(xml) {
  if (!isManaged.value) return

  const analysis = analyzeModelXmlCached(xml)
  if (!analysis) return

  const rows = rowsFromAnalysis(analysis, parameterRows.value, analyzeMathRolesCached(xml))
  resolveStateInitialisers(rows, analysis.stateVariables)
  syncInitialiserUnits(rows)
  parameterRows.value = rows
  rowsBuiltAsManaged = true
}

/**
 * Records a valid text edit in undo history: the CellML code, the parameter rows it implies,
 * and any ports left referencing a variable that no longer exists.
 * @param {string} newCode
 * @param {string} newRawText
 * @param {ModelAnalysis} analysis
 */
async function handleValidEdit(newCode, newRawText, analysis) {
  const previousCode = currentModel.value
  const previousRawText = currentCellmlText.value
  if (previousCode === newCode) return

  const newParameterRows = rowsForCurrentMode(newCode, analysis)
  if (!newParameterRows) return
  rowsBuiltAsManaged = isManaged.value

  const previousParameterRows = parameterRows.value
  const validVarNames = new Set(newParameterRows.map((v) => v.name))
  syncUnresolved(analysis)

  history.startBatch()

  await history.executeAndAddCommand({
    type: 'update-cellml-code',
    undo: async () => {
      currentModel.value = previousCode
      currentCellmlText.value = previousRawText
      await cellmlEditorRef.value?.setText(previousRawText)
    },
    redo: async () => {
      currentModel.value = newCode
      currentCellmlText.value = newRawText
      await cellmlEditorRef.value?.setText(newRawText)
    },
  })

  await history.executeAndAddCommand({
    type: 'update-parameter-rows',
    undo: async () => {
      parameterRows.value = previousParameterRows
    },
    redo: async () => {
      parameterRows.value = newParameterRows
    },
  })

  for (const port of editablePorts.value) {
    if (!Array.isArray(port.variables)) continue

    const portVars = port.variables
    const removed = portVars.filter((varName) => !validVarNames.has(varName))
    if (removed.length === 0) continue

    await history.executeAndAddCommand({
      type: 'remove-variable-from-port',
      undo: async () => {
        port.variables = portVars
      },
      redo: async () => {
        port.variables = port.variables.filter((varName) => validVarNames.has(varName))
      },
    })
  }

  history.endBatch()
}

/** Records an edit that didn't parse, so undo/redo can still replay the raw text. */
async function handleInvalidEdit(rawText) {
  const previousRawText = currentCellmlText.value
  if (previousRawText === rawText) return

  await history.executeAndAddCommand({
    type: 'update-cellml-text-only',
    undo: async () => {
      currentCellmlText.value = previousRawText
      await cellmlEditorRef.value?.setText(previousRawText)
    },
    redo: async () => {
      currentCellmlText.value = rawText
      await cellmlEditorRef.value?.setText(rawText)
    },
  })
}

async function handleEditorUndo() {
  if (!history.canUndo) return
  await history.undo()
}

async function handleEditorRedo() {
  if (!history.canRedo) return
  await history.redo()
}

// Sort by what the table shows (a text-initialised variable displays as 'variable').
const sortValue = (row, field) => (field === 'type' ? displayType(row) : row?.[field])

function sortParameterRows(field = 'type', order = 1) {
  parameterRows.value.sort((a, b) => {
    const valA = String(sortValue(a, field) || '').toLowerCase()
    const valB = String(sortValue(b, field) || '').toLowerCase()
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
    if (row.stateRole === 'state' || row.textInit) return
    row.type = targetType
  })
  selectedRows.value = []
  bulkTypeValue.value = ''
}

function clearPortVariableSearch(event) {
  const input = event.currentTarget.closest('.p-iconfield')?.querySelector('input')
  if (!input) return
  input.value = ''
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.focus()
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

async function handleMathOverwrite() {
  return confirm({
    header: 'Overwrite Math?',
    message: `You are about to overwrite an existing math definition. This will affect ${siblingCount.value} other instances. Are you sure you want to proceed?`,
    severity: 'warning',
    acceptLabel: 'Proceed',
    rejectLabel: 'Cancel',
  })
}

// ── Save Processing ──────────────────────────────────────────────────────────
async function handleSave() {
  // Make sure the editor's latest text (and any rename) has been processed before reading state.
  cellmlEditorRef.value?.flush()
  await pendingChange

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

  if (isManaged.value && !cleanName(editableComponentName.value)) {
    notify.error({ message: 'Component name is invalid.' })
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

  // 2b. Validate no two parameter rows share a name. This can only happen via a renamed
  // initialiser colliding with another row - block it here since a saved duplicate would
  // silently break every name-keyed lookup downstream (buildVariableDeclarations, the initialiser
  // picker options, port variable selection, ...).
  const nameCounts = new Map()
  parameterRows.value.forEach((row) => {
    const cleaned = cleanName(row.name)
    if (!cleaned) return
    nameCounts.set(cleaned, (nameCounts.get(cleaned) ?? 0) + 1)
  })
  const duplicateName = [...nameCounts.entries()].find(([, count]) => count > 1)?.[0]
  if (duplicateName) {
    notify.error({ message: `Two variables are both named "${duplicateName}". Rename one before saving.` })
    activeTab.value = 'parameters'
    return
  }

  const textErrors = cellmlEditorRef.value?.getErrors?.() ?? []
  if (textErrors.length > 0) {
    const proceed = await confirm({
      header: 'CellML Text Has Errors',
      message: 'If you continue, the last valid version of the model will be saved and any edits since then will be lost.',
      severity: 'warning',
      acceptLabel: 'Proceed',
      rejectLabel: 'Cancel',
    })
    if (!proceed) return
  }

  // Sync each state's initialiser to the state's units (only where the initialiser's own units
  // are still blank - see syncInitialiserUnits).
  syncInitialiserUnits(parameterRows.value)

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
    if (newMathRef === props.mathRef && store.availableMath.has(newMathRef)) {
      const overwrite = await handleMathOverwrite()
      if (!overwrite) return
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
    managed: isManaged.value,
    updateAll,
    siblings: updateAll ? siblings.value : undefined,
  })

  emit('update:modelValue', false)
}
</script>

<style scoped>
.custom-dialog-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.125rem;
  font-weight: 600;
  width: 100%;
  overflow: visible;
  flex-wrap: wrap;
}

.header-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.header-group--end {
  margin-left: auto;
}

.header-label {
  color: var(--p-text-color);
}

.header-file {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
  max-width: 16rem;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  font-weight: normal;
}

.header-file .pi {
  flex: 0 0 auto;
  font-size: 0.8125rem;
}

.header-file-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.module-editor-dialog {
  display: flex;
  flex-direction: column;
  overflow: auto;
  box-sizing: border-box;
}

.module-editor-dialog :deep(.p-dialog-header) {
  overflow: visible;
}

.module-editor-dialog :deep(.p-dialog-content) {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  padding-bottom: 16px !important;
}

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
  height: 100%;
  max-height: 100%;
  max-width: 100%;
  transition: filter 0.2s ease, opacity 0.2s ease;
}

.editor-grid.is-dragging {
  cursor: col-resize;
  user-select: none;
}

.editor-grid.is-suppressed {
  pointer-events: none;
  opacity: 0.4;
  filter: blur(2px) saturate(0.7);
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
  min-width: 38%;
  max-width: 55%;
}

.left-pane--collapsed {
  max-width: 100%;
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
  min-width: 32%;
  max-width: 72%;
  transition: min-width 0.15s ease, flex-basis 0.15s ease;
}

.right-pane--collapsed {
  flex: 0 0 32px;
  min-width: 32px;
  padding: 8px 4px;
  align-items: center;
}

.rail-badges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  margin-bottom: 10px;
}

.rail-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  width: 100%;
  padding: 3px 0;
  border-radius: 6px;
  font-size: var(--dlg-fs-tiny);
  font-weight: 600;
  line-height: 1.1;
  color: var(--p-text-color);
  background-color: color-mix(in srgb, var(--chip-color) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--chip-color) 40%, transparent);
}

.rail-badge .pi {
  font-size: 0.7rem;
  color: var(--chip-color);
}

.collapsed-rail {
  flex: 1;
  display: flex;
  flex-direction: column;
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

.legend-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--dlg-fs-tiny);
  color: var(--p-text-muted-color);
}

.legend-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-swatch--state {
  background-color: var(--p-green-500, #22c55e);
}

.legend-swatch--initialiser {
  background-color: var(--p-purple-400, #a78bfa);
}

.search-group, .bulk-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.managed-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  padding: 6px 10px;
  border-radius: 6px;
  background-color: color-mix(in srgb, var(--p-primary-color, #3b82f6) 10%, transparent);
  font-size: var(--dlg-fs-tiny);
  color: var(--p-text-muted-color);
}

.managed-hint .pi {
  font-size: 0.85em;
  color: var(--p-primary-color, #3b82f6);
}

.right-pane :deep(.parameter-row--unresolved) {
  background-color: color-mix(in srgb, var(--p-yellow-500, #eab308) 14%, transparent);
}

/* Flat categories: a left-edge stripe only - no indentation, italics, arrows, or adjacency. A row
   is either a state (green) or an initialiser (purple, whether shared or exclusive, computed or
   plain); never both. */
.right-pane :deep(tr.parameter-row--state) {
  box-shadow: inset 3px 0 0 0 var(--p-green-500, #22c55e);
}

.right-pane :deep(tr.parameter-row--initialiser) {
  box-shadow: inset 3px 0 0 0 var(--p-purple-400, #a78bfa);
}

/* Unresolved/missing-value urgency always wins over the state/initialiser stripe colour. */
.right-pane :deep(tr.parameter-row--state.parameter-row--unresolved),
.right-pane :deep(tr.parameter-row--initialiser.parameter-row--unresolved) {
  background-color: color-mix(in srgb, var(--p-yellow-500, #eab308) 14%, transparent);
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.shared-initialiser-badge {
  flex: 0 0 auto;
  font-size: var(--dlg-fs-tiny);
  cursor: help;
}

/* Units cell: input plus a small flag when the name needs fixing or isn't in the library */
/* Selection checkboxes: the default is sized for forms, which is large in a dense table */
.right-pane :deep(.parameters-table) {
  --p-checkbox-width: 1rem;
  --p-checkbox-height: 1rem;
  --p-checkbox-icon-size: 0.625rem;
}

/* Read-only cell content in the same box as an input, so it lines up with the fields above and below it */
.cell-static {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 var(--p-inputtext-sm-padding-x, 0.625rem);
  border: 1px solid transparent;
  font-size: var(--dlg-fs-body);
}

.cell-static-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.units-flag {
  flex: 0 0 auto;
  font-size: 0.8rem;
  color: var(--p-yellow-600, #ca8a04);
  cursor: help;
}

/* Summary of what still needs attention in the table */
.issue-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--p-content-border-color);
}

.issue-summary-label {
  font-size: var(--dlg-fs-tiny);
  color: var(--p-text-muted-color);
}

.issue-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  font: inherit;
  font-size: var(--dlg-fs-tiny);
  color: var(--p-text-color);
  cursor: pointer;
  background-color: color-mix(in srgb, var(--chip-color) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--chip-color) 40%, transparent);
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.issue-chip:hover {
  background-color: color-mix(in srgb, var(--chip-color) 26%, transparent);
}

.issue-chip:focus-visible {
  outline: 2px solid var(--chip-color);
  outline-offset: 1px;
}

/* On: the table is showing only these rows */
.issue-chip--active {
  font-weight: 600;
  background-color: color-mix(in srgb, var(--chip-color) 34%, transparent);
  border-color: var(--chip-color);
}

.issue-chip .pi {
  font-size: 0.75rem;
  color: var(--chip-color);
}

.issue-chip--units {
  --chip-color: var(--p-yellow-500, #eab308);
}

.issue-chip--unknown {
  --chip-color: var(--p-primary-color, #3b82f6);
}

.search-group {
  flex-wrap: wrap;
}

.search-input-wrapper {
  position: relative;
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

/* ── Resize warning overlay ── */
.resize-warning-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 15, 20, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.resize-warning-card {
  width: min(420px, 100%);
  text-align: center;
  padding: 32px 28px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  background: var(--p-content-background);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18);
}

.resize-warning-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-bottom: 20px;
}

.resize-warning-window {
  font-size: 2.5rem;
  color: var(--p-primary-color);
}

.resize-warning-arrow {
  font-size: 1.375rem;
  color: var(--p-primary-color);
  opacity: 0.45;
  animation-duration: 1.6s;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
}

.resize-warning-arrow--left {
  animation-name: resize-warning-pulse-left;
}

.resize-warning-arrow--right {
  animation-name: resize-warning-pulse-right;
  animation-delay: 0.1s;
}

@keyframes resize-warning-pulse-left {
  0%, 100% { transform: translateX(0); opacity: 0.4; }
  50% { transform: translateX(-6px); opacity: 1; }
}

@keyframes resize-warning-pulse-right {
  0%, 100% { transform: translateX(0); opacity: 0.4; }
  50% { transform: translateX(6px); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .resize-warning-arrow {
    animation: none;
    opacity: 0.7;
  }
}

.resize-warning-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 8px;
}

.resize-warning-copy {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0 0 22px;
}

.resize-warning-meter-track {
  height: 6px;
  border-radius: 999px;
  background: var(--p-content-hover-background, rgba(0, 0, 0, 0.08));
  overflow: hidden;
}

.resize-warning-meter-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--p-primary-color);
  transition: width 0.15s ease-out;
}

.resize-warning-meter-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  font-variant-numeric: tabular-nums;
}

/* Transition: overlay fades, card fades + scales in slightly */
.resize-warning-enter-active,
.resize-warning-leave-active {
  transition: opacity 0.18s ease;
}

.resize-warning-enter-from,
.resize-warning-leave-to {
  opacity: 0;
}

.resize-warning-enter-active .resize-warning-card,
.resize-warning-leave-active .resize-warning-card {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.resize-warning-enter-from .resize-warning-card,
.resize-warning-leave-to .resize-warning-card {
  transform: scale(0.96) translateY(6px);
  opacity: 0;
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

<!-- The variable picker's panel is teleported to <body>, so the scoped styles above can't reach it. -->
<style>
.ports-variable-overlay {
  /* Sized to sit with the ports table (14px text), not the form-sized defaults. */
  --p-multiselect-option-font-size: 0.875rem;
  --p-multiselect-option-padding: 0.3125rem 0.625rem;
  --p-multiselect-option-gap: 0.5rem;
  --p-multiselect-list-padding: 0.25rem;
  --p-multiselect-list-gap: 1px;
  --p-checkbox-width: 1rem;
  --p-checkbox-height: 1rem;
  --p-checkbox-icon-size: 0.625rem;
}

.ports-variable-overlay .p-multiselect-header {
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
}

.ports-variable-overlay .p-multiselect-header .p-inputtext {
  font-size: 0.875rem;
}

/* Search field: search icon left, clear button right (only once there's text), like the other search bars. */
.ports-variable-overlay .p-multiselect-header .p-iconfield .p-inputtext {
  padding-inline: 2rem;
}

.ports-variable-overlay .p-multiselect-header .p-iconfield .p-inputicon {
  inset-inline: 0.625rem;
  top: 50%;
  margin-top: 0;
  width: auto;
  height: auto;
  transform: translateY(-50%);
  pointer-events: none;
}

.ports-variable-overlay .ports-variable-filter-icons {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  font-size: 0.875rem;
}

.ports-variable-overlay .search-clear-input {
  pointer-events: auto;
  cursor: pointer;
}

.ports-variable-overlay .search-clear-input:hover {
  color: var(--p-text-color);
}

.ports-variable-overlay .p-multiselect-header .p-inputtext:placeholder-shown + .p-inputicon .search-clear-input {
  visibility: hidden;
  pointer-events: none;
}
</style>
