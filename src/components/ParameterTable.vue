<template>
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
        v-model:selection="selectedRows"
        :value="filteredParameterRows"
        dataKey="name"
        scrollable
        scrollHeight="flex"
        :virtualScrollerOptions="virtualScrollerOptions"
        tableStyle="min-width: 560px; table-layout: fixed"
        sortField="type"
        :sortOrder="1"
        :rowClass="parameterRowClass"
        class="p-datatable-sm parameters-table"
      >
        <Column selectionMode="multiple" headerStyle="width: 2rem" />
        <Column field="name" bodyClass="small-text-col" header="Name" sortable style="min-width: 120px">
          <template #body="slotProps">
            <span class="name-cell">
              <SanitisedInput
                v-if="isRenamableInitialiser(slotProps.data)"
                :model-value="displayedName(slotProps.data)"
                :sanitise="cleanName"
                :notice="duplicateNameNotice(slotProps.data)"
                placeholder="Initialiser name..."
                @update:model-value="(val) => onNameInput(slotProps.data, val)"
                @commit="(val) => onNameCommit(slotProps.data, val)"
                @revert="(event) => onNameRevert(slotProps.data, event)"
              />
              <span v-else class="cell-static-text">{{ slotProps.data.name }}</span>
              <Tag
                v-if="isSharedInitialiserRow(slotProps.data)"
                severity="info"
                class="shared-initialiser-badge"
                :value="`x${initialiserUsage.get(slotProps.data.name)}`"
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
              :notice="getUnitsNotice(slotProps.data)"
              floating
              placeholder="e.g. millivolt"
            />
            <span v-else class="cell-static text-muted" title="Edit units in the CellML text">
              <span class="cell-static-text">{{ slotProps.data.units || '—' }}</span>
              <i
                v-if="getUnitsNotice(slotProps.data)"
                class="pi pi-exclamation-triangle units-flag"
                :title="getUnitsNotice(slotProps.data)"
              ></i>
            </span>
          </template>
        </Column>
        <Column field="type" header="Type" sortable style="width: 140px">
          <template #body="slotProps">
            <Select
              :model-value="getDisplayType(slotProps.data)"
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
</template>

<script setup>
/**
 * The parameter table: state/initialiser pairing, initialiser renaming, search, sort, bulk type
 * and the issue filter. Rows are edited in place; useMathSession decides when they're replaced.
 */
import { ref, reactive, computed, onUnmounted } from 'vue'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import SanitisedInput from './SanitisedInput.vue'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import { isEditableVariableType } from '../utils/variables'
import { getDisplayType, isValueMissing } from '../utils/parameterRows'
import { PARAMETER_TYPE_OPTIONS, NO_ACCESS } from '../utils/constants'
import { cleanName } from '../utils/identifiers'

const props = defineProps({
  rows: { type: Array, required: true },
  isManaged: { type: Boolean, default: true },
  isMissingUnits: { type: Function, required: true },
  /** Gets a row's unknown-units warning, or ''. */
  getUnitsNotice: { type: Function, required: true },
  issueChips: { type: Array, default: () => [] },
  /** The dialog's useIssueFilter() result. */
  issueFilter: { type: Object, required: true },
})

const { confirm } = useConfirmDialog()

/** Picker value meaning "create a new initialiser" rather than pick an existing variable. */
const NEW_INITIALISER_VALUE = '__new_initialiser__'

const selectedRows = ref([])

// Search state
const searchQuery = ref('')
const searchColumn = ref('name')
const searchColumnOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Units', value: 'units' },
  { label: 'Type', value: 'type' },
]
const bulkTypeValue = ref('')

// Virtual scrolling mounts only visible rows; mounting a few hundred rows blocked the page on open.
const VIRTUAL_SCROLL_MIN_ROWS = 40
const ROW_HEIGHT_PX = 43
const virtualScrollerOptions = computed(() =>
  filteredParameterRows.value.length > VIRTUAL_SCROLL_MIN_ROWS ? { itemSize: ROW_HEIGHT_PX } : undefined
)

const activeIssueKeys = computed(() => props.issueFilter.activeKeys.value)
const toggleIssueFilter = (key) => props.issueFilter.toggle(key)

// ── Initialiser sharing: usage tracking, picker options, rename/reassign/cleanup ────────────────

/** Initialiser name to the number of states that use it. */
const initialiserUsage = computed(() => {
  const counts = new Map()
  for (const row of props.rows) {
    if (row.stateRole === 'state' && row.initialiser) {
      counts.set(row.initialiser, (counts.get(row.initialiser) ?? 0) + 1)
    }
  }
  return counts
})

/**
 * Checks whether any state uses a row as its initialiser.
 *
 * @param {Object} row
 * @returns {boolean}
 */
function isInitialiserRow(row) {
  return (initialiserUsage.value.get(row.name) ?? 0) > 0
}

/**
 * Checks whether more than one state uses a row as its initialiser.
 *
 * @param {Object} row
 * @returns {boolean}
 */
function isSharedInitialiserRow(row) {
  return (initialiserUsage.value.get(row.name) ?? 0) > 1
}

/**
 * Checks whether a row can be renamed from the table. Only non-computed initialisers qualify,
 * since renaming anything the math references would desync the CellML text.
 *
 * @param {Object} row
 * @returns {boolean}
 */
function isRenamableInitialiser(row) {
  if (row.stateRole === 'state') return false
  if (row.type === 'variable') return false
  return isInitialiserRow(row)
}

/**
 * Lists the states that use an initialiser.
 *
 * @param {string} name - The initialiser's name.
 * @returns {string[]} State names.
 */
function statesUsingInitialiser(name) {
  return props.rows.filter((row) => row.stateRole === 'state' && row.initialiser === name).map((row) => row.name)
}

/**
 * Gets the name a new initialiser for a state would get: `<state>_init`, suffixed if taken.
 * The picker label and createNewInitialiserFor both use it, so they always agree.
 *
 * @param {Object} stateRow
 * @returns {string}
 */
function nextAvailableInitialiserName(stateRow) {
  const defaultName = `${stateRow.name}_init`
  const existingNames = new Set(props.rows.map((row) => row.name))
  let name = defaultName
  let counter = 1
  while (existingNames.has(name)) {
    name = `${defaultName}_${counter++}`
  }
  return name
}

/** Non-state rows by cleaned units, so each state's picker avoids a full-table scan. */
const rowsByUnits = computed(() => {
  const index = new Map() // cleaned units -> rows[]
  for (const row of props.rows) {
    if (row.stateRole === 'state') continue
    const units = cleanName(row.units)
    if (!units) continue
    if (!index.has(units)) index.set(units, [])
    index.get(units).push(row)
  }
  return index
})

/**
 * Builds a state's initial-value picker options: a new initialiser, or any variable with matching
 * units. The current initialiser is always included, even when its units no longer match.
 *
 * @param {Object} stateRow
 * @returns {Array<{label: string, value: string}>}
 */
function initialiserOptionsFor(stateRow) {
  const stateUnits = cleanName(stateRow.units)
  const candidates = (stateUnits ? rowsByUnits.value.get(stateUnits) : undefined)?.filter((row) => row !== stateRow) ?? []

  if (stateRow.initialiser && !candidates.some((row) => row.name === stateRow.initialiser)) {
    const currentRow = props.rows.find((row) => row.name === stateRow.initialiser)
    if (currentRow) candidates.unshift(currentRow)
  }

  const options = [{ label: `New (${nextAvailableInitialiserName(stateRow)})`, value: NEW_INITIALISER_VALUE }]
  candidates.forEach((row) => {
    options.push({ label: row.type === 'variable' ? `${row.name} (computed)` : row.name, value: row.name })
  })
  return options
}

/**
 * Adds a new initialiser row for a state.
 *
 * @param {Object} stateRow
 * @returns {string} The new row's name.
 */
function createNewInitialiserFor(stateRow) {
  const name = nextAvailableInitialiserName(stateRow)

  props.rows.push({
    name,
    value: '',
    units: stateRow.units,
    type: 'constant',
    access: NO_ACCESS,
  })
  return name
}

/**
 * Offers to remove an initialiser that no state uses any more.
 *
 * @param {string} previousInitialiserName
 * @returns {Promise<void>}
 */
async function maybeCleanupOrphanedInitialiser(previousInitialiserName) {
  if (!previousInitialiserName) return
  if ((initialiserUsage.value.get(previousInitialiserName) ?? 0) > 0) return // still in use elsewhere

  const row = props.rows.find((r) => r.name === previousInitialiserName)
  if (!row) return

  const confirmed = await confirm({
    header: 'Remove unused initialiser?',
    message: `"${previousInitialiserName}" is no longer used to set any state's initial value. Remove it from the parameter table?`,
    severity: 'warning',
    acceptLabel: 'Remove',
    rejectLabel: 'Keep',
  })
  if (!confirmed) return

  const index = props.rows.indexOf(row)
  if (index !== -1) props.rows.splice(index, 1)
}

/**
 * Points a state at the picked initialiser, creating one when "New" is picked.
 *
 * @param {Object} stateRow
 * @param {string} selectedValue - A row name, or NEW_INITIALISER_VALUE.
 * @returns {Promise<void>}
 */
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

// Names being typed, by row. A rename commits once, on blur or Enter, because each commit
// re-parses the CellML; the table re-sorts at that point.
const pendingRenameEdits = reactive(new Map()) // row -> pending name

/**
 * Gets the name shown in a row's input, including any uncommitted edit.
 *
 * @param {Object} row
 * @returns {string}
 */
function displayedName(row) {
  return pendingRenameEdits.get(row) ?? row.name
}

/**
 * Records a name as it's typed, without committing it.
 *
 * @param {Object} row
 * @param {string} newName
 */
function onNameInput(row, newName) {
  pendingRenameEdits.set(row, newName)
}

/**
 * Commits a rename when the person leaves the field or presses Enter.
 *
 * @param {Object} row
 * @param {string} newName - The sanitised name.
 */
function onNameCommit(row, newName) {
  pendingRenameEdits.delete(row)
  commitRename(row, newName)
}

/**
 * Abandons an uncommitted rename on Escape, and stops the key closing the dialog.
 *
 * @param {Object} row
 * @param {KeyboardEvent} [event]
 */
function onNameRevert(row, event) {
  if (!pendingRenameEdits.has(row)) return
  event?.stopPropagation()
  pendingRenameEdits.delete(row)
}

/** Commits any rename still being typed; runs before save and on unmount. */
function flushPendingRenames() {
  for (const [row, pendingName] of pendingRenameEdits.entries()) {
    pendingRenameEdits.delete(row)
    commitRename(row, pendingName)
  }
}

/**
 * Renames an initialiser and repoints the states using it. A name that collides is refused.
 *
 * @param {Object} row
 * @param {string} newName
 */
function commitRename(row, newName) {
  const oldName = row.name
  const cleaned = cleanName(newName)
  if (!cleaned || cleaned === oldName) return

  const collides = props.rows.some((other) => other !== row && cleanName(displayedName(other)) === cleaned)
  if (collides) return // the live notice already communicates this - just refuse the change

  row.name = cleaned
  props.rows.forEach((other) => {
    if (other.stateRole === 'state' && other.initialiser === oldName) other.initialiser = cleaned
  })
}

/**
 * Gets the warning for a typed name that another row already uses. Save also blocks duplicates.
 *
 * @param {Object} row
 * @returns {string} The warning, or ''.
 */
function duplicateNameNotice(row) {
  const cleaned = cleanName(displayedName(row))
  if (!cleaned) return ''
  const isDuplicate = props.rows.some((other) => other !== row && cleanName(displayedName(other)) === cleaned)
  return isDuplicate ? `"${cleaned}" is already used by another variable` : ''
}

/**
 * Gets a row's CSS classes: a left-edge colour for states and initialisers, and a highlight for issues.
 *
 * @param {Object} row
 * @returns {Object<string, boolean>}
 */
function parameterRowClass(row) {
  return {
    'parameter-row--unresolved': props.isMissingUnits(row) || isValueMissing(row),
    'parameter-row--state': row.stateRole === 'state',
    'parameter-row--initialiser': isInitialiserRow(row),
  }
}

/** Rows passing the issue filter and the search. */
const filteredParameterRows = computed(() => {
  const rows = props.rows.filter(props.issueFilter.isShown)

  if (!searchQuery.value.trim()) return rows
  const query = searchQuery.value.toLowerCase()
  const columnKey = searchColumn.value
  return rows.filter((row) => String(row[columnKey] || '').toLowerCase().includes(query))
})

/** Applies the bulk type to the selected rows, skipping states and text-initialised rows. */
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

// Commit a rename in progress if the table goes away (tab switch, collapse, close).
onUnmounted(flushPendingRenames)

defineExpose({ flushPendingRenames })
</script>

<style scoped>
.parameters-tab-body {
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

.w-full { width: 100%; }
.text-muted { color: var(--p-text-muted-color); }

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
</style>
